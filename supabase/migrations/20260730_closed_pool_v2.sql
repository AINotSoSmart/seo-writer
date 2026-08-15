-- ============================================================================
-- FlipAEO closed-pool v2
-- Immutable audits, finite programs, frozen link graphs, and lifecycle ledgers.
--
-- WHY THIS IS ONE LARGE MIGRATION
-- This upgrades a live mutable schema without deleting generated, delivered, or
-- published history. The ALTER/backfill/constraint/RLS/RPC order is deliberate:
-- a partial deployment could otherwise expose an incomplete audit, provision a
-- webhook from "latest" data, double-grant a billing period, or cascade-delete
-- purchased work. Multi-table lifecycle transitions live in SQL because an
-- application sequence of Supabase HTTP calls is not atomic and cannot by
-- itself resolve concurrent webhooks/workers safely.
--
-- HOW TO REVIEW IT
-- 1. audit run/backfill/immutability, 2. independent article states,
-- 3. frozen purchase/program/graph records, 4. billing and claims,
-- 5. service-role transaction RPCs for finalization/provisioning/delivery.
-- The detailed why/how map is in docs/PIVOT.md section 2.0.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE public.dodo_pricing_plans
SET
    description = CASE lower(name)
        WHEN 'close' THEN 'Six-cluster program delivered one complete cluster per 30-day billing period.'
        WHEN 'accelerate' THEN 'Six-cluster program delivered in complete batches, two clusters per 30-day billing period.'
        WHEN 'dominate' THEN 'Six-cluster program delivered in complete batches, four clusters per 30-day billing period.'
        ELSE description
    END,
    updated_at = now()
WHERE lower(name) IN ('close', 'accelerate', 'dominate');

-- ---------------------------------------------------------------------------
-- Immutable audit runs
-- ---------------------------------------------------------------------------
ALTER TABLE public.topical_audits
    DROP CONSTRAINT IF EXISTS topical_audits_user_id_brand_id_key;

ALTER TABLE public.topical_audits
    ALTER COLUMN brand_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS subject_url TEXT,
    ADD COLUMN IF NOT EXISTS input_seeds TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS input_competitors TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS brand_snapshot JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS harvest_policy_version TEXT NOT NULL DEFAULT 'legacy-import',
    ADD COLUMN IF NOT EXISTS result_hash TEXT,
    ADD COLUMN IF NOT EXISTS audit_kind TEXT NOT NULL DEFAULT 'customer',
    ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS run_status TEXT NOT NULL DEFAULT 'running',
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failure_code TEXT,
    ADD COLUMN IF NOT EXISTS requires_reaudit BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS source_call_ledger JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS site_page_snapshot JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS public_token_revoked_at TIMESTAMPTZ;

WITH legacy_brand_ids AS (
    SELECT brand_id FROM public.query_pool
    UNION
    SELECT brand_id FROM public.audit_clusters
    UNION
    SELECT brand_id FROM public.planned_articles
    UNION
    SELECT brand_id FROM public.programs
)
INSERT INTO public.topical_audits (
    user_id,
    brand_id,
    subject_url,
    brand_snapshot,
    harvest_policy_version,
    audit_kind,
    created_by_user_id,
    run_status,
    generation_status,
    generation_phase,
    completed_at,
    requires_reaudit,
    public_token
)
SELECT
    b.user_id,
    b.id,
    b.website_url,
    b.brand_data,
    'legacy-import',
    'customer',
    b.user_id,
    'completed',
    'completed',
    'completed',
    now(),
    TRUE,
    encode(gen_random_bytes(24), 'hex')
FROM public.brand_details b
JOIN legacy_brand_ids legacy ON legacy.brand_id = b.id
WHERE NOT EXISTS (
    SELECT 1 FROM public.topical_audits ta WHERE ta.brand_id = b.id
);

UPDATE public.topical_audits
SET
    subject_url = COALESCE(
        subject_url,
        (SELECT b.website_url FROM public.brand_details b WHERE b.id = topical_audits.brand_id)
    ),
    created_by_user_id = COALESCE(created_by_user_id, user_id),
    run_status = CASE
        WHEN generation_status = 'completed' THEN 'completed'
        WHEN generation_status = 'failed' THEN 'failed'
        ELSE 'running'
    END,
    completed_at = CASE
        WHEN generation_status = 'completed' THEN COALESCE(completed_at, updated_at)
        ELSE completed_at
    END,
    failed_at = CASE
        WHEN generation_status = 'failed' THEN COALESCE(failed_at, updated_at)
        ELSE failed_at
    END,
    requires_reaudit = TRUE,
    harvest_policy_version = 'legacy-import';

ALTER TABLE public.topical_audits
    DROP CONSTRAINT IF EXISTS topical_audits_audit_kind_check,
    DROP CONSTRAINT IF EXISTS topical_audits_run_status_check;

ALTER TABLE public.topical_audits
    ADD CONSTRAINT topical_audits_audit_kind_check
        CHECK (audit_kind IN ('customer', 'prospect')),
    ADD CONSTRAINT topical_audits_run_status_check
        CHECK (run_status IN ('running', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_topical_audits_brand_completed
    ON public.topical_audits(brand_id, completed_at DESC)
    WHERE run_status = 'completed';
CREATE INDEX IF NOT EXISTS idx_topical_audits_creator
    ON public.topical_audits(created_by_user_id, created_at DESC);
WITH duplicate_running AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY user_id, brand_id
               ORDER BY started_at DESC, created_at DESC
           ) AS run_rank
    FROM public.topical_audits
    WHERE run_status = 'running' AND brand_id IS NOT NULL
)
UPDATE public.topical_audits ta
SET
    run_status = 'failed',
    generation_status = 'failed',
    generation_phase = NULL,
    failure_code = 'superseded_running_legacy',
    failed_at = now(),
    updated_at = now()
FROM duplicate_running duplicate
WHERE duplicate.id = ta.id AND duplicate.run_rank > 1;
CREATE UNIQUE INDEX IF NOT EXISTS topical_audits_one_running_customer
    ON public.topical_audits(user_id, brand_id)
    WHERE run_status = 'running' AND brand_id IS NOT NULL;

ALTER TABLE public.brand_details
    ADD COLUMN IF NOT EXISTS current_audit_id UUID;

UPDATE public.brand_details b
SET current_audit_id = (
    SELECT ta.id
    FROM public.topical_audits ta
    WHERE ta.brand_id = b.id AND ta.run_status = 'completed'
    ORDER BY ta.completed_at DESC NULLS LAST, ta.updated_at DESC
    LIMIT 1
)
WHERE b.current_audit_id IS NULL
  AND EXISTS (
      SELECT 1
      FROM public.topical_audits ta
      WHERE ta.brand_id = b.id AND ta.run_status = 'completed'
  );

ALTER TABLE public.brand_details
    DROP CONSTRAINT IF EXISTS brand_details_current_audit_id_fkey,
    ADD CONSTRAINT brand_details_current_audit_id_fkey
        FOREIGN KEY (current_audit_id) REFERENCES public.topical_audits(id)
        ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- ---------------------------------------------------------------------------
-- Scope every closed-pool row to one immutable audit.
-- ---------------------------------------------------------------------------
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS audit_id UUID;
ALTER TABLE public.audit_clusters ADD COLUMN IF NOT EXISTS audit_id UUID;
ALTER TABLE public.planned_articles ADD COLUMN IF NOT EXISTS audit_id UUID;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS audit_id UUID;

UPDATE public.query_pool q
SET audit_id = COALESCE(
    (SELECT b.current_audit_id FROM public.brand_details b WHERE b.id = q.brand_id),
    (SELECT ta.id FROM public.topical_audits ta WHERE ta.brand_id = q.brand_id ORDER BY ta.created_at DESC LIMIT 1)
)
WHERE q.audit_id IS NULL;

UPDATE public.audit_clusters c
SET audit_id = COALESCE(
    (SELECT b.current_audit_id FROM public.brand_details b WHERE b.id = c.brand_id),
    (SELECT ta.id FROM public.topical_audits ta WHERE ta.brand_id = c.brand_id ORDER BY ta.created_at DESC LIMIT 1)
)
WHERE c.audit_id IS NULL;

UPDATE public.planned_articles a
SET audit_id = COALESCE(
    (SELECT c.audit_id FROM public.audit_clusters c WHERE c.id = a.cluster_id),
    (SELECT b.current_audit_id FROM public.brand_details b WHERE b.id = a.brand_id)
)
WHERE a.audit_id IS NULL;

UPDATE public.programs p
SET audit_id = COALESCE(
    (SELECT b.current_audit_id FROM public.brand_details b WHERE b.id = p.brand_id),
    (SELECT ta.id FROM public.topical_audits ta WHERE ta.brand_id = p.brand_id ORDER BY ta.created_at DESC LIMIT 1)
)
WHERE p.audit_id IS NULL;

ALTER TABLE public.query_pool
    DROP CONSTRAINT IF EXISTS query_pool_brand_id_query_norm_key,
    DROP CONSTRAINT IF EXISTS query_pool_audit_id_fkey,
    ADD CONSTRAINT query_pool_audit_id_fkey
        FOREIGN KEY (audit_id) REFERENCES public.topical_audits(id) ON DELETE RESTRICT;
ALTER TABLE public.audit_clusters
    DROP CONSTRAINT IF EXISTS audit_clusters_audit_id_fkey,
    ADD CONSTRAINT audit_clusters_audit_id_fkey
        FOREIGN KEY (audit_id) REFERENCES public.topical_audits(id) ON DELETE RESTRICT;
ALTER TABLE public.planned_articles
    DROP CONSTRAINT IF EXISTS planned_articles_audit_id_fkey,
    DROP CONSTRAINT IF EXISTS planned_articles_cluster_id_fkey,
    ADD CONSTRAINT planned_articles_audit_id_fkey
        FOREIGN KEY (audit_id) REFERENCES public.topical_audits(id) ON DELETE RESTRICT,
    ADD CONSTRAINT planned_articles_cluster_id_fkey
        FOREIGN KEY (cluster_id) REFERENCES public.audit_clusters(id) ON DELETE RESTRICT;
ALTER TABLE public.programs
    DROP CONSTRAINT IF EXISTS programs_audit_id_fkey,
    ADD CONSTRAINT programs_audit_id_fkey
        FOREIGN KEY (audit_id) REFERENCES public.topical_audits(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS query_pool_audit_query_norm_key
    ON public.query_pool(audit_id, query_norm);
CREATE INDEX IF NOT EXISTS idx_query_pool_audit_status
    ON public.query_pool(audit_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_clusters_audit_priority
    ON public.audit_clusters(audit_id, priority);
CREATE INDEX IF NOT EXISTS idx_planned_articles_audit
    ON public.planned_articles(audit_id, cluster_id);

-- The production migration is expected to have a corresponding audit for every
-- existing closed-pool row. Fail loudly instead of silently orphaning history.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.query_pool WHERE audit_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.audit_clusters WHERE audit_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.planned_articles WHERE audit_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.programs WHERE audit_id IS NULL) THEN
        RAISE EXCEPTION 'Closed-pool rows without an audit remain. Repair those rows before applying v2.';
    END IF;
END $$;

ALTER TABLE public.query_pool ALTER COLUMN audit_id SET NOT NULL;
ALTER TABLE public.audit_clusters ALTER COLUMN audit_id SET NOT NULL;
ALTER TABLE public.planned_articles ALTER COLUMN audit_id SET NOT NULL;
ALTER TABLE public.programs ALTER COLUMN audit_id SET NOT NULL;

-- Prospect audits intentionally have no customer brand until they are claimed.
-- Audit ownership is authoritative for these rows.
ALTER TABLE public.query_pool ALTER COLUMN brand_id DROP NOT NULL;
ALTER TABLE public.audit_clusters ALTER COLUMN brand_id DROP NOT NULL;
ALTER TABLE public.planned_articles ALTER COLUMN brand_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_completed_audit_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF OLD.run_status = 'completed' AND (
        NEW.subject_url IS DISTINCT FROM OLD.subject_url
        OR NEW.input_seeds IS DISTINCT FROM OLD.input_seeds
        OR NEW.input_competitors IS DISTINCT FROM OLD.input_competitors
        OR NEW.brand_snapshot IS DISTINCT FROM OLD.brand_snapshot
        OR NEW.harvest_policy_version IS DISTINCT FROM OLD.harvest_policy_version
        OR NEW.result_hash IS DISTINCT FROM OLD.result_hash
        OR NEW.pool_size IS DISTINCT FROM OLD.pool_size
        OR NEW.article_count IS DISTINCT FROM OLD.article_count
        OR NEW.cluster_count IS DISTINCT FROM OLD.cluster_count
        OR NEW.authority_score IS DISTINCT FROM OLD.authority_score
        OR NEW.source_call_ledger IS DISTINCT FROM OLD.source_call_ledger
        OR NEW.site_page_snapshot IS DISTINCT FROM OLD.site_page_snapshot
        OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
    ) THEN
        RAISE EXCEPTION 'Completed audit evidence is immutable';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_completed_audit_run_trigger ON public.topical_audits;
CREATE TRIGGER guard_completed_audit_run_trigger
    BEFORE UPDATE ON public.topical_audits
    FOR EACH ROW EXECUTE FUNCTION public.guard_completed_audit_run();

CREATE OR REPLACE FUNCTION public.guard_audit_snapshot_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
    v_audit_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_audit_id := NEW.audit_id;
    ELSE
        v_audit_id := OLD.audit_id;
    END IF;

    SELECT run_status INTO v_status
    FROM public.topical_audits
    WHERE id = v_audit_id;

    IF TG_OP = 'INSERT' AND v_status <> 'running' THEN
        RAISE EXCEPTION 'Evidence rows may only be inserted while an audit is running';
    END IF;
    IF TG_OP = 'DELETE' AND v_status = 'completed' THEN
        RAISE EXCEPTION 'Completed audit evidence cannot be deleted';
    END IF;
    IF TG_OP = 'UPDATE' AND v_status = 'completed' THEN
        IF TG_TABLE_NAME = 'query_pool' AND (
            NEW.audit_id IS DISTINCT FROM OLD.audit_id
            OR NEW.query IS DISTINCT FROM OLD.query
            OR NEW.query_norm IS DISTINCT FROM OLD.query_norm
            OR NEW.source IS DISTINCT FROM OLD.source
            OR NEW.source_url IS DISTINCT FROM OLD.source_url
            OR NEW.source_seed IS DISTINCT FROM OLD.source_seed
            OR NEW.observed_value IS DISTINCT FROM OLD.observed_value
            OR NEW.observed_at IS DISTINCT FROM OLD.observed_at
            OR NEW.embedding IS DISTINCT FROM OLD.embedding
            OR NEW.status IS DISTINCT FROM OLD.status
            OR NEW.covered_by_url IS DISTINCT FROM OLD.covered_by_url
            OR NEW.covered_by_title IS DISTINCT FROM OLD.covered_by_title
            OR NEW.coverage_similarity IS DISTINCT FROM OLD.coverage_similarity
            OR NEW.competitor_matches IS DISTINCT FROM OLD.competitor_matches
        ) THEN
            RAISE EXCEPTION 'Completed query evidence is immutable';
        ELSIF TG_TABLE_NAME = 'audit_clusters' AND (
            NEW.audit_id IS DISTINCT FROM OLD.audit_id
            OR NEW.name IS DISTINCT FROM OLD.name
            OR NEW.description IS DISTINCT FROM OLD.description
            OR NEW.priority IS DISTINCT FROM OLD.priority
            OR NEW.article_count IS DISTINCT FROM OLD.article_count
            OR NEW.competitor_urls IS DISTINCT FROM OLD.competitor_urls
        ) THEN
            RAISE EXCEPTION 'Completed cluster evidence is immutable';
        ELSIF TG_TABLE_NAME = 'planned_articles' AND (
            NEW.audit_id IS DISTINCT FROM OLD.audit_id
            OR NEW.cluster_id IS DISTINCT FROM OLD.cluster_id
            OR NEW.title IS DISTINCT FROM OLD.title
            OR NEW.main_keyword IS DISTINCT FROM OLD.main_keyword
            OR NEW.supporting_keywords IS DISTINCT FROM OLD.supporting_keywords
            OR NEW.source_query_ids IS DISTINCT FROM OLD.source_query_ids
            OR NEW.article_type IS DISTINCT FROM OLD.article_type
            OR NEW.intent_role IS DISTINCT FROM OLD.intent_role
            OR NEW.is_pillar IS DISTINCT FROM OLD.is_pillar
        ) THEN
            RAISE EXCEPTION 'Completed planned scope is immutable';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_query_pool_snapshot ON public.query_pool;
CREATE TRIGGER guard_query_pool_snapshot
    BEFORE INSERT OR UPDATE OR DELETE ON public.query_pool
    FOR EACH ROW EXECUTE FUNCTION public.guard_audit_snapshot_row();
DROP TRIGGER IF EXISTS guard_audit_clusters_snapshot ON public.audit_clusters;
CREATE TRIGGER guard_audit_clusters_snapshot
    BEFORE INSERT OR UPDATE OR DELETE ON public.audit_clusters
    FOR EACH ROW EXECUTE FUNCTION public.guard_audit_snapshot_row();
DROP TRIGGER IF EXISTS guard_planned_articles_snapshot ON public.planned_articles;
CREATE TRIGGER guard_planned_articles_snapshot
    BEFORE INSERT OR UPDATE OR DELETE ON public.planned_articles
    FOR EACH ROW EXECUTE FUNCTION public.guard_audit_snapshot_row();

-- ---------------------------------------------------------------------------
-- Separate generation, delivery, and publication.
-- ---------------------------------------------------------------------------
ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS slug TEXT,
    ADD COLUMN IF NOT EXISTS target_url TEXT,
    ADD COLUMN IF NOT EXISTS generation_status TEXT NOT NULL DEFAULT 'planned',
    ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'withheld',
    ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'unpublished',
    ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS publication_url TEXT,
    ADD COLUMN IF NOT EXISTS generation_error TEXT,
    ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.planned_articles pa
SET
    generation_status = CASE pa.status
        WHEN 'writing' THEN 'generating'
        WHEN 'published' THEN 'generated'
        WHEN 'failed' THEN 'failed'
        WHEN 'scheduled' THEN 'queued'
        ELSE 'planned'
    END,
    delivery_status = CASE
        WHEN pa.status = 'published' THEN 'delivered'
        ELSE 'withheld'
    END,
    publication_status = CASE
        WHEN EXISTS (
            SELECT 1 FROM public.articles a
            WHERE a.id = pa.article_id
              AND a.published_at IS NOT NULL
              AND a.wordpress_post_url IS NOT NULL
        ) THEN 'published'
        ELSE 'unpublished'
    END,
    generated_at = CASE WHEN pa.status = 'published' THEN COALESCE(pa.shipped_at, pa.updated_at) END,
    delivered_at = CASE WHEN pa.status = 'published' THEN COALESCE(pa.shipped_at, pa.updated_at) END,
    published_at = (
        SELECT a.published_at FROM public.articles a WHERE a.id = pa.article_id
    ),
    publication_url = (
        SELECT a.wordpress_post_url FROM public.articles a WHERE a.id = pa.article_id
    );

ALTER TABLE public.planned_articles
    DROP CONSTRAINT IF EXISTS planned_articles_status_check,
    DROP CONSTRAINT IF EXISTS planned_articles_generation_status_check,
    DROP CONSTRAINT IF EXISTS planned_articles_delivery_status_check,
    DROP CONSTRAINT IF EXISTS planned_articles_publication_status_check,
    ADD CONSTRAINT planned_articles_status_check
        CHECK (status IN ('pending', 'scheduled', 'writing', 'published', 'failed', 'skipped', 'delivered')),
    ADD CONSTRAINT planned_articles_generation_status_check
        CHECK (generation_status IN ('planned', 'queued', 'generating', 'generated', 'failed')),
    ADD CONSTRAINT planned_articles_delivery_status_check
        CHECK (delivery_status IN ('withheld', 'delivered')),
    ADD CONSTRAINT planned_articles_publication_status_check
        CHECK (publication_status IN ('unpublished', 'draft', 'published'));

CREATE UNIQUE INDEX IF NOT EXISTS planned_articles_audit_slug_key
    ON public.planned_articles(audit_id, slug) WHERE slug IS NOT NULL;

ALTER TABLE public.articles
    ADD COLUMN IF NOT EXISTS planned_article_id UUID,
    ADD COLUMN IF NOT EXISTS delivery_visible_at TIMESTAMPTZ;
ALTER TABLE public.articles
    DROP CONSTRAINT IF EXISTS articles_planned_article_id_fkey,
    ADD CONSTRAINT articles_planned_article_id_fkey
        FOREIGN KEY (planned_article_id) REFERENCES public.planned_articles(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS articles_planned_article_key
    ON public.articles(planned_article_id) WHERE planned_article_id IS NOT NULL;

UPDATE public.articles a
SET delivery_visible_at = COALESCE(delivery_visible_at, created_at)
WHERE planned_article_id IS NULL;

DROP POLICY IF EXISTS "Users can view own articles" ON public.articles;
CREATE POLICY "Users can view delivered own articles"
    ON public.articles FOR SELECT
    USING (
        auth.uid() = user_id
        AND (planned_article_id IS NULL OR delivery_visible_at IS NOT NULL)
    );
DROP POLICY IF EXISTS "Users can insert own articles" ON public.articles;
DROP POLICY IF EXISTS "Users can update own articles" ON public.articles;
DROP POLICY IF EXISTS "Users can delete own articles" ON public.articles;

-- Closed-pool evidence and lifecycle rows are customer-readable but mutate only
-- through service-role transactions/RPCs. The v1 FOR ALL policies would let a
-- browser rewrite delivery/publication status or delete purchased scope.
DROP POLICY IF EXISTS "Users manage own query_pool" ON public.query_pool;
DROP POLICY IF EXISTS "Users manage own audit_clusters" ON public.audit_clusters;
DROP POLICY IF EXISTS "Users manage own planned_articles" ON public.planned_articles;
DROP POLICY IF EXISTS "Users manage own programs" ON public.programs;

CREATE POLICY "Users read own query pool"
    ON public.query_pool FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own audit clusters"
    ON public.audit_clusters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own planned articles"
    ON public.planned_articles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own programs"
    ON public.programs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own audits" ON public.topical_audits;
DROP POLICY IF EXISTS "Users can update own audits" ON public.topical_audits;

-- ---------------------------------------------------------------------------
-- Purchase intents and finite normalized programs.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_purchase_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE RESTRICT,
    audit_id UUID NOT NULL REFERENCES public.topical_audits(id) ON DELETE RESTRICT,
    pricing_plan_id UUID NOT NULL REFERENCES public.dodo_pricing_plans(id) ON DELETE RESTRICT,
    tier TEXT NOT NULL CHECK (tier IN ('close', 'accelerate', 'dominate')),
    cluster_ids UUID[] NOT NULL,
    publication_url_pattern TEXT NOT NULL,
    graph_snapshot JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'checkout_created', 'provisioned', 'expired', 'cancelled')),
    checkout_session_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    provisioned_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_purchase_intents_user_status
    ON public.program_purchase_intents(user_id, status, created_at DESC);

ALTER TABLE public.programs
    ADD COLUMN IF NOT EXISTS purchase_intent_id UUID,
    ADD COLUMN IF NOT EXISTS dodo_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS publication_url_pattern TEXT,
    ADD COLUMN IF NOT EXISTS scope_status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS cancellation_status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS cancellation_error TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancellation_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS pending_tier TEXT;

ALTER TABLE public.programs
    DROP CONSTRAINT IF EXISTS programs_purchase_intent_id_fkey,
    DROP CONSTRAINT IF EXISTS programs_scope_status_check,
    DROP CONSTRAINT IF EXISTS programs_cancellation_status_check,
    ADD CONSTRAINT programs_purchase_intent_id_fkey
        FOREIGN KEY (purchase_intent_id) REFERENCES public.program_purchase_intents(id) ON DELETE RESTRICT,
    ADD CONSTRAINT programs_scope_status_check
        CHECK (scope_status IN ('active', 'paused', 'scope_delivered', 'cancelled')),
    ADD CONSTRAINT programs_cancellation_status_check
        CHECK (cancellation_status IN ('active', 'request_pending', 'scheduled', 'ended', 'error'));

CREATE UNIQUE INDEX IF NOT EXISTS programs_purchase_intent_key
    ON public.programs(purchase_intent_id) WHERE purchase_intent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS programs_dodo_subscription_key
    ON public.programs(dodo_subscription_id) WHERE dodo_subscription_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_brand_audit_subject()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_old_host TEXT;
    v_new_host TEXT;
BEGIN
    v_old_host := lower(split_part(
        regexp_replace(COALESCE(OLD.website_url, ''), '^https?://(www\.)?', '', 'i'),
        '/',
        1
    ));
    v_new_host := lower(split_part(
        regexp_replace(COALESCE(NEW.website_url, ''), '^https?://(www\.)?', '', 'i'),
        '/',
        1
    ));

    IF v_new_host IS DISTINCT FROM v_old_host THEN
        IF EXISTS (
            SELECT 1
            FROM public.programs p
            WHERE p.brand_id = OLD.id
              AND p.scope_status IN ('active', 'paused')
        ) THEN
            RAISE EXCEPTION
                'The website cannot change while a finite program is active or paused';
        END IF;
        -- A completed audit describes the previous subject and must never be
        -- presented as the current audit for a replacement website.
        NEW.current_audit_id := NULL;
    END IF;

    IF NEW.deleted_at IS NOT NULL
       AND OLD.deleted_at IS NULL
       AND EXISTS (
            SELECT 1
            FROM public.programs p
            WHERE p.brand_id = OLD.id
              AND p.scope_status IN ('active', 'paused')
       ) THEN
        RAISE EXCEPTION
            'The website cannot be archived while a finite program is active or paused';
    END IF;

    IF NEW.current_audit_id IS NOT NULL
       AND NEW.current_audit_id IS DISTINCT FROM OLD.current_audit_id
       AND NOT EXISTS (
            SELECT 1
            FROM public.topical_audits ta
            WHERE ta.id = NEW.current_audit_id
              AND ta.brand_id = NEW.id
              AND ta.user_id = NEW.user_id
              AND ta.run_status = 'completed'
       ) THEN
        RAISE EXCEPTION
            'The current audit must be a completed immutable run owned by this website';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_brand_audit_subject_trigger ON public.brand_details;
CREATE TRIGGER guard_brand_audit_subject_trigger
    BEFORE UPDATE OF website_url, deleted_at, current_audit_id
    ON public.brand_details
    FOR EACH ROW EXECUTE FUNCTION public.guard_brand_audit_subject();

CREATE TABLE IF NOT EXISTS public.program_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
    audit_cluster_id UUID NOT NULL REFERENCES public.audit_clusters(id) ON DELETE RESTRICT,
    sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 6),
    scheduled_for TIMESTAMPTZ NOT NULL,
    state TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (state IN ('scheduled', 'generating', 'blocked', 'ready', 'delivered')),
    generation_started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failure_code TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(program_id, audit_cluster_id),
    UNIQUE(program_id, sequence)
);
CREATE UNIQUE INDEX IF NOT EXISTS program_clusters_sold_once
    ON public.program_clusters(audit_cluster_id);
CREATE INDEX IF NOT EXISTS idx_program_clusters_due
    ON public.program_clusters(state, scheduled_for);

-- Backfill existing program arrays without changing delivery history.
INSERT INTO public.program_clusters (
    program_id, audit_cluster_id, sequence, scheduled_for, state, delivered_at
)
SELECT
    p.id,
    cluster_id,
    ordinality::INTEGER,
    COALESCE(
        (
            SELECT MIN(pa.scheduled_date)::timestamptz
            FROM public.planned_articles pa
            WHERE pa.cluster_id = cluster_id
        ),
        p.started_at + ((ordinality - 1) * interval '30 days')
    ),
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM public.planned_articles pa
            WHERE pa.cluster_id = cluster_id AND pa.delivery_status <> 'delivered'
        ) THEN 'delivered'
        ELSE 'blocked'
    END,
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM public.planned_articles pa
            WHERE pa.cluster_id = cluster_id AND pa.delivery_status <> 'delivered'
        ) THEN COALESCE(p.completed_at, p.updated_at)
    END
FROM public.programs p
CROSS JOIN LATERAL unnest(p.clusters_included) WITH ORDINALITY AS included(cluster_id, ordinality)
WHERE ordinality <= 6
ON CONFLICT DO NOTHING;

UPDATE public.programs p
SET
    scope_status = 'paused',
    status = 'paused',
    paused_at = COALESCE(p.paused_at, now()),
    updated_at = now()
WHERE EXISTS (
    SELECT 1
    FROM public.topical_audits ta
    WHERE ta.id = p.audit_id AND ta.requires_reaudit
)
AND EXISTS (
    SELECT 1
    FROM public.program_clusters pc
    WHERE pc.program_id = p.id AND pc.state <> 'delivered'
);

-- ---------------------------------------------------------------------------
-- Frozen graph
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planned_article_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
    source_article_id UUID NOT NULL REFERENCES public.planned_articles(id) ON DELETE RESTRICT,
    target_article_id UUID REFERENCES public.planned_articles(id) ON DELETE RESTRICT,
    target_url TEXT NOT NULL,
    anchor_text TEXT NOT NULL,
    relationship TEXT NOT NULL
        CHECK (relationship IN ('pillar_to_leaf', 'leaf_to_pillar', 'sibling', 'existing_page')),
    graph_version TEXT NOT NULL DEFAULT 'frozen-graph-v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (target_article_id IS NULL OR target_article_id <> source_article_id),
    UNIQUE(program_id, source_article_id, target_url)
);
CREATE INDEX IF NOT EXISTS idx_planned_article_links_source
    ON public.planned_article_links(source_article_id);

-- ---------------------------------------------------------------------------
-- Billing-period idempotency and article consumption.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_period_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dodo_subscription_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_id UUID REFERENCES public.programs(id) ON DELETE RESTRICT,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ,
    allowance INTEGER NOT NULL CHECK (allowance >= 0),
    source_event_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(dodo_subscription_id, period_start)
);

CREATE TABLE IF NOT EXISTS public.subscription_credit_consumptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id UUID NOT NULL REFERENCES public.subscription_period_grants(id) ON DELETE RESTRICT,
    planned_article_id UUID NOT NULL REFERENCES public.planned_articles(id) ON DELETE RESTRICT,
    consumed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(planned_article_id)
);

CREATE TABLE IF NOT EXISTS public.program_cost_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
    program_cluster_id UUID NOT NULL REFERENCES public.program_clusters(id) ON DELETE RESTRICT,
    planned_article_id UUID NOT NULL REFERENCES public.planned_articles(id) ON DELETE RESTRICT,
    article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    operation TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count >= 0),
    input_units BIGINT NOT NULL DEFAULT 0 CHECK (input_units >= 0),
    output_units BIGINT NOT NULL DEFAULT 0 CHECK (output_units >= 0),
    usage_complete BOOLEAN NOT NULL DEFAULT TRUE,
    cost_usd NUMERIC(14, 8),
    pricing_source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_program_cost_events_program
    ON public.program_cost_events(program_id, created_at);
ALTER TABLE public.program_cost_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Email-bound audit claims.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL UNIQUE REFERENCES public.topical_audits(id) ON DELETE RESTRICT,
    claim_token_hash TEXT NOT NULL UNIQUE,
    claim_email_normalized TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.create_prospect_audit(
    p_creator_user_id UUID,
    p_subject_url TEXT,
    p_input_seeds TEXT[],
    p_input_competitors TEXT[],
    p_brand_snapshot JSONB,
    p_policy_version TEXT,
    p_public_token TEXT,
    p_claim_token_hash TEXT,
    p_claim_email_normalized TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO public.topical_audits (
        user_id, brand_id, subject_url, input_seeds, input_competitors,
        brand_snapshot, audit_kind, created_by_user_id, run_status,
        generation_status, generation_phase, harvest_policy_version,
        public_token
    ) VALUES (
        p_creator_user_id, NULL, p_subject_url, p_input_seeds,
        p_input_competitors, p_brand_snapshot, 'prospect', p_creator_user_id,
        'running', 'running', 'queued', p_policy_version, p_public_token
    )
    RETURNING id INTO v_audit_id;

    INSERT INTO public.audit_claims (
        audit_id, claim_token_hash, claim_email_normalized
    ) VALUES (
        v_audit_id, p_claim_token_hash, lower(trim(p_claim_email_normalized))
    );

    RETURN v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_prospect_audit(
    UUID, TEXT, TEXT[], TEXT[], JSONB, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_prospect_audit(
    UUID, TEXT, TEXT[], TEXT[], JSONB, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_prospect_audit(
    p_claim_token_hash TEXT
)
RETURNS TABLE(audit_id UUID, brand_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_claim public.audit_claims%ROWTYPE;
    v_audit public.topical_audits%ROWTYPE;
    v_brand_id UUID;
    v_user_id UUID := auth.uid();
    v_email TEXT := lower(trim(COALESCE(auth.jwt()->>'email', '')));
    v_subject_host TEXT;
    v_existing_host TEXT;
    v_brand_count INTEGER;
BEGIN
    IF v_user_id IS NULL OR v_email = '' THEN
        RAISE EXCEPTION 'Authentication with a verified email is required';
    END IF;

    SELECT * INTO v_claim
    FROM public.audit_claims
    WHERE claim_token_hash = p_claim_token_hash
    FOR UPDATE;

    IF NOT FOUND
       OR v_claim.revoked_at IS NOT NULL
       OR v_claim.claimed_at IS NOT NULL
       OR v_claim.expires_at <= now() THEN
        RAISE EXCEPTION 'Claim token is invalid, expired, or already used';
    END IF;
    IF v_email <> v_claim.claim_email_normalized THEN
        RAISE EXCEPTION 'This audit was prepared for another email address';
    END IF;

    SELECT * INTO v_audit
    FROM public.topical_audits
    WHERE id = v_claim.audit_id
      AND audit_kind = 'prospect'
      AND run_status = 'completed'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Prospect audit is not claimable'; END IF;

    v_subject_host := lower(
        split_part(
            regexp_replace(v_audit.subject_url, '^https?://(www\.)?', '', 'i'),
            '/',
            1
        )
    );

    SELECT COUNT(*) INTO v_brand_count
    FROM public.brand_details
    WHERE user_id = v_user_id;

    SELECT id,
           lower(split_part(regexp_replace(website_url, '^https?://(www\.)?', '', 'i'), '/', 1))
    INTO v_brand_id, v_existing_host
    FROM public.brand_details
    WHERE user_id = v_user_id
      AND lower(split_part(regexp_replace(website_url, '^https?://(www\.)?', '', 'i'), '/', 1))
          = v_subject_host
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE;

    IF v_brand_id IS NULL AND v_brand_count > 0 THEN
        RAISE EXCEPTION 'Your existing brand belongs to another website';
    END IF;

    IF v_brand_id IS NULL THEN
        INSERT INTO public.brand_details(user_id, website_url, brand_data)
        VALUES (v_user_id, v_audit.subject_url, v_audit.brand_snapshot)
        RETURNING id INTO v_brand_id;
    END IF;

    UPDATE public.topical_audits
    SET user_id = v_user_id, brand_id = v_brand_id, updated_at = now()
    WHERE id = v_audit.id;
    UPDATE public.query_pool
    SET user_id = v_user_id, brand_id = v_brand_id
    WHERE audit_id = v_audit.id;
    UPDATE public.audit_clusters
    SET user_id = v_user_id, brand_id = v_brand_id
    WHERE audit_id = v_audit.id;
    UPDATE public.planned_articles
    SET user_id = v_user_id, brand_id = v_brand_id, updated_at = now()
    WHERE audit_id = v_audit.id;
    UPDATE public.brand_details
    SET current_audit_id = v_audit.id, updated_at = now()
    WHERE id = v_brand_id;
    UPDATE public.audit_claims
    SET claimed_by_user_id = v_user_id, claimed_at = now()
    WHERE id = v_claim.id;

    audit_id := v_audit.id;
    brand_id := v_brand_id;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_prospect_audit(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_prospect_audit(TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS for new tables. Mutation is server-side; users can read owned programs.
-- ---------------------------------------------------------------------------
ALTER TABLE public.program_purchase_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planned_article_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_period_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_credit_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own purchase intents"
    ON public.program_purchase_intents FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY "Users read own program clusters"
    ON public.program_clusters FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.programs p
        WHERE p.id = program_clusters.program_id AND p.user_id = auth.uid()
    ));
CREATE POLICY "Users read own frozen links"
    ON public.planned_article_links FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.programs p
        WHERE p.id = planned_article_links.program_id AND p.user_id = auth.uid()
    ));
CREATE POLICY "Users read own period grants"
    ON public.subscription_period_grants FOR SELECT
    USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Atomic immutable-run publication.
-- Rows are supplied as JSON because Supabase RPC is the transaction boundary.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_audit_run(
    p_audit_id UUID,
    p_query_rows JSONB,
    p_cluster_rows JSONB,
    p_article_rows JSONB,
    p_statistics JSONB,
    p_result_hash TEXT,
    p_policy_version TEXT,
    p_source_call_ledger JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_audit public.topical_audits%ROWTYPE;
    item JSONB;
BEGIN
    SELECT * INTO v_audit
    FROM public.topical_audits
    WHERE id = p_audit_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Audit run not found'; END IF;
    IF v_audit.run_status <> 'running' THEN
        RAISE EXCEPTION 'Only running audits can be finalized';
    END IF;
    IF jsonb_array_length(p_query_rows) = 0 THEN
        RAISE EXCEPTION 'Audit query pool cannot be empty';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_query_rows) q
        WHERE COALESCE(q->>'source_url', '') = ''
           OR COALESCE(q->>'observed_value', '') = ''
    ) THEN
        RAISE EXCEPTION 'Every query must contain provenance';
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(p_query_rows)
    LOOP
        INSERT INTO public.query_pool (
            id, audit_id, user_id, brand_id, query, query_norm, source,
            source_url, source_seed, observed_value, observed_at, embedding,
            status, covered_by_url, covered_by_title, coverage_similarity,
            competitor_matches
        ) VALUES (
            (item->>'id')::uuid,
            p_audit_id,
            v_audit.user_id,
            v_audit.brand_id,
            item->>'query',
            item->>'query_norm',
            item->>'source',
            item->>'source_url',
            NULLIF(item->>'source_seed', ''),
            item->>'observed_value',
            COALESCE((item->>'observed_at')::timestamptz, now()),
            CASE WHEN item ? 'embedding' THEN (item->'embedding')::text::vector ELSE NULL END,
            COALESCE(item->>'status', 'unknown'),
            NULLIF(item->>'covered_by_url', ''),
            NULLIF(item->>'covered_by_title', ''),
            NULLIF(item->>'coverage_similarity', '')::real,
            COALESCE(item->'competitor_matches', '[]'::jsonb)
        );
    END LOOP;

    FOR item IN SELECT * FROM jsonb_array_elements(p_cluster_rows)
    LOOP
        INSERT INTO public.audit_clusters (
            id, audit_id, user_id, brand_id, name, description,
            priority, article_count, competitor_urls
        ) VALUES (
            (item->>'id')::uuid,
            p_audit_id,
            v_audit.user_id,
            v_audit.brand_id,
            item->>'name',
            NULLIF(item->>'description', ''),
            COALESCE((item->>'priority')::integer, 100),
            COALESCE((item->>'article_count')::integer, 0),
            COALESCE(item->'competitor_urls', '[]'::jsonb)
        );
    END LOOP;

    FOR item IN SELECT * FROM jsonb_array_elements(p_article_rows)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.audit_clusters c
            WHERE c.id = (item->>'cluster_id')::uuid AND c.audit_id = p_audit_id
        ) THEN
            RAISE EXCEPTION 'Article references a cluster outside its audit';
        END IF;

        INSERT INTO public.planned_articles (
            id, audit_id, user_id, brand_id, cluster_id, title, main_keyword,
            supporting_keywords, source_query_ids, article_type, intent_role,
            is_pillar, slug, target_url, generation_status, delivery_status,
            publication_status
        ) VALUES (
            (item->>'id')::uuid,
            p_audit_id,
            v_audit.user_id,
            v_audit.brand_id,
            (item->>'cluster_id')::uuid,
            item->>'title',
            item->>'main_keyword',
            ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'supporting_keywords', '[]'::jsonb))),
            ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'source_query_ids', '[]'::jsonb)))::uuid[],
            COALESCE(item->>'article_type', 'informational'),
            NULLIF(item->>'intent_role', ''),
            COALESCE((item->>'is_pillar')::boolean, FALSE),
            NULLIF(item->>'slug', ''),
            NULLIF(item->>'target_url', ''),
            'planned',
            'withheld',
            'unpublished'
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM public.planned_articles pa
        CROSS JOIN LATERAL unnest(pa.source_query_ids) query_id
        LEFT JOIN public.query_pool qp
          ON qp.id = query_id AND qp.audit_id = p_audit_id
        WHERE pa.audit_id = p_audit_id
          AND qp.id IS NULL
    ) THEN
        RAISE EXCEPTION 'An article references a query outside its audit';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.audit_clusters c
        LEFT JOIN public.planned_articles pa
          ON pa.cluster_id = c.id AND pa.audit_id = p_audit_id
        WHERE c.audit_id = p_audit_id
        GROUP BY c.id, c.article_count
        HAVING COUNT(pa.id) <> c.article_count
            OR COUNT(pa.id) > 15
    ) THEN
        RAISE EXCEPTION 'Cluster article counts do not match the persisted scope';
    END IF;

    UPDATE public.topical_audits
    SET
        pool_size = COALESCE((p_statistics->>'pool_size')::integer, jsonb_array_length(p_query_rows)),
        article_count = COALESCE((p_statistics->>'article_count')::integer, jsonb_array_length(p_article_rows)),
        cluster_count = COALESCE((p_statistics->>'cluster_count')::integer, jsonb_array_length(p_cluster_rows)),
        authority_score = COALESCE((p_statistics->>'authority_score')::integer, 0),
        competitors_scanned = COALESCE((p_statistics->>'competitors_scanned')::integer, 0),
        user_pages_scanned = COALESCE((p_statistics->>'user_pages_scanned')::integer, 0),
        result_hash = p_result_hash,
        harvest_policy_version = p_policy_version,
        source_call_ledger = COALESCE(p_source_call_ledger, '[]'::jsonb),
        site_page_snapshot = COALESCE(p_statistics->'site_page_snapshot', '[]'::jsonb),
        generation_status = 'completed',
        generation_phase = 'completed',
        run_status = 'completed',
        completed_at = now(),
        updated_at = now(),
        requires_reaudit = FALSE
    WHERE id = p_audit_id;

    IF v_audit.brand_id IS NOT NULL THEN
        UPDATE public.brand_details
        SET current_audit_id = p_audit_id, updated_at = now()
        WHERE id = v_audit.brand_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_audit_run(
    UUID, JSONB, JSONB, JSONB, JSONB, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_audit_run(
    UUID, JSONB, JSONB, JSONB, JSONB, TEXT, TEXT, JSONB
) TO service_role;

-- ---------------------------------------------------------------------------
-- Atomic program provisioning from a frozen purchase intent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provision_program_from_intent(
    p_purchase_intent_id UUID,
    p_dodo_subscription_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_intent public.program_purchase_intents%ROWTYPE;
    v_program_id UUID;
    v_clusters_per_month INTEGER;
    v_total_articles INTEGER;
    v_cluster_id UUID;
    v_sequence INTEGER := 0;
    v_offset_days NUMERIC;
    item JSONB;
BEGIN
    SELECT * INTO v_intent
    FROM public.program_purchase_intents
    WHERE id = p_purchase_intent_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Purchase intent not found'; END IF;
    IF v_intent.status = 'provisioned' THEN
        SELECT id INTO v_program_id
        FROM public.programs
        WHERE purchase_intent_id = p_purchase_intent_id;
        RETURN v_program_id;
    END IF;
    IF v_intent.status <> 'checkout_created' THEN
        RAISE EXCEPTION 'Purchase intent is not checkout-ready';
    END IF;
    IF v_intent.expires_at <= now() THEN
        RAISE EXCEPTION 'Purchase intent has expired';
    END IF;
    IF cardinality(v_intent.cluster_ids) <> 6 THEN
        RAISE EXCEPTION 'A program must contain exactly six clusters';
    END IF;
    IF (
        SELECT COUNT(*)
        FROM public.audit_clusters c
        WHERE c.audit_id = v_intent.audit_id
          AND c.id = ANY(v_intent.cluster_ids)
          AND c.article_count BETWEEN 3 AND 15
    ) <> 6 THEN
        RAISE EXCEPTION 'Purchase intent contains an unqualified or foreign cluster';
    END IF;
    IF (
        SELECT COUNT(*)
        FROM public.planned_articles pa
        WHERE pa.audit_id = v_intent.audit_id
          AND pa.cluster_id = ANY(v_intent.cluster_ids)
    ) < 25 THEN
        RAISE EXCEPTION 'Purchase intent contains fewer than 25 articles';
    END IF;
    IF jsonb_array_length(COALESCE(v_intent.graph_snapshot->'articles', '[]'::jsonb))
       <> (
           SELECT COUNT(*)
           FROM public.planned_articles pa
           WHERE pa.audit_id = v_intent.audit_id
             AND pa.cluster_id = ANY(v_intent.cluster_ids)
       ) THEN
        RAISE EXCEPTION 'Frozen graph does not contain the complete selected scope';
    END IF;

    v_clusters_per_month := CASE v_intent.tier
        WHEN 'close' THEN 1
        WHEN 'accelerate' THEN 2
        WHEN 'dominate' THEN 4
        ELSE 0
    END;
    IF v_clusters_per_month = 0 THEN RAISE EXCEPTION 'Invalid velocity tier'; END IF;

    SELECT COUNT(*) INTO v_total_articles
    FROM public.planned_articles
    WHERE audit_id = v_intent.audit_id
      AND cluster_id = ANY(v_intent.cluster_ids);

    INSERT INTO public.programs (
        user_id, brand_id, audit_id, purchase_intent_id, dodo_subscription_id,
        publication_url_pattern, tier, clusters_per_month, clusters_included,
        total_articles, completed_count, status, scope_status, cancellation_status
    ) VALUES (
        v_intent.user_id, v_intent.brand_id, v_intent.audit_id, v_intent.id,
        p_dodo_subscription_id, v_intent.publication_url_pattern, v_intent.tier,
        v_clusters_per_month, v_intent.cluster_ids, v_total_articles, 0,
        'active', 'active', 'active'
    )
    RETURNING id INTO v_program_id;

    FOREACH v_cluster_id IN ARRAY v_intent.cluster_ids
    LOOP
        v_sequence := v_sequence + 1;
        v_offset_days := CASE v_intent.tier
            WHEN 'close' THEN (v_sequence - 1) * 30
            WHEN 'accelerate' THEN (v_sequence - 1) * 15
            ELSE floor((v_sequence - 1) * 7.5)
        END;

        INSERT INTO public.program_clusters (
            program_id, audit_cluster_id, sequence, scheduled_for, state
        ) VALUES (
            v_program_id,
            v_cluster_id,
            v_sequence,
            now() + (v_offset_days || ' days')::interval,
            'scheduled'
        );
    END LOOP;

    FOR item IN SELECT * FROM jsonb_array_elements(v_intent.graph_snapshot->'articles')
    LOOP
        UPDATE public.planned_articles
        SET
            slug = item->>'slug',
            target_url = item->>'targetUrl',
            generation_status = 'queued',
            updated_at = now()
        WHERE id = (item->>'id')::uuid
          AND audit_id = v_intent.audit_id;
    END LOOP;

    FOR item IN SELECT * FROM jsonb_array_elements(v_intent.graph_snapshot->'edges')
    LOOP
        INSERT INTO public.planned_article_links (
            program_id, source_article_id, target_article_id, target_url,
            anchor_text, relationship, graph_version
        ) VALUES (
            v_program_id,
            (item->>'sourceArticleId')::uuid,
            NULLIF(item->>'targetArticleId', '')::uuid,
            item->>'targetUrl',
            item->>'anchorText',
            item->>'relationship',
            COALESCE(v_intent.graph_snapshot->>'version', 'frozen-graph-v1')
        );
    END LOOP;

    UPDATE public.program_purchase_intents
    SET status = 'provisioned', provisioned_at = now()
    WHERE id = v_intent.id;

    RETURN v_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_program_from_intent(UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_program_from_intent(UUID, TEXT)
    TO service_role;

CREATE OR REPLACE FUNCTION public.grant_subscription_period(
    p_dodo_subscription_id TEXT,
    p_user_id UUID,
    p_program_id UUID,
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ,
    p_allowance INTEGER,
    p_source_event_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_grant_id UUID;
BEGIN
    INSERT INTO public.subscription_period_grants (
        dodo_subscription_id, user_id, program_id, period_start, period_end,
        allowance, source_event_id
    ) VALUES (
        p_dodo_subscription_id, p_user_id, p_program_id, p_period_start,
        p_period_end, p_allowance, p_source_event_id
    )
    ON CONFLICT (dodo_subscription_id, period_start) DO NOTHING
    RETURNING id INTO v_grant_id;

    IF v_grant_id IS NULL THEN RETURN FALSE; END IF;

    UPDATE public.credits SET credits = p_allowance WHERE user_id = p_user_id;
    IF NOT FOUND THEN
        INSERT INTO public.credits(user_id, credits) VALUES (p_user_id, p_allowance);
    END IF;
    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_subscription_period(
    TEXT, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_subscription_period(
    TEXT, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_program_credit(
    p_planned_article_id UUID,
    p_dodo_subscription_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_grant_id UUID;
    v_consumption_id UUID;
    v_allowance INTEGER;
    v_consumed INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.subscription_credit_consumptions
        WHERE planned_article_id = p_planned_article_id
    ) THEN
        RETURN TRUE;
    END IF;

    SELECT pa.user_id INTO v_user_id
    FROM public.planned_articles pa
    JOIN public.program_clusters pc
      ON pc.audit_cluster_id = pa.cluster_id
    JOIN public.programs p
      ON p.id = pc.program_id
     AND p.audit_id = pa.audit_id
    WHERE pa.id = p_planned_article_id
      AND p.dodo_subscription_id = p_dodo_subscription_id;
    IF v_user_id IS NULL THEN RETURN FALSE; END IF;

    SELECT id, allowance INTO v_grant_id, v_allowance
    FROM public.subscription_period_grants
    WHERE dodo_subscription_id = p_dodo_subscription_id
      AND period_start <= now()
      AND (period_end IS NULL OR period_end > now())
    ORDER BY period_start DESC
    LIMIT 1
    FOR UPDATE;
    IF v_grant_id IS NULL THEN RETURN FALSE; END IF;

    SELECT COUNT(*) INTO v_consumed
    FROM public.subscription_credit_consumptions
    WHERE grant_id = v_grant_id;
    IF v_consumed >= v_allowance THEN RETURN FALSE; END IF;

    INSERT INTO public.subscription_credit_consumptions(grant_id, planned_article_id)
    VALUES (v_grant_id, p_planned_article_id)
    ON CONFLICT (planned_article_id) DO NOTHING
    RETURNING id INTO v_consumption_id;

    -- Another worker may have consumed this exact planned article while this
    -- transaction waited on the grant lock. Its entitlement is already valid;
    -- do not decrement the compatibility balance twice.
    IF v_consumption_id IS NULL THEN RETURN TRUE; END IF;

    UPDATE public.credits
    SET credits = GREATEST(0, credits - 1)
    WHERE user_id = v_user_id;
    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_program_credit(UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_program_credit(UUID, TEXT)
    TO service_role;

CREATE OR REPLACE FUNCTION public.pause_program(
    p_program_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.programs
    SET
        scope_status = 'paused',
        status = 'paused',
        paused_at = COALESCE(paused_at, now()),
        updated_at = now()
    WHERE id = p_program_id
      AND user_id = auth.uid()
      AND scope_status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active program not found';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pause_program(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pause_program(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.resume_program(
    p_program_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_paused_at TIMESTAMPTZ;
    v_pause_duration INTERVAL;
    v_publication_url_pattern TEXT;
BEGIN
    SELECT paused_at, publication_url_pattern
    INTO v_paused_at, v_publication_url_pattern
    FROM public.programs
    WHERE id = p_program_id
      AND user_id = auth.uid()
      AND scope_status = 'paused'
    FOR UPDATE;

    IF v_paused_at IS NULL THEN
        RAISE EXCEPTION 'Paused program not found';
    END IF;
    IF v_publication_url_pattern IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM public.planned_article_links
           WHERE program_id = p_program_id
       ) THEN
        RAISE EXCEPTION
            'Confirm the publication URL pattern and frozen link graph before resuming this legacy program';
    END IF;

    v_pause_duration := now() - v_paused_at;

    UPDATE public.program_clusters
    SET
        scheduled_for = scheduled_for + v_pause_duration,
        updated_at = now()
    WHERE program_id = p_program_id
      AND state IN ('scheduled', 'blocked');

    UPDATE public.programs
    SET
        scope_status = 'active',
        status = 'active',
        paused_at = NULL,
        updated_at = now()
    WHERE id = p_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resume_program(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resume_program(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.deliver_program_cluster(
    p_program_cluster_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_program_cluster public.program_clusters%ROWTYPE;
    v_program public.programs%ROWTYPE;
    v_now TIMESTAMPTZ := now();
    v_total INTEGER;
    v_delivered INTEGER;
    v_clusters_remaining INTEGER;
BEGIN
    SELECT * INTO v_program_cluster
    FROM public.program_clusters
    WHERE id = p_program_cluster_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Program cluster not found'; END IF;

    SELECT * INTO v_program
    FROM public.programs
    WHERE id = v_program_cluster.program_id
    FOR UPDATE;
    IF v_program.scope_status = 'paused' THEN
        RAISE EXCEPTION 'Paused programs cannot deliver';
    END IF;
    IF v_program_cluster.state = 'delivered' THEN
        SELECT COUNT(*) INTO v_clusters_remaining
        FROM public.program_clusters
        WHERE program_id = v_program.id AND state <> 'delivered';
        RETURN v_clusters_remaining = 0;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.planned_articles pa
        WHERE pa.cluster_id = v_program_cluster.audit_cluster_id
          AND pa.audit_id = v_program.audit_id
          AND (
              pa.generation_status <> 'generated'
              OR pa.article_id IS NULL
              OR pa.slug IS NULL
              OR pa.target_url IS NULL
          )
    ) THEN
        RAISE EXCEPTION 'Every cluster article must be generated with a frozen URL';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.planned_article_links l
        JOIN public.planned_articles source ON source.id = l.source_article_id
        LEFT JOIN public.planned_articles target ON target.id = l.target_article_id
        WHERE l.program_id = v_program.id
          AND source.cluster_id = v_program_cluster.audit_cluster_id
          AND l.target_article_id IS NOT NULL
          AND (target.id IS NULL OR target.target_url <> l.target_url)
    ) THEN
        RAISE EXCEPTION 'Frozen link graph contains an unresolved target';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM public.planned_articles pa
        WHERE pa.audit_id = v_program.audit_id
          AND pa.cluster_id = v_program_cluster.audit_cluster_id
          AND pa.is_pillar
    ) <> 1 THEN
        RAISE EXCEPTION 'Delivered cluster must contain exactly one pillar';
    END IF;

    SELECT COUNT(*) INTO v_total
    FROM public.planned_articles pa
    WHERE pa.audit_id = v_program.audit_id
      AND pa.cluster_id = v_program_cluster.audit_cluster_id;

    IF (
        SELECT COUNT(*)
        FROM public.planned_article_links l
        JOIN public.planned_articles source ON source.id = l.source_article_id
        JOIN public.planned_articles target ON target.id = l.target_article_id
        WHERE l.program_id = v_program.id
          AND source.audit_id = v_program.audit_id
          AND source.cluster_id = v_program_cluster.audit_cluster_id
          AND target.cluster_id = source.cluster_id
          AND source.is_pillar
          AND NOT target.is_pillar
          AND l.relationship = 'pillar_to_leaf'
    ) <> v_total - 1 THEN
        RAISE EXCEPTION 'Pillar-to-leaf graph is incomplete';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM public.planned_article_links l
        JOIN public.planned_articles source ON source.id = l.source_article_id
        JOIN public.planned_articles target ON target.id = l.target_article_id
        WHERE l.program_id = v_program.id
          AND source.audit_id = v_program.audit_id
          AND source.cluster_id = v_program_cluster.audit_cluster_id
          AND target.cluster_id = source.cluster_id
          AND NOT source.is_pillar
          AND target.is_pillar
          AND l.relationship = 'leaf_to_pillar'
    ) <> v_total - 1 THEN
        RAISE EXCEPTION 'Leaf-to-pillar graph is incomplete';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.planned_articles leaf
        WHERE leaf.audit_id = v_program.audit_id
          AND leaf.cluster_id = v_program_cluster.audit_cluster_id
          AND NOT leaf.is_pillar
          AND (
              SELECT COUNT(*)
              FROM public.planned_article_links l
              JOIN public.planned_articles sibling
                ON sibling.id = l.target_article_id
              WHERE l.program_id = v_program.id
                AND l.source_article_id = leaf.id
                AND l.relationship = 'sibling'
                AND sibling.cluster_id = leaf.cluster_id
                AND NOT sibling.is_pillar
          ) <> LEAST(2, v_total - 2)
    ) THEN
        RAISE EXCEPTION 'Sibling graph is incomplete';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.planned_article_links l
        JOIN public.planned_articles pa ON pa.id = l.source_article_id
        JOIN public.articles a ON a.id = pa.article_id
        WHERE l.program_id = v_program.id
          AND pa.cluster_id = v_program_cluster.audit_cluster_id
          AND position(
              ('href="' || l.target_url || '"')
              IN COALESCE(a.final_html, '')
          ) = 0
          AND position(
              ('href="' || replace(l.target_url, '&', '&amp;') || '"')
              IN COALESCE(a.final_html, '')
          ) = 0
    ) THEN
        RAISE EXCEPTION 'A generated article is missing a frozen link';
    END IF;

    UPDATE public.planned_articles
    SET
        delivery_status = 'delivered',
        delivered_at = v_now,
        status = 'delivered',
        updated_at = v_now
    WHERE cluster_id = v_program_cluster.audit_cluster_id
      AND audit_id = v_program.audit_id;

    UPDATE public.articles a
    SET delivery_visible_at = v_now
    FROM public.planned_articles pa
    WHERE pa.article_id = a.id
      AND pa.cluster_id = v_program_cluster.audit_cluster_id
      AND pa.audit_id = v_program.audit_id;

    UPDATE public.program_clusters
    SET state = 'delivered', delivered_at = v_now, failure_code = NULL, updated_at = v_now
    WHERE id = p_program_cluster_id;

    SELECT COUNT(*) INTO v_total
    FROM public.planned_articles pa
    JOIN public.program_clusters pc ON pc.audit_cluster_id = pa.cluster_id
    WHERE pc.program_id = v_program.id;

    SELECT COUNT(*) INTO v_delivered
    FROM public.planned_articles pa
    JOIN public.program_clusters pc ON pc.audit_cluster_id = pa.cluster_id
    WHERE pc.program_id = v_program.id
      AND pa.delivery_status = 'delivered';

    UPDATE public.programs
    SET completed_count = v_delivered, total_articles = v_total, updated_at = v_now
    WHERE id = v_program.id;

    SELECT COUNT(*) INTO v_clusters_remaining
    FROM public.program_clusters
    WHERE program_id = v_program.id AND state <> 'delivered';

    IF v_clusters_remaining = 0 THEN
        UPDATE public.programs
        SET
            scope_status = 'scope_delivered',
            status = 'completed',
            completed_at = COALESCE(completed_at, v_now),
            updated_at = v_now
        WHERE id = v_program.id;
    END IF;

    RETURN v_clusters_remaining = 0;
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_program_cluster(UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_program_cluster(UUID)
    TO service_role;

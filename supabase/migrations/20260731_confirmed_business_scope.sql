-- ============================================================================
-- Confirmed business scope: positive product-family ownership for every topic.
-- Dated after the July 30 reconciliation migrations so this file owns the
-- finalizer and deployment-preflight definitions that production will execute.
-- ============================================================================
--
-- The previous pipeline reduced a multi-offer website to one flat seed list.
-- A generic phrase from prose could then contaminate the whole pool while all
-- provenance, demand, clustering, and size checks still passed. This migration
-- changes the unit of truth:
--
--   mutable confirmed brand scope -> immutable audit scope snapshot
--   -> every query -> every cluster -> every planned article
--
-- There is intentionally no vocabulary blacklist. Relevance is positive:
-- every persisted row must belong to a product/service family the customer
-- confirmed before the audit started.

ALTER TABLE public.brand_details
    ADD COLUMN IF NOT EXISTS scope_confirmed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scope_contract_version TEXT,
    ADD COLUMN IF NOT EXISTS scope_hash TEXT;

ALTER TABLE public.topical_audits
    ADD COLUMN IF NOT EXISTS scope_contract_version TEXT,
    ADD COLUMN IF NOT EXISTS scope_hash TEXT;

CREATE TABLE IF NOT EXISTS public.brand_scope_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    seed_keywords TEXT[] NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    source TEXT NOT NULL DEFAULT 'extracted',
    priority INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 'founder' means the family was created from a target search the founder
    -- typed. It needs no site quote: the founder is authoritative about what
    -- the business sells, and a crawler that disagrees is the thing that is
    -- wrong. See lib/brand-scope.ts.
    CONSTRAINT brand_scope_family_source_check
        CHECK (source IN ('extracted', 'founder', 'user')),
    CONSTRAINT brand_scope_family_name_check
        CHECK (length(btrim(name)) BETWEEN 2 AND 100),
    CONSTRAINT brand_scope_family_description_check
        CHECK (length(btrim(description)) BETWEEN 8 AND 500),
    CONSTRAINT brand_scope_family_seed_count_check
        CHECK (cardinality(seed_keywords) BETWEEN 1 AND 8),
    CONSTRAINT brand_scope_family_priority_check
        CHECK (priority BETWEEN 0 AND 99)
);

CREATE UNIQUE INDEX IF NOT EXISTS brand_scope_family_priority_key
    ON public.brand_scope_families(brand_id, priority);
CREATE UNIQUE INDEX IF NOT EXISTS brand_scope_family_name_key
    ON public.brand_scope_families(brand_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_brand_scope_family_owner
    ON public.brand_scope_families(user_id, brand_id);

CREATE TABLE IF NOT EXISTS public.audit_scope_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES public.topical_audits(id) ON DELETE RESTRICT,
    brand_scope_family_id UUID REFERENCES public.brand_scope_families(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    seed_keywords TEXT[] NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    source TEXT NOT NULL,
    priority INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT audit_scope_family_source_check
        CHECK (source IN ('extracted', 'founder', 'user', 'legacy')),
    CONSTRAINT audit_scope_family_seed_count_check
        CHECK (cardinality(seed_keywords) BETWEEN 1 AND 8),
    CONSTRAINT audit_scope_family_priority_check
        CHECK (priority BETWEEN 0 AND 99)
);

CREATE UNIQUE INDEX IF NOT EXISTS audit_scope_family_priority_key
    ON public.audit_scope_families(audit_id, priority);
CREATE UNIQUE INDEX IF NOT EXISTS audit_scope_family_name_key
    ON public.audit_scope_families(audit_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS audit_scope_family_id_audit_key
    ON public.audit_scope_families(id, audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_scope_family_owner
    ON public.audit_scope_families(user_id, audit_id);

-- Preserve historical rows under an explicitly unverified legacy family.
-- They remain viewable but cannot be purchased without a new confirmed audit.
INSERT INTO public.audit_scope_families (
    audit_id, user_id, name, description, seed_keywords, evidence, source, priority
)
SELECT
    ta.id,
    ta.user_id,
    'Legacy unverified scope',
    'Imported from the flat-seed audit contract and retained only for history.',
    CASE
        WHEN cardinality(ta.input_seeds) > 0 THEN ta.input_seeds[1:8]
        ELSE ARRAY['legacy audit']::text[]
    END,
    '[]'::jsonb,
    'legacy',
    0
FROM public.topical_audits ta
WHERE NOT EXISTS (
    SELECT 1
    FROM public.audit_scope_families sf
    WHERE sf.audit_id = ta.id
);

ALTER TABLE public.query_pool
    ADD COLUMN IF NOT EXISTS scope_family_id UUID;
ALTER TABLE public.audit_clusters
    ADD COLUMN IF NOT EXISTS scope_family_id UUID;
ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS scope_family_id UUID;

-- ----------------------------------------------------------------------------
-- Repair the shared snapshot guard BEFORE the backfill below.
--
-- One trigger function serves query_pool, audit_clusters and planned_articles.
-- Its dispatch was written as a flat chain:
--
--     IF     TG_TABLE_NAME = 'query_pool'     AND (NEW.query ...) THEN
--     ELSIF  TG_TABLE_NAME = 'audit_clusters' AND (NEW.name  ...) THEN
--
-- PL/pgSQL prepares each branch's condition as one SQL statement when that
-- branch is *reached*. `TG_TABLE_NAME = 'audit_clusters'` evaluating false does
-- not stop `NEW.name` from having to resolve first, and NEW is a query_pool
-- record there:
--
--     ERROR: 42703: record "new" has no field "name"
--
-- So an UPDATE on query_pool that changes nothing protected — exactly what the
-- scope_family_id backfill does — falls through branch one and dies on branch
-- two. The bug has been latent since `20260730_closed_pool_v2.sql` because no
-- UPDATE had ever run against a completed audit's rows.
--
-- Nesting the table dispatch fixes it: PL/pgSQL prepares statements lazily, so
-- a branch that is never reached is never planned, and each table's field
-- references stay inside a branch only that table can enter.
--
-- `scope_family_id` is deliberately NOT in the protected lists. The backfill
-- below must be able to set it, and cross-family integrity is enforced by the
-- composite foreign keys this migration adds rather than by this trigger.
-- ----------------------------------------------------------------------------
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
        IF TG_TABLE_NAME = 'query_pool' THEN
            IF NEW.audit_id IS DISTINCT FROM OLD.audit_id
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
            THEN
                RAISE EXCEPTION 'Completed query evidence is immutable';
            END IF;

        ELSIF TG_TABLE_NAME = 'audit_clusters' THEN
            IF NEW.audit_id IS DISTINCT FROM OLD.audit_id
                OR NEW.name IS DISTINCT FROM OLD.name
                OR NEW.description IS DISTINCT FROM OLD.description
                OR NEW.priority IS DISTINCT FROM OLD.priority
                OR NEW.article_count IS DISTINCT FROM OLD.article_count
                OR NEW.competitor_urls IS DISTINCT FROM OLD.competitor_urls
            THEN
                RAISE EXCEPTION 'Completed cluster evidence is immutable';
            END IF;

        ELSIF TG_TABLE_NAME = 'planned_articles' THEN
            IF NEW.audit_id IS DISTINCT FROM OLD.audit_id
                OR NEW.cluster_id IS DISTINCT FROM OLD.cluster_id
                OR NEW.title IS DISTINCT FROM OLD.title
                OR NEW.main_keyword IS DISTINCT FROM OLD.main_keyword
                OR NEW.supporting_keywords IS DISTINCT FROM OLD.supporting_keywords
                OR NEW.source_query_ids IS DISTINCT FROM OLD.source_query_ids
                OR NEW.article_type IS DISTINCT FROM OLD.article_type
                OR NEW.intent_role IS DISTINCT FROM OLD.intent_role
                OR NEW.is_pillar IS DISTINCT FROM OLD.is_pillar
            THEN
                RAISE EXCEPTION 'Completed planned scope is immutable';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- Repair pgvector visibility BEFORE the backfill below.
--
-- The backfill updates query_pool rows that belong to a COMPLETED audit, which
-- fires the `guard_audit_snapshot_row` immutability trigger. That trigger
-- compares every protected column with `IS DISTINCT FROM`, including
-- `NEW.embedding IS DISTINCT FROM OLD.embedding`.
--
-- `IS DISTINCT FROM` needs the `=` operator for the type, and operator lookup
-- goes through search_path — schema-qualifying the *type* does not help.
-- Supabase installs pgvector in `extensions`, but the guard was pinned to
-- `SET search_path = public`, so the operator is invisible and the whole
-- migration aborts:
--
--     ERROR: 42883: operator does not exist: extensions.vector = extensions.vector
--     CONTEXT: PL/pgSQL function guard_audit_snapshot_row() line 23 at IF
--
-- `20260730_fix_finalize_vector_search_path.sql` fixed exactly this problem for
-- `finalize_audit_run` and stopped there. The guard is the sibling that was
-- left behind, so this sweep repairs the whole class rather than the one
-- function that happened to fail first: any function with a pinned search_path
-- that touches `embedding` but cannot see pgvector gets the extension schema
-- appended.
-- ----------------------------------------------------------------------------
-- The set is listed explicitly rather than discovered by text-matching on
-- "embedding": a body-text sweep also matches functions that merely name the
-- column in a string literal (`assert_harvest_schema_ready` does), and
-- rewriting an unrelated function's search_path is how a targeted repair turns
-- into an outage. Add a name here when a function starts manipulating vector
-- VALUES — comparing, casting, or storing them.
DO $$
DECLARE
    vector_schema TEXT;
    target RECORD;
    current_path TEXT;
BEGIN
    SELECT n.nspname INTO vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';

    IF vector_schema IS NULL THEN
        RAISE EXCEPTION 'Confirmed-scope schema requires pgvector';
    END IF;

    FOR target IN
        SELECT p.oid,
               p.proname,
               pg_get_function_identity_arguments(p.oid) AS args,
               p.proconfig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = ANY (ARRAY['guard_audit_snapshot_row'])
    LOOP
        current_path := COALESCE(
            (SELECT replace(entry, 'search_path=', '')
               FROM unnest(target.proconfig) AS entry
              WHERE entry LIKE 'search_path=%'),
            'public'
        );

        -- Append, never replace: an explicit pg_catalog or auth entry in the
        -- existing path is load-bearing and must survive this repair.
        IF position(vector_schema IN current_path) = 0 THEN
            EXECUTE format(
                'ALTER FUNCTION public.%I(%s) SET search_path = %s, %I',
                target.proname,
                target.args,
                current_path,
                vector_schema
            );
            RAISE NOTICE 'Added % to search_path of %()', vector_schema, target.proname;
        END IF;
    END LOOP;
END;
$$;


UPDATE public.query_pool q
SET scope_family_id = (
    SELECT sf.id
    FROM public.audit_scope_families sf
    WHERE sf.audit_id = q.audit_id
    ORDER BY sf.priority
    LIMIT 1
)
WHERE q.scope_family_id IS NULL;

UPDATE public.audit_clusters c
SET scope_family_id = (
    SELECT sf.id
    FROM public.audit_scope_families sf
    WHERE sf.audit_id = c.audit_id
    ORDER BY sf.priority
    LIMIT 1
)
WHERE c.scope_family_id IS NULL;

UPDATE public.planned_articles pa
SET scope_family_id = COALESCE(
    (
        SELECT c.scope_family_id
        FROM public.audit_clusters c
        WHERE c.id = pa.cluster_id
          AND c.audit_id = pa.audit_id
    ),
    (
        SELECT sf.id
        FROM public.audit_scope_families sf
        WHERE sf.audit_id = pa.audit_id
        ORDER BY sf.priority
        LIMIT 1
    )
)
WHERE pa.scope_family_id IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.query_pool WHERE scope_family_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.audit_clusters WHERE scope_family_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.planned_articles WHERE scope_family_id IS NULL)
    THEN
        RAISE EXCEPTION 'Cannot enforce confirmed scope: legacy scope backfill is incomplete';
    END IF;
END;
$$;

ALTER TABLE public.query_pool
    ALTER COLUMN scope_family_id SET NOT NULL;
ALTER TABLE public.audit_clusters
    ALTER COLUMN scope_family_id SET NOT NULL;
ALTER TABLE public.planned_articles
    ALTER COLUMN scope_family_id SET NOT NULL;

ALTER TABLE public.query_pool
    DROP CONSTRAINT IF EXISTS query_pool_scope_family_fkey,
    ADD CONSTRAINT query_pool_scope_family_fkey
        FOREIGN KEY (scope_family_id, audit_id)
        REFERENCES public.audit_scope_families(id, audit_id)
        ON DELETE RESTRICT;

ALTER TABLE public.audit_clusters
    DROP CONSTRAINT IF EXISTS audit_clusters_scope_family_fkey,
    ADD CONSTRAINT audit_clusters_scope_family_fkey
        FOREIGN KEY (scope_family_id, audit_id)
        REFERENCES public.audit_scope_families(id, audit_id)
        ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS audit_cluster_scope_identity_key
    ON public.audit_clusters(id, audit_id, scope_family_id);

ALTER TABLE public.planned_articles
    DROP CONSTRAINT IF EXISTS planned_articles_scope_family_fkey,
    DROP CONSTRAINT IF EXISTS planned_articles_cluster_scope_fkey,
    ADD CONSTRAINT planned_articles_scope_family_fkey
        FOREIGN KEY (scope_family_id, audit_id)
        REFERENCES public.audit_scope_families(id, audit_id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT planned_articles_cluster_scope_fkey
        FOREIGN KEY (cluster_id, audit_id, scope_family_id)
        REFERENCES public.audit_clusters(id, audit_id, scope_family_id)
        ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_query_pool_scope_family
    ON public.query_pool(audit_id, scope_family_id);
CREATE INDEX IF NOT EXISTS idx_audit_clusters_scope_family
    ON public.audit_clusters(audit_id, scope_family_id, priority);
CREATE INDEX IF NOT EXISTS idx_planned_articles_scope_family
    ON public.planned_articles(audit_id, scope_family_id, cluster_id);

-- The v2 immutable-evidence trigger predates `scope_family_id`, so its column
-- comparison cannot protect this new ownership edge. Keep the existing trigger
-- for all original evidence fields and add this narrow guard for family
-- reassignment. Claiming may change user/brand ownership, never semantic scope.
CREATE OR REPLACE FUNCTION public.guard_completed_row_scope_family()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NEW.scope_family_id IS DISTINCT FROM OLD.scope_family_id
       AND EXISTS (
           SELECT 1
           FROM public.topical_audits
           WHERE id = OLD.audit_id
             AND run_status = 'completed'
       )
    THEN
        RAISE EXCEPTION 'Completed evidence cannot change confirmed business family';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_query_pool_scope_family ON public.query_pool;
CREATE TRIGGER guard_query_pool_scope_family
    BEFORE UPDATE OF scope_family_id ON public.query_pool
    FOR EACH ROW EXECUTE FUNCTION public.guard_completed_row_scope_family();

DROP TRIGGER IF EXISTS guard_audit_clusters_scope_family ON public.audit_clusters;
CREATE TRIGGER guard_audit_clusters_scope_family
    BEFORE UPDATE OF scope_family_id ON public.audit_clusters
    FOR EACH ROW EXECUTE FUNCTION public.guard_completed_row_scope_family();

DROP TRIGGER IF EXISTS guard_planned_articles_scope_family ON public.planned_articles;
CREATE TRIGGER guard_planned_articles_scope_family
    BEFORE UPDATE OF scope_family_id ON public.planned_articles
    FOR EACH ROW EXECUTE FUNCTION public.guard_completed_row_scope_family();

-- Any pre-scope audit not already purchased must be refreshed. Programs remain
-- pinned to their immutable historical audit and are not altered.
UPDATE public.topical_audits ta
SET requires_reaudit = TRUE,
    updated_at = now()
WHERE ta.run_status = 'completed'
  AND ta.scope_hash IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.programs p WHERE p.audit_id = ta.id
  );

ALTER TABLE public.brand_scope_families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_scope_families ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own brand scope" ON public.brand_scope_families;
CREATE POLICY "Users read own brand scope"
    ON public.brand_scope_families FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own audit scope" ON public.audit_scope_families;
CREATE POLICY "Users read own audit scope"
    ON public.audit_scope_families FOR SELECT
    USING (auth.uid() = user_id);

-- Scope replacement is one transaction. Editing confirmed scope invalidates
-- stale unpurchased audits, but never changes an active program's snapshot.
CREATE OR REPLACE FUNCTION public.confirm_brand_scope(
    p_brand_id UUID,
    p_families JSONB,
    p_contract_version TEXT,
    p_scope_hash TEXT,
    p_brand_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    item JSONB;
    v_count INTEGER;
    v_total_seeds INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    -- Serialize scope confirmation against immutable-audit creation. The audit
    -- creator locks this same row; after either operation wins,
    -- the other observes the committed scope/running-run state instead of
    -- spending on an audit that can only fail finalization.
    PERFORM 1
    FROM public.brand_details
    WHERE id = p_brand_id
      AND user_id = v_user_id
      AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Brand not found';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.topical_audits
        WHERE brand_id = p_brand_id
          AND user_id = v_user_id
          AND run_status = 'running'
    ) THEN
        RAISE EXCEPTION 'Business scope cannot change while an audit is running';
    END IF;

    v_count := jsonb_array_length(COALESCE(p_families, '[]'::jsonb));
    IF v_count < 1 OR v_count > 12 THEN
        RAISE EXCEPTION 'Confirmed scope must contain 1-12 product areas';
    END IF;
    IF COALESCE(p_contract_version, '') = ''
       OR COALESCE(p_scope_hash, '') = ''
       OR p_brand_data IS NULL
       OR jsonb_typeof(p_brand_data) <> 'object'
    THEN
        RAISE EXCEPTION 'Scope version and hash are required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_families) family
        WHERE length(btrim(COALESCE(family->>'name', ''))) NOT BETWEEN 2 AND 100
           OR length(btrim(COALESCE(family->>'description', ''))) NOT BETWEEN 8 AND 500
           OR jsonb_array_length(COALESCE(family->'seed_keywords', '[]'::jsonb)) NOT BETWEEN 1 AND 8
    ) THEN
        RAISE EXCEPTION 'A confirmed product area is incomplete';
    END IF;
    SELECT COALESCE(
        SUM(jsonb_array_length(COALESCE(family->'seed_keywords', '[]'::jsonb))),
        0
    )
    INTO v_total_seeds
    FROM jsonb_array_elements(p_families) family;
    IF v_total_seeds > 12 THEN
        RAISE EXCEPTION 'Confirmed scope may contain at most 12 search directions';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_families) family
        CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(family->'seed_keywords', '[]'::jsonb)
        ) AS seed(value)
        GROUP BY lower(btrim(seed.value))
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Every search direction must belong to exactly one product area';
    END IF;

    DELETE FROM public.brand_scope_families WHERE brand_id = p_brand_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_families)
    LOOP
        INSERT INTO public.brand_scope_families (
            brand_id, user_id, name, description, seed_keywords, evidence,
            source, priority, enabled
        ) VALUES (
            p_brand_id,
            v_user_id,
            btrim(item->>'name'),
            btrim(item->>'description'),
            ARRAY(
                SELECT value
                FROM jsonb_array_elements_text(item->'seed_keywords') value
            ),
            COALESCE(item->'evidence', '[]'::jsonb),
            COALESCE(item->>'source', 'user'),
            COALESCE((item->>'priority')::integer, 0),
            TRUE
        );
    END LOOP;

    UPDATE public.brand_details
    SET brand_data = p_brand_data,
        scope_confirmed_at = now(),
        scope_contract_version = p_contract_version,
        scope_hash = p_scope_hash,
        updated_at = now()
    WHERE id = p_brand_id AND user_id = v_user_id;

    UPDATE public.topical_audits ta
    SET requires_reaudit = TRUE,
        updated_at = now()
    WHERE ta.brand_id = p_brand_id
      AND ta.user_id = v_user_id
      AND ta.run_status = 'completed'
      AND ta.scope_hash IS DISTINCT FROM p_scope_hash
      AND NOT EXISTS (
          SELECT 1 FROM public.programs p WHERE p.audit_id = ta.id
      );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_brand_scope(UUID, JSONB, TEXT, TEXT, JSONB)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_brand_scope(UUID, JSONB, TEXT, TEXT, JSONB)
    TO authenticated, service_role;

-- Onboarding must not save a website/profile and then fail while saving its
-- confirmed scope. This wrapper creates or updates the brand and invokes the
-- scope replacement inside one PostgreSQL transaction. Any validation or
-- constraint error rolls the entire onboarding save back.
CREATE OR REPLACE FUNCTION public.save_onboarding_brand_with_scope(
    p_brand_id UUID,
    p_website_url TEXT,
    p_discovered_competitors JSONB,
    p_families JSONB,
    p_contract_version TEXT,
    p_scope_hash TEXT,
    p_brand_data JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_brand_id UUID := p_brand_id;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF COALESCE(p_website_url, '') !~* '^https://[^[:space:]]+$' THEN
        RAISE EXCEPTION 'A valid HTTPS website URL is required';
    END IF;
    IF p_discovered_competitors IS NULL
       OR jsonb_typeof(p_discovered_competitors) <> 'array'
    THEN
        RAISE EXCEPTION 'Competitors must be a JSON array';
    END IF;
    IF jsonb_array_length(p_discovered_competitors) > 4 THEN
        RAISE EXCEPTION 'A brand may contain at most four direct competitors';
    END IF;

    IF v_brand_id IS NULL THEN
        INSERT INTO public.brand_details (
            user_id,
            website_url,
            brand_data,
            discovered_competitors
        ) VALUES (
            v_user_id,
            p_website_url,
            p_brand_data,
            p_discovered_competitors
        )
        RETURNING id INTO v_brand_id;
    ELSE
        PERFORM 1
        FROM public.brand_details
        WHERE id = v_brand_id
          AND user_id = v_user_id
          AND deleted_at IS NULL
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand not found';
        END IF;

        UPDATE public.brand_details
        SET website_url = p_website_url,
            discovered_competitors = p_discovered_competitors,
            current_audit_id = CASE
                WHEN website_url IS DISTINCT FROM p_website_url
                  OR COALESCE(discovered_competitors, '[]'::jsonb)
                     IS DISTINCT FROM p_discovered_competitors
                THEN NULL
                ELSE current_audit_id
            END,
            updated_at = now()
        WHERE id = v_brand_id
          AND user_id = v_user_id;
    END IF;

    PERFORM public.confirm_brand_scope(
        v_brand_id,
        p_families,
        p_contract_version,
        p_scope_hash,
        p_brand_data
    );

    -- Even an identical business-scope hash cannot make evidence from another
    -- URL current. This also covers same-host path changes, which the active
    -- program host guard intentionally allows.
    UPDATE public.topical_audits ta
    SET requires_reaudit = TRUE,
        updated_at = now()
    WHERE ta.brand_id = v_brand_id
      AND ta.user_id = v_user_id
      AND ta.run_status = 'completed'
      AND (
          ta.subject_url IS DISTINCT FROM p_website_url
          OR ARRAY(
              SELECT competitor_url.value
              FROM unnest(COALESCE(ta.input_competitors, ARRAY[]::TEXT[]))
                  AS competitor_url(value)
              ORDER BY competitor_url.value
          ) IS DISTINCT FROM ARRAY(
              SELECT competitor->>'url'
              FROM jsonb_array_elements(p_discovered_competitors) competitor
              ORDER BY competitor->>'url'
          )
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.programs p WHERE p.audit_id = ta.id
      );

    RETURN v_brand_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_onboarding_brand_with_scope(
    UUID, TEXT, JSONB, JSONB, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_brand_with_scope(
    UUID, TEXT, JSONB, JSONB, TEXT, TEXT, JSONB
) TO authenticated, service_role;

-- Customer run creation and the immutable scope copy are one transaction. The
-- worker cannot be queued against an audit row whose scope snapshot failed
-- halfway through creation.
CREATE OR REPLACE FUNCTION public.create_customer_audit_with_scope(
    p_user_id UUID,
    p_brand_id UUID,
    p_public_token TEXT,
    p_policy_version TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_brand public.brand_details%ROWTYPE;
    v_audit_id UUID;
    v_seeds TEXT[];
BEGIN
    SELECT * INTO v_brand
    FROM public.brand_details
    WHERE id = p_brand_id
      AND user_id = p_user_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Brand not found';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.topical_audits
        WHERE brand_id = p_brand_id
          AND user_id = p_user_id
          AND audit_kind = 'customer'
          AND run_status = 'running'
    ) THEN
        RAISE EXCEPTION 'An audit is already running for this brand';
    END IF;
    IF v_brand.scope_confirmed_at IS NULL
       OR COALESCE(v_brand.scope_contract_version, '') = ''
       OR COALESCE(v_brand.scope_hash, '') = ''
       OR NOT EXISTS (
           SELECT 1 FROM public.brand_scope_families
           WHERE brand_id = p_brand_id
             AND user_id = p_user_id
             AND enabled = TRUE
       )
    THEN
        RAISE EXCEPTION 'Brand has no confirmed business scope';
    END IF;

    SELECT array_agg(seed ORDER BY family_priority, seed_order)
    INTO v_seeds
    FROM (
        SELECT
            sf.priority AS family_priority,
            seed_row.ordinality AS seed_order,
            seed_row.seed
        FROM public.brand_scope_families sf
        CROSS JOIN LATERAL unnest(sf.seed_keywords)
            WITH ORDINALITY AS seed_row(seed, ordinality)
        WHERE sf.brand_id = p_brand_id
          AND sf.user_id = p_user_id
          AND sf.enabled = TRUE
    ) confirmed_seeds;

    INSERT INTO public.topical_audits (
        user_id, brand_id, subject_url, input_seeds, brand_snapshot,
        scope_contract_version, scope_hash, audit_kind, created_by_user_id,
        run_status, generation_status, generation_phase,
        harvest_policy_version, generation_error, authority_score, pool_size,
        article_count, cluster_count, competitors_scanned, topics_analyzed,
        user_pages_scanned, public_token, started_at, updated_at
    ) VALUES (
        p_user_id, p_brand_id, v_brand.website_url,
        COALESCE(v_seeds, ARRAY[]::TEXT[]), v_brand.brand_data,
        v_brand.scope_contract_version, v_brand.scope_hash, 'customer',
        p_user_id, 'running', 'running', 'competitor_discovery',
        p_policy_version, NULL, 0, 0, 0, 0, 0, 0, 0, p_public_token,
        now(), now()
    )
    RETURNING id INTO v_audit_id;

    INSERT INTO public.audit_scope_families (
        audit_id, brand_scope_family_id, user_id, name, description,
        seed_keywords, evidence, source, priority
    )
    SELECT
        v_audit_id, id, p_user_id, name, description, seed_keywords,
        evidence, source, priority
    FROM public.brand_scope_families
    WHERE brand_id = p_brand_id
      AND user_id = p_user_id
      AND enabled = TRUE
    ORDER BY priority;

    RETURN v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_audit_with_scope(
    UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_audit_with_scope(
    UUID, UUID, TEXT, TEXT
) TO service_role;

-- Founder prospect audits use the same immutable scope contract. The founder
-- explicitly supplies product areas; this RPC creates the run, claim, and scope
-- snapshot in one transaction so a worker can never start with a half-created
-- audit.
CREATE OR REPLACE FUNCTION public.create_scoped_prospect_audit(
    p_creator_user_id UUID,
    p_subject_url TEXT,
    p_input_seeds TEXT[],
    p_input_competitors TEXT[],
    p_brand_snapshot JSONB,
    p_policy_version TEXT,
    p_scope_contract_version TEXT,
    p_scope_hash TEXT,
    p_scope_families JSONB,
    p_public_token TEXT,
    p_claim_token_hash TEXT,
    p_claim_email_normalized TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_audit_id UUID;
    item JSONB;
    v_count INTEGER;
    v_total_seeds INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = p_creator_user_id
    ) THEN
        RAISE EXCEPTION 'Prospect audit creator does not exist';
    END IF;

    v_count := jsonb_array_length(COALESCE(p_scope_families, '[]'::jsonb));
    SELECT COALESCE(
        SUM(jsonb_array_length(COALESCE(family->'seed_keywords', '[]'::jsonb))),
        0
    )
    INTO v_total_seeds
    FROM jsonb_array_elements(COALESCE(p_scope_families, '[]'::jsonb)) family;

    IF v_count < 1 OR v_count > 12 OR v_total_seeds > 12 THEN
        RAISE EXCEPTION 'Prospect scope must contain 1-12 areas and at most 12 searches';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_scope_families) family
        CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(family->'seed_keywords', '[]'::jsonb)
        ) AS seed(value)
        GROUP BY lower(btrim(seed.value))
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Every prospect search must belong to exactly one area';
    END IF;
    IF COALESCE(p_scope_hash, '') = ''
       OR COALESCE(p_scope_contract_version, '') = ''
    THEN
        RAISE EXCEPTION 'Prospect scope version and hash are required';
    END IF;

    INSERT INTO public.topical_audits (
        user_id, brand_id, subject_url, input_seeds, input_competitors,
        brand_snapshot, audit_kind, created_by_user_id, run_status,
        generation_status, generation_phase, harvest_policy_version,
        scope_contract_version, scope_hash, public_token
    ) VALUES (
        p_creator_user_id, NULL, p_subject_url, p_input_seeds,
        p_input_competitors, p_brand_snapshot, 'prospect', p_creator_user_id,
        'running', 'running', 'queued', p_policy_version,
        p_scope_contract_version, p_scope_hash, p_public_token
    )
    RETURNING id INTO v_audit_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_scope_families)
    LOOP
        INSERT INTO public.audit_scope_families (
            audit_id, user_id, name, description, seed_keywords, evidence,
            source, priority
        ) VALUES (
            v_audit_id,
            p_creator_user_id,
            btrim(item->>'name'),
            btrim(item->>'description'),
            ARRAY(
                SELECT value
                FROM jsonb_array_elements_text(item->'seed_keywords') value
            ),
            COALESCE(item->'evidence', '[]'::jsonb),
            'user',
            COALESCE((item->>'priority')::integer, 0)
        );
    END LOOP;

    INSERT INTO public.audit_claims (
        audit_id, claim_token_hash, claim_email_normalized
    ) VALUES (
        v_audit_id, p_claim_token_hash, lower(trim(p_claim_email_normalized))
    );

    RETURN v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_scoped_prospect_audit(
    UUID, TEXT, TEXT[], TEXT[], JSONB, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_scoped_prospect_audit(
    UUID, TEXT, TEXT[], TEXT[], JSONB, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_completed_audit_scope_contract()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF OLD.run_status = 'completed'
       AND (
           NEW.scope_contract_version IS DISTINCT FROM OLD.scope_contract_version
           OR NEW.scope_hash IS DISTINCT FROM OLD.scope_hash
       )
    THEN
        RAISE EXCEPTION 'Completed audit scope contract is immutable';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_completed_audit_scope_contract ON public.topical_audits;
CREATE TRIGGER guard_completed_audit_scope_contract
    BEFORE UPDATE ON public.topical_audits
    FOR EACH ROW EXECUTE FUNCTION public.guard_completed_audit_scope_contract();

-- Completed audit scope snapshots are immutable.
CREATE OR REPLACE FUNCTION public.guard_audit_scope_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_audit_id := OLD.audit_id;
    ELSE
        v_audit_id := NEW.audit_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.topical_audits
        WHERE id = v_audit_id AND run_status = 'completed'
    ) THEN
        -- Claiming a prospect changes ownership, not evidence. The content of a
        -- completed scope row remains immutable.
        IF TG_OP = 'UPDATE'
           AND NEW.id = OLD.id
           AND NEW.audit_id = OLD.audit_id
           AND NEW.name = OLD.name
           AND NEW.description = OLD.description
           AND NEW.seed_keywords = OLD.seed_keywords
           AND NEW.evidence = OLD.evidence
           AND NEW.source = OLD.source
           AND NEW.priority = OLD.priority
           AND NEW.created_at = OLD.created_at
        THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Completed audit scope is immutable';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_audit_scope_snapshot ON public.audit_scope_families;
CREATE TRIGGER guard_audit_scope_snapshot
    BEFORE INSERT OR UPDATE OR DELETE ON public.audit_scope_families
    FOR EACH ROW EXECUTE FUNCTION public.guard_audit_scope_snapshot();

-- Atomic finalization with mandatory positive scope ownership.
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
    IF NOT EXISTS (
        SELECT 1 FROM public.audit_scope_families WHERE audit_id = p_audit_id
    ) THEN
        RAISE EXCEPTION 'Audit has no confirmed scope snapshot';
    END IF;
    IF jsonb_array_length(p_query_rows) = 0 THEN
        RAISE EXCEPTION 'Audit query pool cannot be empty';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_query_rows) q
        WHERE COALESCE(q->>'source_url', '') = ''
           OR COALESCE(q->>'observed_value', '') = ''
           OR COALESCE(q->>'scope_family_id', '') = ''
    ) THEN
        RAISE EXCEPTION 'Every query must contain provenance and confirmed scope';
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(p_query_rows)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.audit_scope_families sf
            WHERE sf.id = (item->>'scope_family_id')::uuid
              AND sf.audit_id = p_audit_id
        ) THEN
            RAISE EXCEPTION 'Query references scope outside its audit';
        END IF;

        INSERT INTO public.query_pool (
            id, audit_id, scope_family_id, user_id, brand_id, query, query_norm,
            source, source_url, source_seed, observed_value, observed_at,
            embedding, status, covered_by_url, covered_by_title,
            coverage_similarity, competitor_matches
        ) VALUES (
            (item->>'id')::uuid,
            p_audit_id,
            (item->>'scope_family_id')::uuid,
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
        IF NOT EXISTS (
            SELECT 1 FROM public.audit_scope_families sf
            WHERE sf.id = (item->>'scope_family_id')::uuid
              AND sf.audit_id = p_audit_id
        ) THEN
            RAISE EXCEPTION 'Cluster references scope outside its audit';
        END IF;

        INSERT INTO public.audit_clusters (
            id, audit_id, scope_family_id, user_id, brand_id, name, description,
            priority, article_count, competitor_urls
        ) VALUES (
            (item->>'id')::uuid,
            p_audit_id,
            (item->>'scope_family_id')::uuid,
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
            WHERE c.id = (item->>'cluster_id')::uuid
              AND c.audit_id = p_audit_id
              AND c.scope_family_id = (item->>'scope_family_id')::uuid
        ) THEN
            RAISE EXCEPTION 'Article references a cluster outside its confirmed scope';
        END IF;

        INSERT INTO public.planned_articles (
            id, audit_id, scope_family_id, user_id, brand_id, cluster_id, title,
            main_keyword, supporting_keywords, source_query_ids, article_type,
            intent_role, is_pillar, slug, target_url, generation_status,
            delivery_status, publication_status
        ) VALUES (
            (item->>'id')::uuid,
            p_audit_id,
            (item->>'scope_family_id')::uuid,
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
          ON qp.id = query_id
         AND qp.audit_id = p_audit_id
         AND qp.scope_family_id = pa.scope_family_id
        WHERE pa.audit_id = p_audit_id
          AND qp.id IS NULL
    ) THEN
        RAISE EXCEPTION 'An article references a query outside its confirmed scope';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.audit_clusters c
        LEFT JOIN public.planned_articles pa
          ON pa.cluster_id = c.id
         AND pa.audit_id = p_audit_id
         AND pa.scope_family_id = c.scope_family_id
        WHERE c.audit_id = p_audit_id
        GROUP BY c.id, c.article_count
        HAVING COUNT(pa.id) <> c.article_count OR COUNT(pa.id) > 15
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
        WHERE id = v_audit.brand_id
          AND scope_hash = v_audit.scope_hash;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand scope changed while the audit was running';
        END IF;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_audit_run(
    UUID, JSONB, JSONB, JSONB, JSONB, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_audit_run(
    UUID, JSONB, JSONB, JSONB, JSONB, TEXT, TEXT, JSONB
) TO service_role;

-- Keep the pgvector lookup portable after replacing the finalizer.
DO $$
DECLARE
    vector_schema TEXT;
BEGIN
    SELECT n.nspname INTO vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';
    IF vector_schema IS NULL THEN
        RAISE EXCEPTION 'Confirmed-scope schema requires pgvector';
    END IF;
    EXECUTE format(
        'ALTER FUNCTION public.finalize_audit_run(uuid,jsonb,jsonb,jsonb,jsonb,text,text,jsonb) SET search_path = public, %I',
        vector_schema
    );
END;
$$;

-- Deployment preflight used before any external research cost.
CREATE OR REPLACE FUNCTION public.assert_harvest_schema_ready()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    missing_columns TEXT;
    vector_schema TEXT;
    finalizer_config TEXT;
    blind_vector_functions TEXT;
BEGIN
    SELECT string_agg(format('%I.%I', required.table_name, required.column_name), ', ')
    INTO missing_columns
    FROM (VALUES
        ('brand_details', 'current_audit_id'),
        ('brand_details', 'scope_confirmed_at'),
        ('brand_details', 'scope_hash'),
        ('topical_audits', 'run_status'),
        ('topical_audits', 'scope_hash'),
        ('query_pool', 'audit_id'),
        ('query_pool', 'scope_family_id'),
        ('query_pool', 'source_url'),
        ('query_pool', 'observed_value'),
        ('query_pool', 'embedding'),
        ('audit_clusters', 'audit_id'),
        ('audit_clusters', 'scope_family_id'),
        ('planned_articles', 'audit_id'),
        ('planned_articles', 'scope_family_id'),
        ('planned_articles', 'source_query_ids')
    ) AS required(table_name, column_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = required.table_name
          AND c.column_name = required.column_name
    );

    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Confirmed-scope schema is incomplete: %', missing_columns;
    END IF;
    IF to_regclass('public.brand_scope_families') IS NULL
       OR to_regclass('public.audit_scope_families') IS NULL
    THEN
        RAISE EXCEPTION 'Confirmed-scope tables are missing';
    END IF;
    IF to_regprocedure(
        'public.create_customer_audit_with_scope(uuid,uuid,text,text)'
    ) IS NULL THEN
        RAISE EXCEPTION 'Confirmed-scope audit creation function is missing';
    END IF;
    IF to_regprocedure(
        'public.save_onboarding_brand_with_scope(uuid,text,jsonb,jsonb,text,text,jsonb)'
    ) IS NULL THEN
        RAISE EXCEPTION 'Atomic onboarding scope function is missing';
    END IF;

    SELECT n.nspname INTO vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';
    IF vector_schema IS NULL THEN
        RAISE EXCEPTION 'Confirmed-scope schema is incomplete: pgvector is missing';
    END IF;

    SELECT array_to_string(p.proconfig, ',') INTO finalizer_config
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(
        'public.finalize_audit_run(uuid,jsonb,jsonb,jsonb,jsonb,text,text,jsonb)'
    );
    IF finalizer_config IS NULL OR position(vector_schema IN finalizer_config) = 0 THEN
        RAISE EXCEPTION 'Confirmed-scope finalizer cannot resolve pgvector';
    END IF;

    -- Checking only the finalizer is what let this class of bug bite twice.
    -- `guard_audit_snapshot_row` has the identical defect, passed this
    -- preflight, and then aborted a migration mid-run with
    -- `operator does not exist: extensions.vector = extensions.vector`.
    --
    -- Every function that manipulates vector VALUES must be able to resolve
    -- pgvector, because a pinned search_path that omits the extension schema
    -- fails at whatever arbitrary moment that function next executes. Keep this
    -- list in step with the repair block near the top of this migration.
    SELECT string_agg(candidate.name, ', ' ORDER BY candidate.name)
    INTO blind_vector_functions
    FROM (VALUES
        ('guard_audit_snapshot_row')
    ) AS candidate(name)
    WHERE EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = candidate.name
          AND p.proconfig IS NOT NULL
          AND array_to_string(p.proconfig, ',') LIKE '%search_path%'
          AND position(vector_schema IN array_to_string(p.proconfig, ',')) = 0
    );

    IF blind_vector_functions IS NOT NULL THEN
        RAISE EXCEPTION
            'These functions cannot resolve pgvector: %', blind_vector_functions;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_harvest_schema_ready()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_harvest_schema_ready()
    TO service_role;

-- Claiming a prospect transfers the complete scope contract, not only its
-- articles. Without this replacement the claimed brand had a current audit but
-- no confirmed mutable scope, so its next audit and checkout contradicted the
-- report the prospect had just claimed.
CREATE OR REPLACE FUNCTION public.claim_prospect_audit(
    p_claim_token_hash TEXT
)
RETURNS TABLE(audit_id UUID, brand_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
    v_claim public.audit_claims%ROWTYPE;
    v_audit public.topical_audits%ROWTYPE;
    v_brand_id UUID;
    v_user_id UUID := auth.uid();
    v_email TEXT := lower(trim(COALESCE(auth.jwt()->>'email', '')));
    v_subject_host TEXT;
    v_brand_count INTEGER;
    v_scope_json JSONB;
BEGIN
    IF v_user_id IS NULL OR v_email = '' THEN
        RAISE EXCEPTION 'Authentication with a verified email is required';
    END IF;

    SELECT * INTO v_claim
    FROM public.audit_claims ac
    WHERE ac.claim_token_hash = p_claim_token_hash
    FOR UPDATE;

    IF NOT FOUND
       OR v_claim.revoked_at IS NOT NULL
       OR v_claim.claimed_at IS NOT NULL
       OR v_claim.expires_at <= now()
    THEN
        RAISE EXCEPTION 'Claim token is invalid, expired, or already used';
    END IF;
    IF v_email <> v_claim.claim_email_normalized THEN
        RAISE EXCEPTION 'This audit was prepared for another email address';
    END IF;

    SELECT * INTO v_audit
    FROM public.topical_audits ta
    WHERE ta.id = v_claim.audit_id
      AND ta.audit_kind = 'prospect'
      AND ta.run_status = 'completed'
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prospect audit is not claimable';
    END IF;
    IF v_audit.scope_hash IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.audit_scope_families
        WHERE audit_scope_families.audit_id = v_audit.id
    ) THEN
        RAISE EXCEPTION 'Prospect audit has no confirmed scope contract';
    END IF;

    v_subject_host := lower(
        split_part(
            regexp_replace(v_audit.subject_url, '^https?://(www\.)?', '', 'i'),
            '/',
            1
        )
    );

    SELECT COUNT(*) INTO v_brand_count
    FROM public.brand_details bd
    WHERE bd.user_id = v_user_id
      AND bd.deleted_at IS NULL;

    SELECT bd.id INTO v_brand_id
    FROM public.brand_details bd
    WHERE bd.user_id = v_user_id
      AND bd.deleted_at IS NULL
      AND lower(
          split_part(
              regexp_replace(bd.website_url, '^https?://(www\.)?', '', 'i'),
              '/',
              1
          )
      ) = v_subject_host
    ORDER BY bd.created_at
    LIMIT 1
    FOR UPDATE;

    IF v_brand_id IS NULL AND v_brand_count > 0 THEN
        RAISE EXCEPTION 'Your existing brand belongs to another website';
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object(
            'name', sf.name,
            'description', sf.description,
            'seed_keywords', sf.seed_keywords,
            'evidence', sf.evidence,
            'source', sf.source,
            'priority', sf.priority,
            'enabled', TRUE
        )
        ORDER BY sf.priority
    )
    INTO v_scope_json
    FROM public.audit_scope_families sf
    WHERE sf.audit_id = v_audit.id;

    IF v_brand_id IS NULL THEN
        INSERT INTO public.brand_details (
            user_id, website_url, brand_data, scope_confirmed_at,
            scope_contract_version, scope_hash
        ) VALUES (
            v_user_id,
            v_audit.subject_url,
            COALESCE(v_audit.brand_snapshot, '{}'::jsonb)
                || jsonb_build_object(
                    'scope_families', COALESCE(v_scope_json, '[]'::jsonb),
                    'target_seed_keywords', to_jsonb(v_audit.input_seeds)
                ),
            now(),
            v_audit.scope_contract_version,
            v_audit.scope_hash
        )
        RETURNING id INTO v_brand_id;
    ELSE
        UPDATE public.brand_details bd
        SET brand_data = COALESCE(bd.brand_data, '{}'::jsonb)
                || jsonb_build_object(
                    'scope_families', COALESCE(v_scope_json, '[]'::jsonb),
                    'target_seed_keywords', to_jsonb(v_audit.input_seeds)
                ),
            scope_confirmed_at = now(),
            scope_contract_version = v_audit.scope_contract_version,
            scope_hash = v_audit.scope_hash,
            updated_at = now()
        WHERE bd.id = v_brand_id;
    END IF;

    DELETE FROM public.brand_scope_families bsf
    WHERE bsf.brand_id = v_brand_id;

    INSERT INTO public.brand_scope_families (
        brand_id, user_id, name, description, seed_keywords, evidence,
        source, priority, enabled
    )
    SELECT
        v_brand_id, v_user_id, sf.name, sf.description, sf.seed_keywords,
        sf.evidence,
        CASE WHEN sf.source = 'legacy' THEN 'user' ELSE sf.source END,
        sf.priority, TRUE
    FROM public.audit_scope_families sf
    WHERE sf.audit_id = v_audit.id
    ORDER BY sf.priority;

    UPDATE public.topical_audits ta
    SET user_id = v_user_id, brand_id = v_brand_id, updated_at = now()
    WHERE ta.id = v_audit.id;
    UPDATE public.audit_scope_families sf
    SET user_id = v_user_id
    WHERE sf.audit_id = v_audit.id;
    UPDATE public.query_pool qp
    SET user_id = v_user_id, brand_id = v_brand_id
    WHERE qp.audit_id = v_audit.id;
    UPDATE public.audit_clusters ac
    SET user_id = v_user_id, brand_id = v_brand_id
    WHERE ac.audit_id = v_audit.id;
    UPDATE public.planned_articles pa
    SET user_id = v_user_id, brand_id = v_brand_id, updated_at = now()
    WHERE pa.audit_id = v_audit.id;
    UPDATE public.brand_details bd
    SET current_audit_id = v_audit.id, updated_at = now()
    WHERE bd.id = v_brand_id;
    UPDATE public.audit_claims cl
    SET claimed_by_user_id = v_user_id, claimed_at = now()
    WHERE cl.id = v_claim.id;

    audit_id := v_audit.id;
    brand_id := v_brand_id;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_prospect_audit(TEXT)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_prospect_audit(TEXT)
    TO authenticated;

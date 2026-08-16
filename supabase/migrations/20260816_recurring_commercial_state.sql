-- ============================================================================
-- Subscription Phase 3: recurring commercial state
-- ============================================================================
-- Retire the finite audit/cluster program as an active model without erasing
-- historical rows. New billing periods authorize subscription_cycles; selected
-- cycle_actions own generation, cost and batch delivery.
-- ============================================================================

-- Stop the old functions before their table/column names become legacy names.
DROP FUNCTION IF EXISTS public.provision_program_from_intent(UUID, TEXT);
DROP FUNCTION IF EXISTS public.consume_program_credit(UUID, TEXT);
DROP FUNCTION IF EXISTS public.deliver_program_cluster(UUID);
DROP FUNCTION IF EXISTS public.grant_subscription_period(
    TEXT, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, TEXT
);

-- Keep old rows inspectable, but make their retired meaning impossible to use
-- accidentally from new code.
DO $$
BEGIN
    IF to_regclass('public.program_purchase_intents') IS NOT NULL
       AND to_regclass('public.legacy_program_purchase_intents') IS NULL
    THEN
        ALTER TABLE public.program_purchase_intents
            RENAME TO legacy_program_purchase_intents;
    END IF;

    IF to_regclass('public.program_clusters') IS NOT NULL
       AND to_regclass('public.legacy_program_clusters') IS NULL
    THEN
        ALTER TABLE public.program_clusters RENAME TO legacy_program_clusters;
    END IF;

    IF to_regclass('public.subscription_credit_consumptions') IS NOT NULL
       AND to_regclass('public.legacy_subscription_credit_consumptions') IS NULL
    THEN
        ALTER TABLE public.subscription_credit_consumptions
            RENAME TO legacy_subscription_credit_consumptions;
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'audit_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'legacy_audit_id'
    ) THEN
        ALTER TABLE public.programs RENAME COLUMN audit_id TO legacy_audit_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'purchase_intent_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'legacy_purchase_intent_id'
    ) THEN
        ALTER TABLE public.programs RENAME COLUMN purchase_intent_id TO legacy_purchase_intent_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'tier'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'legacy_tier'
    ) THEN
        ALTER TABLE public.programs RENAME COLUMN tier TO legacy_tier;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'clusters_per_month'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'legacy_clusters_per_month'
    ) THEN
        ALTER TABLE public.programs RENAME COLUMN clusters_per_month TO legacy_clusters_per_month;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'clusters_included'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'legacy_clusters_included'
    ) THEN
        ALTER TABLE public.programs RENAME COLUMN clusters_included TO legacy_clusters_included;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'total_articles'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'legacy_total_articles'
    ) THEN
        ALTER TABLE public.programs RENAME COLUMN total_articles TO legacy_total_articles;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'completed_count'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'legacy_completed_count'
    ) THEN
        ALTER TABLE public.programs RENAME COLUMN completed_count TO legacy_completed_count;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'scope_status'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'legacy_scope_status'
    ) THEN
        ALTER TABLE public.programs RENAME COLUMN scope_status TO legacy_scope_status;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'pending_tier'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'programs' AND column_name = 'legacy_pending_tier'
    ) THEN
        ALTER TABLE public.programs RENAME COLUMN pending_tier TO legacy_pending_tier;
    END IF;
END;
$$;

ALTER TABLE public.programs
    ALTER COLUMN legacy_audit_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS plan_id TEXT NOT NULL DEFAULT 'founding_beta',
    ADD COLUMN IF NOT EXISTS tracked_prompt_allowance INTEGER NOT NULL DEFAULT 40,
    ADD COLUMN IF NOT EXISTS action_allowance INTEGER NOT NULL DEFAULT 8;

-- Historical completed finite rows become cancelled commercial records. Their
-- delivered articles remain unchanged and accessible.
UPDATE public.programs
SET status = 'cancelled', updated_at = now()
WHERE status = 'completed';

ALTER TABLE public.programs
    DROP CONSTRAINT IF EXISTS programs_status_check,
    DROP CONSTRAINT IF EXISTS programs_plan_id_check,
    DROP CONSTRAINT IF EXISTS programs_tracked_prompt_allowance_check,
    DROP CONSTRAINT IF EXISTS programs_action_allowance_check,
    ADD CONSTRAINT programs_status_check
        CHECK (status IN ('pending', 'active', 'paused', 'cancelled')),
    ADD CONSTRAINT programs_plan_id_check
        CHECK (plan_id = 'founding_beta'),
    ADD CONSTRAINT programs_tracked_prompt_allowance_check
        CHECK (tracked_prompt_allowance = 40),
    ADD CONSTRAINT programs_action_allowance_check
        CHECK (action_allowance BETWEEN 0 AND 8);

CREATE UNIQUE INDEX IF NOT EXISTS programs_one_live_recurring_brand_key
    ON public.programs(brand_id)
    WHERE plan_id = 'founding_beta' AND status IN ('pending', 'active', 'paused');

-- A cycle action is the retry/claim unit now, not a cluster.
ALTER TABLE public.cycle_actions
    ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS generation_started_at TIMESTAMPTZ;

ALTER TABLE public.cycle_actions
    DROP CONSTRAINT IF EXISTS cycle_actions_retry_count_check,
    ADD CONSTRAINT cycle_actions_retry_count_check
        CHECK (retry_count BETWEEN 0 AND 3);

-- Link graphs are frozen inside one selected cycle batch. program_id remains a
-- useful owner, but cycle_id is the delivery boundary for all new rows.
ALTER TABLE public.planned_article_links
    ADD COLUMN IF NOT EXISTS cycle_id UUID
        REFERENCES public.subscription_cycles(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS planned_article_links_cycle_source_idx
    ON public.planned_article_links(cycle_id, source_article_id);
CREATE UNIQUE INDEX IF NOT EXISTS planned_article_links_cycle_target_key
    ON public.planned_article_links(cycle_id, source_article_id, target_url)
    WHERE cycle_id IS NOT NULL;

-- Preserve the old cluster id as opaque history while moving new usage rows to
-- cycle/action ownership.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'program_cost_events'
          AND column_name = 'program_cluster_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'program_cost_events'
          AND column_name = 'legacy_program_cluster_id'
    ) THEN
        ALTER TABLE public.program_cost_events
            RENAME COLUMN program_cluster_id TO legacy_program_cluster_id;
    END IF;
END;
$$;

ALTER TABLE public.program_cost_events
    ALTER COLUMN legacy_program_cluster_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS cycle_id UUID
        REFERENCES public.subscription_cycles(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS cycle_action_id UUID
        REFERENCES public.cycle_actions(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS program_cost_events_cycle_idx
    ON public.program_cost_events(cycle_id, cycle_action_id, created_at);

-- ---------------------------------------------------------------------------
-- Program and billing-period idempotency
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_recurring_program(
    p_user_id UUID,
    p_brand_id UUID,
    p_dodo_subscription_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_program_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.brand_details brand
        WHERE brand.id = p_brand_id
          AND brand.user_id = p_user_id
          AND brand.deleted_at IS NULL
    ) THEN
        RAISE EXCEPTION 'Recurring program brand is not owned by this user';
    END IF;

    SELECT id INTO v_program_id
    FROM public.programs
    WHERE dodo_subscription_id = p_dodo_subscription_id
    FOR UPDATE;

    IF v_program_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.programs
            WHERE id = v_program_id
              AND user_id = p_user_id
              AND brand_id = p_brand_id
        ) THEN
            RAISE EXCEPTION 'Subscription is already attached to another program';
        END IF;
        UPDATE public.programs
        SET status = 'active', paused_at = NULL, updated_at = now()
        WHERE id = v_program_id AND status IN ('pending', 'cancelled');
        RETURN v_program_id;
    END IF;

    INSERT INTO public.programs (
        user_id, brand_id, dodo_subscription_id, plan_id,
        tracked_prompt_allowance, action_allowance, status
    ) VALUES (
        p_user_id, p_brand_id, p_dodo_subscription_id, 'founding_beta', 40, 8,
        'active'
    )
    RETURNING id INTO v_program_id;

    RETURN v_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_recurring_program(UUID, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_recurring_program(UUID, UUID, TEXT)
    TO service_role;

CREATE OR REPLACE FUNCTION public.grant_subscription_period(
    p_dodo_subscription_id TEXT,
    p_user_id UUID,
    p_program_id UUID,
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ,
    p_source_event_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_program public.programs%ROWTYPE;
    v_grant_id UUID;
    v_cycle_id UUID;
BEGIN
    SELECT * INTO v_program
    FROM public.programs
    WHERE id = p_program_id
      AND user_id = p_user_id
      AND dodo_subscription_id = p_dodo_subscription_id
      AND status IN ('active', 'paused')
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active recurring program not found for billing period';
    END IF;
    IF p_period_end IS NULL OR p_period_end <= p_period_start THEN
        RAISE EXCEPTION 'A recurring billing period requires a valid end timestamp';
    END IF;

    INSERT INTO public.subscription_period_grants (
        dodo_subscription_id, user_id, program_id, period_start, period_end,
        allowance, source_event_id
    ) VALUES (
        p_dodo_subscription_id, p_user_id, p_program_id, p_period_start,
        p_period_end, v_program.action_allowance, p_source_event_id
    )
    ON CONFLICT (dodo_subscription_id, period_start) DO UPDATE
    SET program_id = COALESCE(
            public.subscription_period_grants.program_id,
            EXCLUDED.program_id
        ),
        period_end = COALESCE(
            public.subscription_period_grants.period_end,
            EXCLUDED.period_end
        ),
        source_event_id = COALESCE(
            public.subscription_period_grants.source_event_id,
            EXCLUDED.source_event_id
        )
    WHERE public.subscription_period_grants.user_id = EXCLUDED.user_id
    RETURNING id INTO v_grant_id;

    IF v_grant_id IS NULL THEN
        RAISE EXCEPTION 'Billing period belongs to another user';
    END IF;

    INSERT INTO public.subscription_cycles (
        user_id, program_id, brand_id, billing_grant_id,
        period_start, period_end, state, action_allowance
    ) VALUES (
        p_user_id, p_program_id, v_program.brand_id, v_grant_id,
        p_period_start, p_period_end, 'pending', v_program.action_allowance
    )
    ON CONFLICT (program_id, period_start) DO UPDATE
    SET billing_grant_id = COALESCE(
            public.subscription_cycles.billing_grant_id,
            EXCLUDED.billing_grant_id
        ),
        updated_at = now()
    RETURNING id INTO v_cycle_id;

    RETURN v_cycle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_subscription_period(
    TEXT, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_subscription_period(
    TEXT, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) TO service_role;

-- ---------------------------------------------------------------------------
-- Pause/resume and selected-action claiming
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.pause_program(p_program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    UPDATE public.programs
    SET status = 'paused', paused_at = COALESCE(paused_at, now()), updated_at = now()
    WHERE id = p_program_id AND user_id = auth.uid() AND status = 'active';

    IF NOT FOUND THEN RAISE EXCEPTION 'Active program not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_program(p_program_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    UPDATE public.programs
    SET status = 'active', paused_at = NULL, updated_at = now()
    WHERE id = p_program_id AND user_id = auth.uid() AND status = 'paused';

    IF NOT FOUND THEN RAISE EXCEPTION 'Paused program not found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.pause_program(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pause_program(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.resume_program(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resume_program(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_cycle_action(p_cycle_action_id UUID)
RETURNS TABLE(planned_article_id UUID, retry_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_action public.cycle_actions%ROWTYPE;
    v_planned_id UUID;
BEGIN
    SELECT action_row.* INTO v_action
    FROM public.cycle_actions action_row
    JOIN public.subscription_cycles cycle_row ON cycle_row.id = action_row.cycle_id
    JOIN public.programs program_row ON program_row.id = cycle_row.program_id
    WHERE action_row.id = p_cycle_action_id
      AND action_row.state IN ('selected', 'failed')
      AND action_row.retry_count < 3
      AND cycle_row.state = 'producing'
      AND program_row.status = 'active'
    FOR UPDATE OF action_row;

    IF NOT FOUND THEN RETURN; END IF;

    SELECT id INTO v_planned_id
    FROM public.planned_articles
    WHERE cycle_action_id = v_action.id;
    IF v_planned_id IS NULL THEN
        RAISE EXCEPTION 'Selected cycle action has no planned output';
    END IF;

    UPDATE public.cycle_actions
    SET state = 'generating',
        retry_count = v_action.retry_count + 1,
        generation_started_at = now(),
        failure_code = NULL,
        updated_at = now()
    WHERE id = v_action.id;

    planned_article_id := v_planned_id;
    retry_count := v_action.retry_count + 1;
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_cycle_action(UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cycle_action(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- One atomic cycle-batch release
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.deliver_subscription_cycle(p_cycle_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_cycle public.subscription_cycles%ROWTYPE;
    v_now TIMESTAMPTZ := now();
BEGIN
    SELECT * INTO v_cycle
    FROM public.subscription_cycles
    WHERE id = p_cycle_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Subscription cycle not found'; END IF;
    IF v_cycle.state = 'delivered' THEN RETURN TRUE; END IF;

    IF EXISTS (
        SELECT 1 FROM public.cycle_actions action_row
        WHERE action_row.cycle_id = p_cycle_id
          AND action_row.state <> 'ready'
    ) THEN
        RAISE EXCEPTION 'Every selected action must be ready before batch delivery';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.cycle_actions action_row
        LEFT JOIN public.planned_articles planned
          ON planned.cycle_action_id = action_row.id
        WHERE action_row.cycle_id = p_cycle_id
          AND (
              planned.id IS NULL
              OR planned.generation_status <> 'generated'
              OR planned.article_id IS NULL
              OR planned.slug IS NULL
              OR planned.target_url IS NULL
          )
    ) THEN
        RAISE EXCEPTION 'Every selected action requires one generated output with a frozen URL';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.planned_article_links link_row
        JOIN public.planned_articles source ON source.id = link_row.source_article_id
        LEFT JOIN public.planned_articles target ON target.id = link_row.target_article_id
        WHERE link_row.cycle_id = p_cycle_id
          AND link_row.target_article_id IS NOT NULL
          AND (target.id IS NULL OR target.target_url <> link_row.target_url)
    ) THEN
        RAISE EXCEPTION 'Cycle link graph contains an unresolved target';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.planned_article_links link_row
        JOIN public.planned_articles planned ON planned.id = link_row.source_article_id
        JOIN public.articles article ON article.id = planned.article_id
        WHERE link_row.cycle_id = p_cycle_id
          AND position(('href="' || link_row.target_url || '"') IN COALESCE(article.final_html, '')) = 0
          AND position(
              ('href="' || replace(link_row.target_url, '&', '&amp;') || '"')
              IN COALESCE(article.final_html, '')
          ) = 0
    ) THEN
        RAISE EXCEPTION 'A generated output is missing a frozen cycle link';
    END IF;

    UPDATE public.planned_articles planned
    SET delivery_status = 'delivered',
        delivered_at = v_now,
        status = 'delivered',
        updated_at = v_now
    FROM public.cycle_actions action_row
    WHERE action_row.cycle_id = p_cycle_id
      AND planned.cycle_action_id = action_row.id;

    UPDATE public.articles article
    SET delivery_visible_at = v_now
    FROM public.planned_articles planned
    JOIN public.cycle_actions action_row ON action_row.id = planned.cycle_action_id
    WHERE action_row.cycle_id = p_cycle_id
      AND planned.article_id = article.id;

    UPDATE public.cycle_actions
    SET state = 'delivered', delivered_at = v_now, updated_at = v_now
    WHERE cycle_id = p_cycle_id;

    UPDATE public.subscription_cycles
    SET state = 'delivered', delivered_at = v_now,
        failure_code = NULL, updated_at = v_now
    WHERE id = p_cycle_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.deliver_subscription_cycle(UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deliver_subscription_cycle(UUID) TO service_role;

-- The brand still cannot change underneath an active one-site subscription,
-- but a program no longer pins one immutable audit.
CREATE OR REPLACE FUNCTION public.guard_brand_audit_subject()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_old_host TEXT;
    v_new_host TEXT;
BEGIN
    v_old_host := lower(split_part(
        regexp_replace(COALESCE(OLD.website_url, ''), '^https?://(www\.)?', '', 'i'), '/', 1
    ));
    v_new_host := lower(split_part(
        regexp_replace(COALESCE(NEW.website_url, ''), '^https?://(www\.)?', '', 'i'), '/', 1
    ));

    IF v_new_host IS DISTINCT FROM v_old_host AND EXISTS (
        SELECT 1 FROM public.programs program_row
        WHERE program_row.brand_id = OLD.id
          AND program_row.status IN ('pending', 'active', 'paused')
    ) THEN
        RAISE EXCEPTION 'The website cannot change while its subscription is active or paused';
    END IF;

    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL AND EXISTS (
        SELECT 1 FROM public.programs program_row
        WHERE program_row.brand_id = OLD.id
          AND program_row.status IN ('pending', 'active', 'paused')
    ) THEN
        RAISE EXCEPTION 'The website cannot be archived while its subscription is active or paused';
    END IF;

    IF NEW.current_audit_id IS NOT NULL
       AND NEW.current_audit_id IS DISTINCT FROM OLD.current_audit_id
       AND NOT EXISTS (
           SELECT 1 FROM public.topical_audits audit_row
           WHERE audit_row.id = NEW.current_audit_id
             AND audit_row.brand_id = NEW.id
             AND audit_row.user_id = NEW.user_id
             AND audit_row.run_status = 'completed'
       )
    THEN
        RAISE EXCEPTION 'The current audit must be a completed immutable run owned by this website';
    END IF;

    RETURN NEW;
END;
$$;

-- Legacy rows remain readable only. Nothing may provision or schedule through
-- them after this migration.
REVOKE INSERT, UPDATE, DELETE ON public.legacy_program_purchase_intents
    FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.legacy_program_clusters
    FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.legacy_subscription_credit_consumptions
    FROM PUBLIC, anon, authenticated;

    COMMENT ON TABLE public.legacy_program_purchase_intents IS
        'Read-only history from the retired finite audit/cluster checkout model.';
    COMMENT ON TABLE public.legacy_program_clusters IS
        'Read-only history from the retired cluster cadence scheduler.';
    COMMENT ON TABLE public.legacy_subscription_credit_consumptions IS
        'Read-only history from the retired per-article credit entitlement.';
    COMMENT ON COLUMN public.programs.legacy_audit_id IS
        'Historical initial audit only; recurring entitlement is owned by subscription_cycles.';
    COMMENT ON COLUMN public.subscription_period_grants.allowance IS
        'Compatibility snapshot; recurring capacity is subscription_cycles.action_allowance.';

-- ---------------------------------------------------------------------------
-- Repair maintenance functions whose finite-table names were retired.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.discard_unpurchased_audit(p_audit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_audit public.topical_audits;
    v_generated INTEGER;
    v_queries INTEGER;
    v_clusters INTEGER;
    v_articles INTEGER;
    v_families INTEGER;
    v_claims INTEGER;
BEGIN
    SELECT * INTO v_audit
    FROM public.topical_audits
    WHERE id = p_audit_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Audit % does not exist', p_audit_id; END IF;

    IF EXISTS (
        SELECT 1 FROM public.programs WHERE legacy_audit_id = p_audit_id
    ) OR EXISTS (
        SELECT 1 FROM public.legacy_program_purchase_intents WHERE audit_id = p_audit_id
    ) THEN
        RAISE EXCEPTION 'Audit % has legacy commercial history and cannot be discarded', p_audit_id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.subscription_cycles cycle_row
        JOIN public.ai_probe_runs run_row
          ON run_row.id = cycle_row.measurement_run_id
        WHERE run_row.audit_id = p_audit_id
    ) THEN
        RAISE EXCEPTION 'Audit % is a paid cycle measurement and cannot be discarded', p_audit_id;
    END IF;

    SELECT count(*) INTO v_generated
    FROM public.planned_articles
    WHERE audit_id = p_audit_id
      AND (article_id IS NOT NULL OR cycle_action_id IS NOT NULL);
    IF v_generated > 0 THEN
        RAISE EXCEPTION 'Audit % already owns selected or generated output', p_audit_id;
    END IF;

    PERFORM set_config('flipaeo.discarding_audit_id', p_audit_id::text, true);
    UPDATE public.brand_details SET current_audit_id = NULL WHERE current_audit_id = p_audit_id;

    DELETE FROM public.planned_article_links
    WHERE source_article_id IN (
        SELECT id FROM public.planned_articles WHERE audit_id = p_audit_id
    ) OR target_article_id IN (
        SELECT id FROM public.planned_articles WHERE audit_id = p_audit_id
    );
    DELETE FROM public.program_cost_events
    WHERE planned_article_id IN (
        SELECT id FROM public.planned_articles WHERE audit_id = p_audit_id
    );
    DELETE FROM public.legacy_subscription_credit_consumptions
    WHERE planned_article_id IN (
        SELECT id FROM public.planned_articles WHERE audit_id = p_audit_id
    );
    DELETE FROM public.legacy_program_clusters
    WHERE audit_cluster_id IN (
        SELECT id FROM public.audit_clusters WHERE audit_id = p_audit_id
    );

    DELETE FROM public.planned_articles WHERE audit_id = p_audit_id;
    GET DIAGNOSTICS v_articles = ROW_COUNT;
    DELETE FROM public.audit_clusters WHERE audit_id = p_audit_id;
    GET DIAGNOSTICS v_clusters = ROW_COUNT;
    DELETE FROM public.query_pool WHERE audit_id = p_audit_id;
    GET DIAGNOSTICS v_queries = ROW_COUNT;
    DELETE FROM public.audit_scope_families WHERE audit_id = p_audit_id;
    GET DIAGNOSTICS v_families = ROW_COUNT;
    DELETE FROM public.audit_claims WHERE audit_id = p_audit_id;
    GET DIAGNOSTICS v_claims = ROW_COUNT;
    DELETE FROM public.topical_audits WHERE id = p_audit_id;

    RETURN jsonb_build_object(
        'audit_id', p_audit_id,
        'subject_url', v_audit.subject_url,
        'queries', v_queries,
        'clusters', v_clusters,
        'planned_articles', v_articles,
        'scope_families', v_families,
        'claims', v_claims
    );
END;
$$;

REVOKE ALL ON FUNCTION public.discard_unpurchased_audit(UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discard_unpurchased_audit(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_brand(
    p_brand_id UUID,
    p_acknowledge_active_subscription BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_brand public.brand_details;
    v_audit_ids UUID[];
    v_program_ids UUID[];
    v_planned_ids UUID[];
    v_article_ids UUID[];
    v_active_subscription TEXT;
    v_audit_id UUID;
BEGIN
    SELECT * INTO v_brand FROM public.brand_details WHERE id = p_brand_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Brand % does not exist', p_brand_id; END IF;

    SELECT ds.dodo_subscription_id INTO v_active_subscription
    FROM public.dodo_subscriptions ds
    JOIN public.programs program_row
      ON program_row.dodo_subscription_id = ds.dodo_subscription_id
    WHERE program_row.brand_id = p_brand_id
      AND ds.status IN ('active', 'pending')
    LIMIT 1;

    IF v_active_subscription IS NOT NULL AND NOT p_acknowledge_active_subscription THEN
        RAISE EXCEPTION
            'Brand % has a live Dodo subscription (%). Cancel it first or explicitly acknowledge it.',
            p_brand_id, v_active_subscription;
    END IF;

    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_audit_ids
    FROM public.topical_audits WHERE brand_id = p_brand_id;
    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_program_ids
    FROM public.programs WHERE brand_id = p_brand_id;
    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_planned_ids
    FROM public.planned_articles
    WHERE brand_id = p_brand_id OR audit_id = ANY(v_audit_ids);
    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_article_ids
    FROM public.articles WHERE brand_id = p_brand_id;

    UPDATE public.brand_details SET current_audit_id = NULL WHERE id = p_brand_id;
    UPDATE public.profiles SET default_brand_id = NULL WHERE default_brand_id = p_brand_id;

    DELETE FROM public.planned_article_links
    WHERE program_id = ANY(v_program_ids)
       OR source_article_id = ANY(v_planned_ids)
       OR target_article_id = ANY(v_planned_ids);
    DELETE FROM public.program_cost_events
    WHERE program_id = ANY(v_program_ids) OR planned_article_id = ANY(v_planned_ids);
    DELETE FROM public.legacy_subscription_credit_consumptions
    WHERE planned_article_id = ANY(v_planned_ids);

    FOREACH v_audit_id IN ARRAY v_audit_ids LOOP
        PERFORM set_config('flipaeo.discarding_audit_id', v_audit_id::text, true);
        DELETE FROM public.planned_articles WHERE audit_id = v_audit_id;
    END LOOP;
    DELETE FROM public.planned_articles WHERE brand_id = p_brand_id;

    DELETE FROM public.cycle_action_opportunities WHERE brand_id = p_brand_id;
    DELETE FROM public.cycle_actions WHERE brand_id = p_brand_id;
    DELETE FROM public.subscription_cycles WHERE brand_id = p_brand_id;
    DELETE FROM public.subscription_period_grants WHERE program_id = ANY(v_program_ids);
    DELETE FROM public.legacy_program_clusters
    WHERE program_id = ANY(v_program_ids)
       OR audit_cluster_id IN (
           SELECT id FROM public.audit_clusters WHERE audit_id = ANY(v_audit_ids)
       );
    DELETE FROM public.programs WHERE brand_id = p_brand_id;
    DELETE FROM public.legacy_program_purchase_intents WHERE brand_id = p_brand_id;

    DELETE FROM public.content_opportunities WHERE brand_id = p_brand_id;
    DELETE FROM public.ai_probe_runs WHERE brand_id = p_brand_id;
    DELETE FROM public.tracked_prompts WHERE brand_id = p_brand_id;

    FOREACH v_audit_id IN ARRAY v_audit_ids LOOP
        PERFORM set_config('flipaeo.discarding_audit_id', v_audit_id::text, true);
        DELETE FROM public.audit_clusters WHERE audit_id = v_audit_id;
        DELETE FROM public.query_pool WHERE audit_id = v_audit_id;
        DELETE FROM public.audit_scope_families WHERE audit_id = v_audit_id;
    END LOOP;

    DELETE FROM public.audit_claims WHERE audit_id = ANY(v_audit_ids);
    DELETE FROM public.topical_audits WHERE brand_id = p_brand_id;
    DELETE FROM public.answer_coverage WHERE first_covered_by = ANY(v_article_ids);
    DELETE FROM public.articles WHERE brand_id = p_brand_id;
    DELETE FROM public.internal_links WHERE brand_id = p_brand_id;
    DELETE FROM public.brand_scope_families WHERE brand_id = p_brand_id;
    DELETE FROM public.brand_details WHERE id = p_brand_id;

    RETURN jsonb_build_object(
        'brand_id', p_brand_id,
        'website_url', v_brand.website_url,
        'orphaned_dodo_subscription', v_active_subscription,
        'warning', CASE WHEN v_active_subscription IS NOT NULL
            THEN 'The Dodo subscription remains live and must be cancelled separately.'
            ELSE NULL END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_brand(UUID, BOOLEAN)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_brand(UUID, BOOLEAN) TO service_role;

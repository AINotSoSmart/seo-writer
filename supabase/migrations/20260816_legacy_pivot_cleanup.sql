-- ============================================================================
-- Evidence-gated cleanup after three product pivots
-- ============================================================================
-- Live inspection on 2026-08-16 found all three legacy commercial tables and
-- their replacement-only FK columns empty. This migration fails closed if any
-- legacy commercial data appears before it is applied. It deliberately keeps
-- internal_links and answer_coverage because runtime writers still call them.
-- ============================================================================

DO $$
DECLARE
    v_has_rows BOOLEAN;
BEGIN
    IF to_regclass('public.legacy_program_purchase_intents') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.legacy_program_purchase_intents)'
            INTO v_has_rows;
        IF v_has_rows THEN
            RAISE EXCEPTION 'Legacy cleanup stopped: purchase-intent history appeared after the evidence audit';
        END IF;
    END IF;
    IF to_regclass('public.legacy_program_clusters') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.legacy_program_clusters)'
            INTO v_has_rows;
        IF v_has_rows THEN
            RAISE EXCEPTION 'Legacy cleanup stopped: cluster history appeared after the evidence audit';
        END IF;
    END IF;
    IF to_regclass('public.legacy_subscription_credit_consumptions') IS NOT NULL THEN
        EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.legacy_subscription_credit_consumptions)'
            INTO v_has_rows;
        IF v_has_rows THEN
            RAISE EXCEPTION 'Legacy cleanup stopped: credit-consumption history appeared after the evidence audit';
        END IF;
    END IF;
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'program_cost_events'
          AND column_name = 'legacy_program_cluster_id'
    ) THEN
        EXECUTE 'SELECT EXISTS (
            SELECT 1 FROM public.program_cost_events
            WHERE legacy_program_cluster_id IS NOT NULL
        )' INTO v_has_rows;
        IF v_has_rows THEN
            RAISE EXCEPTION 'Legacy cleanup stopped: cost history appeared after the evidence audit';
        END IF;
    END IF;
END;
$$;

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

    FOREACH v_audit_id IN ARRAY v_audit_ids LOOP
        PERFORM set_config('flipaeo.discarding_audit_id', v_audit_id::text, true);
        DELETE FROM public.planned_articles WHERE audit_id = v_audit_id;
    END LOOP;
    DELETE FROM public.planned_articles WHERE brand_id = p_brand_id;

    DELETE FROM public.cycle_action_opportunities WHERE brand_id = p_brand_id;
    DELETE FROM public.cycle_actions WHERE brand_id = p_brand_id;
    DELETE FROM public.subscription_cycles WHERE brand_id = p_brand_id;
    DELETE FROM public.subscription_period_grants WHERE program_id = ANY(v_program_ids);
    DELETE FROM public.programs WHERE brand_id = p_brand_id;

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

ALTER TABLE public.program_cost_events
    DROP COLUMN IF EXISTS legacy_program_cluster_id;

ALTER TABLE public.programs
    DROP COLUMN IF EXISTS legacy_tier,
    DROP COLUMN IF EXISTS legacy_clusters_per_month,
    DROP COLUMN IF EXISTS legacy_clusters_included,
    DROP COLUMN IF EXISTS legacy_total_articles,
    DROP COLUMN IF EXISTS legacy_completed_count,
    DROP COLUMN IF EXISTS legacy_audit_id,
    DROP COLUMN IF EXISTS legacy_purchase_intent_id,
    DROP COLUMN IF EXISTS legacy_scope_status,
    DROP COLUMN IF EXISTS legacy_pending_tier;

DROP TABLE IF EXISTS public.legacy_subscription_credit_consumptions;
DROP TABLE IF EXISTS public.legacy_program_clusters;
DROP TABLE IF EXISTS public.legacy_program_purchase_intents;

-- The table is active in the manual writer path. Its empty IVFFlat index had
-- grown to 183 MB, so rebuild the index rather than deleting live capability.
DO $$
BEGIN
    IF to_regclass('public.internal_links_embedding_idx') IS NOT NULL THEN
        EXECUTE 'REINDEX INDEX public.internal_links_embedding_idx';
    END IF;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.programs') IS NOT NULL THEN
        COMMENT ON TABLE public.programs IS
            'One long-lived recurring delivery program per Dodo subscription and brand.';
    END IF;
    IF to_regclass('public.internal_links') IS NOT NULL THEN
        COMMENT ON TABLE public.internal_links IS
            'Live-site link corpus used by manual/non-cycle generation and sitemap duplication checks; not legacy.';
    END IF;
END;
$$;

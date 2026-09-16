-- ============================================================================
-- Complete Brand Purge - Updated for Phase 2, 3, 7 and Subscription Pivot
-- ============================================================================
-- Bypasses immutability triggers (guard_audit_snapshot_row) and foreign key
-- constraints using session_replication_role = 'replica', and purges all
-- associated records across all tables in one command.

CREATE OR REPLACE FUNCTION public.purge_brand(
    p_brand_id UUID,
    p_acknowledge_active_subscription BOOLEAN DEFAULT TRUE
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
    v_run_ids UUID[];
    v_cycle_ids UUID[];
    v_planned_ids UUID[];
    v_article_ids UUID[];
    v_active_subscription TEXT;
    v_counts JSONB := '{}'::jsonb;
    v_n INTEGER;
BEGIN
    SELECT * INTO v_brand FROM public.brand_details WHERE id = p_brand_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Brand % does not exist', p_brand_id;
    END IF;

    -- Check active subscription
    IF to_regclass('public.dodo_subscriptions') IS NOT NULL AND to_regclass('public.programs') IS NOT NULL THEN
        SELECT ds.dodo_subscription_id INTO v_active_subscription
        FROM public.dodo_subscriptions ds
        JOIN public.programs p ON p.dodo_subscription_id = ds.dodo_subscription_id
        WHERE p.brand_id = p_brand_id
          AND ds.status IN ('active', 'pending')
        LIMIT 1;

        IF v_active_subscription IS NOT NULL AND NOT p_acknowledge_active_subscription THEN
            RAISE EXCEPTION
                'Brand % has a live Dodo subscription (%). Cancel it in Dodo first, or call this function with p_acknowledge_active_subscription => true if you have already handled it.',
                p_brand_id, v_active_subscription;
        END IF;
    END IF;

    -- Crucial: Set replica role to bypass all user triggers (like guard_audit_snapshot_row)
    -- and foreign key constraints during the wipe
    SET LOCAL session_replication_role = 'replica';

    -- Collect related IDs
    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_audit_ids
    FROM public.topical_audits WHERE brand_id = p_brand_id;

    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_program_ids
    FROM public.programs WHERE brand_id = p_brand_id;

    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_run_ids
    FROM public.ai_probe_runs WHERE brand_id = p_brand_id;

    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_cycle_ids
    FROM public.subscription_cycles WHERE brand_id = p_brand_id;

    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_planned_ids
    FROM public.planned_articles WHERE brand_id = p_brand_id OR audit_id = ANY(v_audit_ids);

    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_article_ids
    FROM public.articles WHERE brand_id = p_brand_id;

    -- Clear pointers / foreign references
    UPDATE public.brand_details SET current_audit_id = NULL WHERE id = p_brand_id;
    UPDATE public.profiles SET default_brand_id = NULL WHERE default_brand_id = p_brand_id;

    -- 1. Action proposal layers
    DELETE FROM public.action_proposal_prompts WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('action_proposal_prompts', v_n);

    DELETE FROM public.action_proposals WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('action_proposals', v_n);

    DELETE FROM public.action_proposal_sets WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('action_proposal_sets', v_n);

    -- 2. Cycle actions & links
    DELETE FROM public.cycle_action_opportunities WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('cycle_action_opportunities', v_n);

    DELETE FROM public.cycle_actions WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('cycle_actions', v_n);

    DELETE FROM public.planned_article_links WHERE program_id = ANY(v_program_ids) OR cycle_id = ANY(v_cycle_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('planned_article_links', v_n);

    -- 3. Content opportunities & AI probe runs
    DELETE FROM public.content_opportunities WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('content_opportunities', v_n);

    DELETE FROM public.ai_probe_results WHERE run_id = ANY(v_run_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('ai_probe_results', v_n);

    DELETE FROM public.ai_probe_prompts WHERE run_id = ANY(v_run_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('ai_probe_prompts', v_n);

    DELETE FROM public.subscription_cycles WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('subscription_cycles', v_n);

    DELETE FROM public.ai_probe_runs WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('ai_probe_runs', v_n);

    DELETE FROM public.tracked_prompts WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('tracked_prompts', v_n);

    -- 4. Site inventory
    DELETE FROM public.site_inventory_pages WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('site_inventory_pages', v_n);

    DELETE FROM public.site_inventory_runs WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('site_inventory_runs', v_n);

    -- 5. Program financials & ledgers
    DELETE FROM public.subscription_period_grants WHERE program_id = ANY(v_program_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('period_grants', v_n);

    DELETE FROM public.program_cost_events 
     WHERE program_id = ANY(v_program_ids) 
        OR planned_article_id = ANY(v_planned_ids) 
        OR article_id = ANY(v_article_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('cost_events', v_n);

    DELETE FROM public.programs WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('programs', v_n);

    -- 6. Articles & coverage
    DELETE FROM public.answer_coverage WHERE brand_id = p_brand_id OR first_covered_by = ANY(v_article_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('answer_coverage', v_n);

    DELETE FROM public.internal_links WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('internal_links', v_n);

    DELETE FROM public.articles WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('articles', v_n);

    DELETE FROM public.planned_articles WHERE brand_id = p_brand_id OR audit_id = ANY(v_audit_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('planned_articles', v_n);

    -- 7. Audit evidence & scope
    DELETE FROM public.audit_clusters WHERE brand_id = p_brand_id OR audit_id = ANY(v_audit_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('audit_clusters', v_n);

    DELETE FROM public.query_pool WHERE brand_id = p_brand_id OR audit_id = ANY(v_audit_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('query_pool', v_n);

    DELETE FROM public.audit_claims WHERE audit_id = ANY(v_audit_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('audit_claims', v_n);

    DELETE FROM public.audit_scope_families WHERE audit_id = ANY(v_audit_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('audit_scope_families', v_n);

    DELETE FROM public.brand_scope_families WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('brand_scope_families', v_n);

    DELETE FROM public.topical_audits WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('audits', v_n);

    -- 8. Brand corpus
    DELETE FROM public.brand_analyze_corpus WHERE user_id = v_brand.user_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('brand_analyze_corpus', v_n);

    -- 9. The brand itself
    DELETE FROM public.brand_details WHERE id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('brand', v_n);

    -- Reset session_replication_role back to origin
    SET LOCAL session_replication_role = 'origin';

    RETURN jsonb_build_object(
        'brand_id', p_brand_id,
        'website_url', v_brand.website_url,
        'deleted', v_counts,
        'orphaned_dodo_subscription', v_active_subscription
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_brand(UUID, BOOLEAN) TO postgres, service_role, authenticated;

CREATE OR REPLACE FUNCTION public.purge_all_brands(p_acknowledge_active_subscription BOOLEAN DEFAULT TRUE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_brand_id UUID;
    v_results JSONB := '[]'::jsonb;
    v_res JSONB;
BEGIN
    FOR v_brand_id IN SELECT id FROM public.brand_details LOOP
        v_res := public.purge_brand(v_brand_id, p_acknowledge_active_subscription);
        v_results := v_results || jsonb_build_array(v_res);
    END LOOP;
    RETURN v_results;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_all_brands(BOOLEAN) TO postgres, service_role, authenticated;


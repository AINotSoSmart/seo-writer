-- ============================================================================
-- Full brand purge — the escape hatch for a broken customer
-- ============================================================================
-- `discard_unpurchased_audit` deliberately refuses once money is involved. That
-- is right for the ordinary case, but it leaves no way out when a paid setup is
-- wrong end to end and the founder needs to reset a customer completely.
--
-- This deletes EVERYTHING for one brand: audits, evidence, clusters, planned and
-- generated articles, the frozen link graph, programs, purchase intents, billing
-- ledgers, scope families, claims, and the brand row itself.
--
-- Two things it deliberately does NOT do:
--
--   1. It does not touch `dodo_subscriptions`. That row is the payment record,
--      and deleting a program does not stop Dodo billing the customer. The
--      function REFUSES while an active subscription exists unless the caller
--      explicitly acknowledges it, and always returns the subscription id so it
--      can be cancelled in Dodo. Silently orphaning a live subscription would
--      keep charging a customer whose data no longer exists.
--   2. It does not touch the auth user. Deleting the brand leaves the account
--      intact so they can start over.
--
-- On the vector column: nothing here rewrites embeddings. `query_pool` rows are
-- deleted whole, and the immutability trigger is opened only via the existing
-- transaction-scoped `audit_discard_in_progress` hatch — the same mechanism
-- `discard_unpurchased_audit` uses, which requires `guard_audit_snapshot_row`
-- to resolve pgvector for its `IS DISTINCT FROM` comparisons. That search_path
-- repair is in `20260801_discard_unpurchased_audit.sql` and must stay applied.
-- ============================================================================

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
    v_article_ids UUID[];
    v_planned_ids UUID[];
    v_active_subscription TEXT;
    v_counts JSONB := '{}'::jsonb;
    v_n INTEGER;
BEGIN
    SELECT * INTO v_brand FROM public.brand_details WHERE id = p_brand_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Brand % does not exist', p_brand_id;
    END IF;

    -- A live subscription outlives the data it paid for. Refuse rather than
    -- leave a customer being charged for a brand that no longer exists.
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

    SELECT array_agg(id) INTO v_audit_ids
    FROM public.topical_audits WHERE brand_id = p_brand_id;
    v_audit_ids := COALESCE(v_audit_ids, ARRAY[]::UUID[]);

    SELECT array_agg(id) INTO v_program_ids
    FROM public.programs WHERE brand_id = p_brand_id;
    v_program_ids := COALESCE(v_program_ids, ARRAY[]::UUID[]);

    SELECT array_agg(id) INTO v_planned_ids
    FROM public.planned_articles WHERE brand_id = p_brand_id OR audit_id = ANY(v_audit_ids);
    v_planned_ids := COALESCE(v_planned_ids, ARRAY[]::UUID[]);

    SELECT array_agg(id) INTO v_article_ids
    FROM public.articles WHERE brand_id = p_brand_id;
    v_article_ids := COALESCE(v_article_ids, ARRAY[]::UUID[]);

    -- Release pointers before deleting their targets.
    UPDATE public.brand_details SET current_audit_id = NULL WHERE id = p_brand_id;
    UPDATE public.profiles SET default_brand_id = NULL WHERE default_brand_id = p_brand_id;

    -- ---- billing ledgers (RESTRICT -> programs) ----------------------------
    DELETE FROM public.subscription_credit_consumptions
     WHERE planned_article_id = ANY(v_planned_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('credit_consumptions', v_n);

    DELETE FROM public.subscription_period_grants WHERE program_id = ANY(v_program_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('period_grants', v_n);

    DELETE FROM public.program_cost_events WHERE program_id = ANY(v_program_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('cost_events', v_n);

    DELETE FROM public.planned_article_links WHERE program_id = ANY(v_program_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('link_graph_edges', v_n);

    DELETE FROM public.program_clusters WHERE program_id = ANY(v_program_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('program_clusters', v_n);

    -- programs before purchase_intents (programs.purchase_intent_id RESTRICTs)
    DELETE FROM public.programs WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('programs', v_n);

    DELETE FROM public.program_purchase_intents WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('purchase_intents', v_n);

    -- ---- audit evidence (RESTRICT -> topical_audits / audit_scope_families) --
    --
    -- Per audit, not in bulk. `audit_discard_in_progress` matches ONE audit id
    -- against a transaction-local setting, so a single set_config would exempt
    -- only the first audit and the immutability trigger would reject evidence
    -- belonging to any other. A brand can legitimately hold several audits.
    DECLARE
        v_audit_id UUID;
        v_sum INTEGER := 0;
    BEGIN
        FOREACH v_audit_id IN ARRAY v_audit_ids
        LOOP
            PERFORM set_config('flipaeo.discarding_audit_id', v_audit_id::text, true);

            DELETE FROM public.planned_articles WHERE audit_id = v_audit_id;
            GET DIAGNOSTICS v_n = ROW_COUNT; v_sum := v_sum + v_n;
        END LOOP;
        v_counts := v_counts || jsonb_build_object('planned_articles', v_sum);

        v_sum := 0;
        FOREACH v_audit_id IN ARRAY v_audit_ids
        LOOP
            PERFORM set_config('flipaeo.discarding_audit_id', v_audit_id::text, true);
            DELETE FROM public.audit_clusters WHERE audit_id = v_audit_id;
            GET DIAGNOSTICS v_n = ROW_COUNT; v_sum := v_sum + v_n;
        END LOOP;
        v_counts := v_counts || jsonb_build_object('audit_clusters', v_sum);

        v_sum := 0;
        FOREACH v_audit_id IN ARRAY v_audit_ids
        LOOP
            PERFORM set_config('flipaeo.discarding_audit_id', v_audit_id::text, true);
            DELETE FROM public.query_pool WHERE audit_id = v_audit_id;
            GET DIAGNOSTICS v_n = ROW_COUNT; v_sum := v_sum + v_n;
        END LOOP;
        v_counts := v_counts || jsonb_build_object('query_pool', v_sum);

        v_sum := 0;
        FOREACH v_audit_id IN ARRAY v_audit_ids
        LOOP
            PERFORM set_config('flipaeo.discarding_audit_id', v_audit_id::text, true);
            DELETE FROM public.audit_scope_families WHERE audit_id = v_audit_id;
            GET DIAGNOSTICS v_n = ROW_COUNT; v_sum := v_sum + v_n;
        END LOOP;
        v_counts := v_counts || jsonb_build_object('audit_scope_families', v_sum);
    END;

    -- Anything left that was brand-scoped but not audit-scoped.
    DELETE FROM public.planned_articles WHERE brand_id = p_brand_id;
    DELETE FROM public.audit_clusters WHERE brand_id = p_brand_id;
    DELETE FROM public.query_pool WHERE brand_id = p_brand_id;

    DELETE FROM public.audit_claims WHERE audit_id = ANY(v_audit_ids);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('audit_claims', v_n);

    DELETE FROM public.topical_audits WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('audits', v_n);

    -- ---- generated content and brand-scoped rows ---------------------------
    DELETE FROM public.answer_coverage WHERE first_covered_by = ANY(v_article_ids);
    DELETE FROM public.articles WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('articles', v_n);

    DELETE FROM public.internal_links WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('internal_links', v_n);

    DELETE FROM public.brand_scope_families WHERE brand_id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('brand_scope_families', v_n);

    DELETE FROM public.brand_details WHERE id = p_brand_id;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_counts := v_counts || jsonb_build_object('brand', v_n);

    RETURN jsonb_build_object(
        'brand_id', p_brand_id,
        'website_url', v_brand.website_url,
        'deleted', v_counts,
        'orphaned_dodo_subscription', v_active_subscription,
        'warning', CASE
            WHEN v_active_subscription IS NOT NULL
            THEN 'A Dodo subscription is still live and will keep billing. Cancel ' || v_active_subscription || ' in the Dodo dashboard.'
            ELSE NULL
        END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_brand(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_brand(UUID, BOOLEAN) TO service_role;

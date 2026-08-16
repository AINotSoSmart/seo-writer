-- ============================================================================
-- Subscription Phase 5: explicit target-page triage
-- ============================================================================
-- Coverage is a customer decision made after measurement. It is never inferred
-- from an incomplete crawl: unknown selects no production, no_page permits a
-- create, and has_page requires an explicit same-site HTTPS target for refresh.
-- ============================================================================

-- Keep the Phase 4 reconciler aligned with a target confirmed after a create
-- draft was delivered. Its conservative fallback is needs_input/unknown; once
-- the customer supplies the published target, the same losing opportunity is
-- a refresh candidate rather than a second create.
CREATE OR REPLACE FUNCTION public.apply_confirmed_target_to_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_tracked public.tracked_prompts%ROWTYPE;
BEGIN
    IF NEW.last_verdict NOT IN ('absent', 'outranked')
       OR NEW.state <> 'needs_input'
       OR NEW.resolution_type <> 'unknown'
    THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_tracked
    FROM public.tracked_prompts
    WHERE id = NEW.tracked_prompt_id;

    IF v_tracked.tracking_status = 'active'
       AND v_tracked.coverage_state = 'has_page'
       AND v_tracked.target_url IS NOT NULL
    THEN
        NEW.state := 'open';
        NEW.resolution_type := 'refresh';
        NEW.target_url := v_tracked.target_url;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_confirmed_target_to_opportunity_trigger ON public.content_opportunities;
CREATE TRIGGER apply_confirmed_target_to_opportunity_trigger
    BEFORE INSERT OR UPDATE ON public.content_opportunities
    FOR EACH ROW EXECUTE FUNCTION public.apply_confirmed_target_to_opportunity();

REVOKE ALL ON FUNCTION public.apply_confirmed_target_to_opportunity()
    FROM PUBLIC, anon, authenticated;

-- Phase 4 only reconciles runs completed after its worker code is deployed.
-- Preserve the latest usable historical observation for brands that already
-- measured their durable questions before that deployment, without rewriting
-- any opportunity the live reconciler has created.
WITH latest_observation AS (
    SELECT DISTINCT ON (run_row.brand_id, prompt_row.tracked_prompt_id)
        run_row.user_id,
        run_row.brand_id,
        run_row.id AS run_id,
        COALESCE(run_row.completed_at, run_row.started_at) AS observed_at,
        prompt_row.tracked_prompt_id,
        prompt_row.verdict,
        prompt_row.article_type,
        prompt_row.answers_total,
        prompt_row.answers_present,
        tracked.tracking_status,
        tracked.coverage_state,
        tracked.target_url
    FROM public.ai_probe_runs run_row
    JOIN public.ai_probe_prompts prompt_row
      ON prompt_row.run_id = run_row.id
    JOIN public.tracked_prompts tracked
      ON tracked.id = prompt_row.tracked_prompt_id
     AND tracked.user_id = run_row.user_id
     AND tracked.brand_id = run_row.brand_id
    WHERE run_row.status = 'completed'
      AND prompt_row.tracked_prompt_id IS NOT NULL
      AND prompt_row.answers_total > 0
    ORDER BY
        run_row.brand_id,
        prompt_row.tracked_prompt_id,
        run_row.completed_at DESC NULLS LAST,
        run_row.started_at DESC
)
INSERT INTO public.content_opportunities (
    user_id,
    brand_id,
    tracked_prompt_id,
    state,
    resolution_type,
    first_seen_run_id,
    last_seen_run_id,
    last_verdict,
    last_priority,
    last_reason,
    target_url,
    resolved_at
)
SELECT
    observation.user_id,
    observation.brand_id,
    observation.tracked_prompt_id,
    CASE
        WHEN observation.tracking_status <> 'active' THEN 'dismissed'
        WHEN observation.verdict = 'present' THEN 'resolved'
        WHEN observation.coverage_state = 'no_page' THEN 'open'
        WHEN observation.coverage_state = 'has_page' THEN 'open'
        ELSE 'needs_input'
    END,
    CASE
        WHEN observation.tracking_status <> 'active' THEN 'report_only'
        WHEN observation.verdict = 'present' THEN 'unknown'
        WHEN observation.coverage_state = 'no_page' THEN 'create'
        WHEN observation.coverage_state = 'has_page' THEN 'refresh'
        ELSE 'unknown'
    END,
    observation.run_id,
    observation.run_id,
    observation.verdict,
    CASE
        WHEN observation.verdict = 'present' THEN NULL
        ELSE LEAST(
            100,
            CASE WHEN observation.verdict = 'absent' THEN 40 ELSE 20 END
            + LEAST(
                observation.answers_total - observation.answers_present,
                4
            ) * 6
            + CASE observation.article_type
                WHEN 'commercial' THEN 15
                WHEN 'howto' THEN 5
                ELSE 0
              END
        )::REAL
    END,
    CASE observation.verdict
        WHEN 'absent' THEN format(
            'Absent from all %s captured answer%s.',
            observation.answers_total,
            CASE WHEN observation.answers_total = 1 THEN '' ELSE 's' END
        )
        WHEN 'outranked' THEN format(
            'Named in %s of %s captured answers, but never first.',
            observation.answers_present,
            observation.answers_total
        )
        ELSE format(
            'Led at least one of %s captured answer%s.',
            observation.answers_total,
            CASE WHEN observation.answers_total = 1 THEN '' ELSE 's' END
        )
    END,
    observation.target_url,
    CASE WHEN observation.verdict = 'present' THEN observation.observed_at ELSE NULL END
FROM latest_observation observation
ON CONFLICT (brand_id, tracked_prompt_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.triage_content_opportunity_target(
    p_tracked_prompt_id UUID,
    p_coverage_state TEXT,
    p_target_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_tracked public.tracked_prompts%ROWTYPE;
    v_brand public.brand_details%ROWTYPE;
    v_opportunity public.content_opportunities%ROWTYPE;
    v_target_url TEXT;
    v_brand_host TEXT;
    v_target_host TEXT;
    v_delivered_create BOOLEAN := FALSE;
    v_state TEXT;
    v_resolution TEXT;
    v_opportunity_target TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required';
    END IF;

    IF p_coverage_state NOT IN ('unknown', 'no_page', 'has_page') THEN
        RAISE EXCEPTION 'Coverage state must be unknown, no_page or has_page';
    END IF;

    SELECT * INTO v_tracked
    FROM public.tracked_prompts
    WHERE id = p_tracked_prompt_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tracked question was not found';
    END IF;

    IF v_tracked.tracking_status <> 'active' THEN
        RAISE EXCEPTION 'Only an active tracked question can be triaged';
    END IF;

    -- Serialize against measurement reconciliation for this brand.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_tracked.brand_id::TEXT, 0));

    SELECT * INTO v_brand
    FROM public.brand_details
    WHERE id = v_tracked.brand_id
      AND user_id = v_user_id
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Brand was not found';
    END IF;

    SELECT * INTO v_opportunity
    FROM public.content_opportunities
    WHERE brand_id = v_tracked.brand_id
      AND tracked_prompt_id = v_tracked.id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Measure this tracked question before choosing its target page';
    END IF;

    IF v_opportunity.last_verdict NOT IN ('absent', 'outranked')
       OR v_opportunity.state IN ('resolved', 'dismissed')
    THEN
        RAISE EXCEPTION 'Only a currently losing opportunity can be triaged';
    END IF;

    v_target_url := NULLIF(btrim(COALESCE(p_target_url, '')), '');

    IF p_coverage_state = 'has_page' THEN
        IF v_target_url IS NULL
           OR v_target_url !~* '^https://[^[:space:]]+$'
        THEN
            RAISE EXCEPTION 'An existing page requires a valid HTTPS URL';
        END IF;

        v_brand_host := lower(split_part(
            regexp_replace(v_brand.website_url, '^https?://(www\.)?', '', 'i'),
            '/',
            1
        ));
        v_target_host := lower(split_part(
            regexp_replace(v_target_url, '^https?://(www\.)?', '', 'i'),
            '/',
            1
        ));

        IF v_target_host <> v_brand_host
           AND right(v_target_host, length(v_brand_host) + 1) <> '.' || v_brand_host
        THEN
            RAISE EXCEPTION 'The target page must belong to the measured website';
        END IF;
    ELSIF v_target_url IS NOT NULL THEN
        RAISE EXCEPTION 'Only has_page may include a target URL';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.cycle_action_opportunities link_row
        JOIN public.cycle_actions action_row
          ON action_row.id = link_row.cycle_action_id
        WHERE link_row.opportunity_id = v_opportunity.id
          AND action_row.state = 'delivered'
          AND action_row.resolution_type = 'create'
    ) INTO v_delivered_create;

    IF v_opportunity.state = 'monitoring' THEN
        -- Target confirmation is useful during the observation window, but it
        -- cannot shorten the window or select more production immediately.
        v_state := 'monitoring';
        v_resolution := v_opportunity.resolution_type;
        v_opportunity_target := CASE
            WHEN p_coverage_state = 'has_page' THEN v_target_url
            ELSE v_opportunity.target_url
        END;
    ELSIF p_coverage_state = 'has_page' THEN
        v_state := 'open';
        v_resolution := 'refresh';
        v_opportunity_target := v_target_url;
    ELSIF p_coverage_state = 'no_page' AND NOT v_delivered_create THEN
        v_state := 'open';
        v_resolution := 'create';
        v_opportunity_target := NULL;
    ELSE
        -- Unknown is production-ineligible. no_page lands here after a create
        -- was already delivered: the honest next action is publication, not a
        -- second draft for the same durable question.
        v_state := 'needs_input';
        v_resolution := 'unknown';
        v_opportunity_target := NULL;
    END IF;

    UPDATE public.tracked_prompts
    SET coverage_state = p_coverage_state,
        target_url = CASE
            WHEN p_coverage_state = 'has_page' THEN v_target_url
            ELSE NULL
        END
    WHERE id = v_tracked.id;

    UPDATE public.content_opportunities
    SET state = v_state,
        resolution_type = v_resolution,
        target_url = v_opportunity_target,
        resolved_at = NULL
    WHERE id = v_opportunity.id;

    RETURN jsonb_build_object(
        'tracked_prompt_id', v_tracked.id,
        'opportunity_id', v_opportunity.id,
        'coverage_state', p_coverage_state,
        'target_url', CASE
            WHEN p_coverage_state = 'has_page' THEN v_target_url
            ELSE NULL
        END,
        'state', v_state,
        'resolution_type', v_resolution,
        'delivered_create_exists', v_delivered_create
    );
END;
$$;

REVOKE ALL ON FUNCTION public.triage_content_opportunity_target(UUID, TEXT, TEXT)
    FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.triage_content_opportunity_target(UUID, TEXT, TEXT)
    TO authenticated;

DO $$
BEGIN
    COMMENT ON FUNCTION public.triage_content_opportunity_target(UUID, TEXT, TEXT) IS
        'Atomically saves an explicit customer target-page decision and updates the matching losing opportunity.';
END;
$$;

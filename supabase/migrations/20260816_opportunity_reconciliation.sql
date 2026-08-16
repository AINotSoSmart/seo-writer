-- ============================================================================
-- Subscription Phase 4: replay-safe opportunity reconciliation
-- ============================================================================
-- One measured tracked question owns one durable opportunity. A new probe
-- updates that row; it never subtracts delivered drafts and never creates a
-- second backlog row for the same question.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_content_opportunities(
    p_run_id UUID,
    p_findings JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    -- This is a product policy, not a caller-controlled tuning parameter.
    -- Change it deliberately in a forward migration after validation.
    v_monitoring_days CONSTANT INTEGER := 21;
    v_run public.ai_probe_runs%ROWTYPE;
    v_finding JSONB;
    v_tracked public.tracked_prompts%ROWTYPE;
    v_opportunity_id UUID;
    v_existing_state TEXT;
    v_existing_resolution TEXT;
    v_existing_target_url TEXT;
    v_delivered_type TEXT;
    v_delivered_target_url TEXT;
    v_delivered_at TIMESTAMPTZ;
    v_observed_at TIMESTAMPTZ;
    v_state TEXT;
    v_resolution TEXT;
    v_target_url TEXT;
    v_reason TEXT;
    v_expected_count INTEGER;
    v_unique_count INTEGER;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
    v_open INTEGER := 0;
    v_needs_input INTEGER := 0;
    v_monitoring INTEGER := 0;
    v_resolved INTEGER := 0;
    v_dismissed INTEGER := 0;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Opportunity reconciliation is service-role only';
    END IF;

    IF jsonb_typeof(p_findings) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Opportunity findings must be a JSON array';
    END IF;

    SELECT * INTO v_run
    FROM public.ai_probe_runs
    WHERE id = p_run_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Probe run does not exist';
    END IF;

    IF v_run.status NOT IN ('running', 'completed') THEN
        RAISE EXCEPTION 'Only a running or completed probe can reconcile opportunities';
    END IF;

    -- Serialize this brand, including two different run ids racing to update
    -- the same durable question set.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_run.brand_id::TEXT, 0));

    SELECT COUNT(*) INTO v_expected_count
    FROM public.ai_probe_prompts prompt_row
    WHERE prompt_row.run_id = p_run_id
      AND prompt_row.answers_total > 0;

    IF jsonb_array_length(p_findings) <> v_expected_count THEN
        RAISE EXCEPTION
            'Findings must account for every observed run prompt (expected %, received %)',
            v_expected_count,
            jsonb_array_length(p_findings);
    END IF;

    SELECT COUNT(DISTINCT finding->>'tracked_prompt_id') INTO v_unique_count
    FROM jsonb_array_elements(p_findings) finding;

    IF v_unique_count <> v_expected_count THEN
        RAISE EXCEPTION 'Every observed prompt must have one unique tracked-question finding';
    END IF;

    -- Anchor the policy window to the stored observation, never to replay time.
    SELECT COALESCE(MAX(result_row.observed_at), v_run.started_at)
    INTO v_observed_at
    FROM public.ai_probe_results result_row
    WHERE result_row.run_id = p_run_id;

    FOR v_finding IN
        SELECT value FROM jsonb_array_elements(p_findings)
    LOOP
        IF COALESCE(v_finding->>'tracked_prompt_id', '') = ''
           OR COALESCE(v_finding->>'verdict', '') NOT IN ('absent', 'outranked', 'present')
           OR length(btrim(COALESCE(v_finding->>'reason', ''))) = 0
        THEN
            RAISE EXCEPTION 'Each finding requires tracked_prompt_id, verdict and evidence reason';
        END IF;

        SELECT tracked.* INTO v_tracked
        FROM public.tracked_prompts tracked
        JOIN public.ai_probe_prompts prompt_row
          ON prompt_row.tracked_prompt_id = tracked.id
         AND prompt_row.run_id = p_run_id
         AND prompt_row.answers_total > 0
        WHERE tracked.id = (v_finding->>'tracked_prompt_id')::UUID
          AND tracked.user_id = v_run.user_id
          AND tracked.brand_id = v_run.brand_id
          AND prompt_row.verdict = v_finding->>'verdict';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Finding does not match an observed prompt and its persisted verdict';
        END IF;

        v_opportunity_id := NULL;
        v_existing_state := NULL;
        v_existing_resolution := NULL;
        v_existing_target_url := NULL;

        SELECT opportunity.id,
               opportunity.state,
               opportunity.resolution_type,
               opportunity.target_url
        INTO v_opportunity_id,
             v_existing_state,
             v_existing_resolution,
             v_existing_target_url
        FROM public.content_opportunities opportunity
        WHERE opportunity.brand_id = v_run.brand_id
          AND opportunity.tracked_prompt_id = v_tracked.id
        FOR UPDATE;

        v_delivered_type := NULL;
        v_delivered_target_url := NULL;
        v_delivered_at := NULL;

        IF v_opportunity_id IS NOT NULL THEN
            SELECT action_row.resolution_type,
                   action_row.target_url,
                   action_row.delivered_at
            INTO v_delivered_type,
                 v_delivered_target_url,
                 v_delivered_at
            FROM public.cycle_action_opportunities link_row
            JOIN public.cycle_actions action_row
              ON action_row.id = link_row.cycle_action_id
            WHERE link_row.opportunity_id = v_opportunity_id
              AND action_row.state = 'delivered'
              AND action_row.delivered_at IS NOT NULL
            ORDER BY action_row.delivered_at DESC, action_row.id DESC
            LIMIT 1;
        END IF;

        v_target_url := COALESCE(
            v_tracked.target_url,
            v_delivered_target_url,
            v_existing_target_url
        );
        v_reason := btrim(v_finding->>'reason');

        -- A retired/inactive question keeps its evidence row but can never
        -- enter production, regardless of its latest verdict.
        IF v_tracked.tracking_status <> 'active' THEN
            v_state := 'dismissed';
            v_resolution := 'report_only';
            v_reason := v_reason || ' This tracked question is no longer active.';

        -- Only a fresh measurement can close visibility. A delivered draft is
        -- intentionally absent from this branch.
        ELSIF v_finding->>'verdict' = 'present' THEN
            v_state := 'resolved';
            v_resolution := 'unknown';
            v_reason := v_reason || ' The latest measurement now shows a win.';

        -- Preserve an explicit dismissal while the question remains losing.
        ELSIF v_existing_state = 'dismissed' THEN
            v_state := 'dismissed';
            v_resolution := 'report_only';
            v_reason := v_reason || ' This opportunity remains dismissed.';

        ELSIF v_delivered_at IS NOT NULL
              AND v_observed_at < v_delivered_at + make_interval(days => v_monitoring_days)
        THEN
            v_state := 'monitoring';
            v_resolution := v_delivered_type;
            v_reason := v_reason || format(
                ' The delivered %s action is still inside the %s-day observation window.',
                v_delivered_type,
                v_monitoring_days
            );

        -- A prior refresh already has an explicit live target. Once its window
        -- expires, another refresh may be considered. A prior create was only
        -- a delivered draft, so publication/target confirmation is required
        -- before any second action can be selected.
        ELSIF v_delivered_at IS NOT NULL AND v_delivered_type = 'refresh' THEN
            v_state := 'open';
            v_resolution := 'refresh';
            v_reason := v_reason || format(
                ' The prior refresh has remained losing beyond the %s-day observation window.',
                v_monitoring_days
            );
        ELSIF v_delivered_at IS NOT NULL THEN
            v_state := 'needs_input';
            v_resolution := 'unknown';
            v_reason := v_reason ||
                ' Confirm where the delivered draft was published before selecting another action.';

        ELSIF v_tracked.coverage_state = 'no_page' THEN
            v_state := 'open';
            v_resolution := 'create';
        ELSIF v_tracked.coverage_state = 'has_page' THEN
            v_state := 'open';
            v_resolution := 'refresh';
        ELSE
            v_state := 'needs_input';
            v_resolution := 'unknown';
            v_reason := v_reason ||
                ' Page coverage is unknown, so create versus refresh requires input.';
        END IF;

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
        ) VALUES (
            v_run.user_id,
            v_run.brand_id,
            v_tracked.id,
            v_state,
            v_resolution,
            p_run_id,
            p_run_id,
            v_finding->>'verdict',
            CASE
                WHEN v_finding->>'verdict' = 'present' THEN NULL
                ELSE (v_finding->>'priority')::REAL
            END,
            v_reason,
            v_target_url,
            CASE WHEN v_state = 'resolved' THEN v_observed_at ELSE NULL END
        )
        ON CONFLICT (brand_id, tracked_prompt_id) DO UPDATE
        SET state = EXCLUDED.state,
            resolution_type = EXCLUDED.resolution_type,
            last_seen_run_id = EXCLUDED.last_seen_run_id,
            last_verdict = EXCLUDED.last_verdict,
            last_priority = EXCLUDED.last_priority,
            last_reason = EXCLUDED.last_reason,
            target_url = EXCLUDED.target_url,
            resolved_at = EXCLUDED.resolved_at;

        IF v_opportunity_id IS NULL THEN
            v_inserted := v_inserted + 1;
        ELSE
            v_updated := v_updated + 1;
        END IF;

        CASE v_state
            WHEN 'open' THEN v_open := v_open + 1;
            WHEN 'needs_input' THEN v_needs_input := v_needs_input + 1;
            WHEN 'monitoring' THEN v_monitoring := v_monitoring + 1;
            WHEN 'resolved' THEN v_resolved := v_resolved + 1;
            WHEN 'dismissed' THEN v_dismissed := v_dismissed + 1;
            ELSE RAISE EXCEPTION 'Unexpected opportunity state %', v_state;
        END CASE;
    END LOOP;

    RETURN jsonb_build_object(
        'observed', v_expected_count,
        'inserted', v_inserted,
        'updated', v_updated,
        'open', v_open,
        'needs_input', v_needs_input,
        'monitoring', v_monitoring,
        'resolved', v_resolved,
        'dismissed', v_dismissed,
        'policy_version', 'opportunity-reconciliation-v1',
        'monitoring_days', v_monitoring_days
    );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_content_opportunities(UUID, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_content_opportunities(UUID, JSONB)
    TO service_role;

DO $$
BEGIN
    COMMENT ON FUNCTION public.reconcile_content_opportunities(UUID, JSONB) IS
        'Atomically reconciles observed tracked questions into one durable opportunity each; service role only.';
END;
$$;

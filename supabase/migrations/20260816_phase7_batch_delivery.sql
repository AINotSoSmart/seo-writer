-- ============================================================================
-- Subscription Phase 7: create generation, assisted refresh, atomic release
-- ============================================================================
-- Create actions use the existing evidence-bound writer. Refresh actions are
-- deliberately founder-assisted at launch: a reviewed replacement draft is
-- attached to the selected action through one service-role transaction.
-- ============================================================================

ALTER TABLE public.cycle_actions
    ADD COLUMN IF NOT EXISTS assisted_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS assisted_by_user_id UUID;

-- A refresh must never fall through to the create writer. Re-emit the claim
-- boundary with an explicit create-only condition.
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
      AND action_row.resolution_type = 'create'
      AND action_row.state IN ('selected', 'failed')
      AND action_row.retry_count < 3
      AND cycle_row.state = 'producing'
      AND program_row.status = 'active'
    FOR UPDATE OF action_row;

    IF NOT FOUND THEN RETURN; END IF;

    SELECT id INTO v_planned_id
    FROM public.planned_articles
    WHERE cycle_action_id = v_action.id
      AND record_kind = 'cycle_output';
    IF v_planned_id IS NULL THEN
        RAISE EXCEPTION 'Selected create action has no cycle output';
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

CREATE OR REPLACE FUNCTION public.complete_founder_assisted_refresh(
    p_cycle_action_id UUID,
    p_markdown TEXT,
    p_html TEXT,
    p_actor_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_action public.cycle_actions%ROWTYPE;
    v_cycle public.subscription_cycles%ROWTYPE;
    v_planned public.planned_articles%ROWTYPE;
    v_article_id UUID;
    v_link RECORD;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Assisted refresh completion is service-role only';
    END IF;
    IF p_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'The assisting founder identity is required';
    END IF;
    IF length(btrim(COALESCE(p_markdown, ''))) < 300
       OR length(btrim(COALESCE(p_html, ''))) < 300
    THEN
        RAISE EXCEPTION 'A reviewed refresh draft must contain at least 300 characters';
    END IF;

    SELECT * INTO v_action
    FROM public.cycle_actions
    WHERE id = p_cycle_action_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Refresh action not found'; END IF;
    IF v_action.resolution_type <> 'refresh' THEN
        RAISE EXCEPTION 'Only refresh actions accept a founder-assisted draft';
    END IF;

    SELECT * INTO v_cycle
    FROM public.subscription_cycles
    WHERE id = v_action.cycle_id
      AND state IN ('producing', 'ready', 'delivered')
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Refresh cycle is not deliverable'; END IF;

    SELECT * INTO v_planned
    FROM public.planned_articles
    WHERE cycle_action_id = v_action.id
      AND record_kind = 'cycle_output'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Refresh action has no cycle output'; END IF;
    IF v_planned.target_url IS NULL OR v_planned.target_url <> v_action.target_url THEN
        RAISE EXCEPTION 'Refresh output does not preserve its confirmed target URL';
    END IF;

    IF v_action.state = 'delivered' THEN
        IF v_planned.article_id IS NULL THEN
            RAISE EXCEPTION 'Delivered refresh has no article';
        END IF;
        RETURN v_planned.article_id;
    END IF;
    IF v_action.state NOT IN ('selected', 'failed', 'ready') THEN
        RAISE EXCEPTION 'Refresh action is already being changed';
    END IF;

    -- Founder-assisted content must still honour the selected-only graph. The
    -- founder workbench displays these exact URLs before accepting the draft.
    FOR v_link IN
        SELECT target_url
        FROM public.planned_article_links
        WHERE cycle_id = v_cycle.id
          AND source_article_id = v_planned.id
    LOOP
        IF position(('href="' || v_link.target_url || '"') IN p_html) = 0
           AND position(
               ('href="' || replace(v_link.target_url, '&', '&amp;') || '"')
               IN p_html
           ) = 0
        THEN
            RAISE EXCEPTION 'Refresh draft is missing frozen link %', v_link.target_url;
        END IF;
    END LOOP;

    v_article_id := v_planned.article_id;
    IF v_article_id IS NULL THEN
        INSERT INTO public.articles (
            user_id, brand_id, keyword, status, outline, raw_content,
            final_html, slug, planned_article_id, delivery_visible_at
        ) VALUES (
            v_action.user_id,
            v_action.brand_id,
            v_planned.main_keyword,
            'completed',
            jsonb_build_object('title', v_planned.title, 'assistedRefresh', TRUE),
            p_markdown,
            p_html,
            v_planned.slug,
            v_planned.id,
            NULL
        )
        RETURNING id INTO v_article_id;
    ELSE
        UPDATE public.articles
        SET keyword = v_planned.main_keyword,
            status = 'completed',
            outline = jsonb_build_object('title', v_planned.title, 'assistedRefresh', TRUE),
            raw_content = p_markdown,
            final_html = p_html,
            error_message = NULL,
            failed_at_phase = NULL,
            slug = v_planned.slug,
            updated_at = now()
        WHERE id = v_article_id
          AND user_id = v_action.user_id
          AND brand_id = v_action.brand_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'Existing refresh article ownership mismatch'; END IF;
    END IF;

    UPDATE public.planned_articles
    SET article_id = v_article_id,
        status = 'writing',
        generation_status = 'generated',
        generated_at = COALESCE(generated_at, now()),
        generation_error = NULL,
        updated_at = now()
    WHERE id = v_planned.id;

    UPDATE public.cycle_actions
    SET state = 'ready',
        ready_at = COALESCE(ready_at, now()),
        assisted_completed_at = now(),
        assisted_by_user_id = p_actor_user_id,
        generation_started_at = NULL,
        failure_code = NULL,
        updated_at = now()
    WHERE id = v_action.id;

    IF NOT EXISTS (
        SELECT 1 FROM public.cycle_actions
        WHERE cycle_id = v_cycle.id AND state <> 'ready'
    ) THEN
        UPDATE public.subscription_cycles
        SET state = 'ready', failure_code = NULL, updated_at = now()
        WHERE id = v_cycle.id AND state = 'producing';
    END IF;

    RETURN v_article_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_founder_assisted_refresh(UUID, TEXT, TEXT, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_founder_assisted_refresh(UUID, TEXT, TEXT, UUID)
    TO service_role;

-- Called by the writer and the assisted-refresh endpoint. Concurrent last
-- outputs serialize on the cycle; only the caller that observes every action
-- ready reaches the existing atomic batch-delivery transaction.
CREATE OR REPLACE FUNCTION public.release_subscription_cycle_if_ready(p_cycle_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_cycle public.subscription_cycles%ROWTYPE;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Cycle release is service-role only';
    END IF;

    SELECT * INTO v_cycle
    FROM public.subscription_cycles
    WHERE id = p_cycle_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Subscription cycle not found'; END IF;
    IF v_cycle.state = 'delivered' THEN RETURN TRUE; END IF;
    IF v_cycle.state NOT IN ('producing', 'ready') THEN RETURN FALSE; END IF;

    IF EXISTS (
        SELECT 1 FROM public.cycle_actions
        WHERE cycle_id = p_cycle_id AND state <> 'ready'
    ) THEN
        RETURN FALSE;
    END IF;

    UPDATE public.subscription_cycles
    SET state = 'ready', failure_code = NULL, updated_at = now()
    WHERE id = p_cycle_id AND state = 'producing';

    RETURN public.deliver_subscription_cycle(p_cycle_id);
END;
$$;

REVOKE ALL ON FUNCTION public.release_subscription_cycle_if_ready(UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_subscription_cycle_if_ready(UUID)
    TO service_role;

DO $$
BEGIN
    COMMENT ON FUNCTION public.complete_founder_assisted_refresh(UUID, TEXT, TEXT, UUID) IS
        'Attaches one reviewed replacement draft to a selected refresh action without creating or publishing a second page.';
    COMMENT ON FUNCTION public.release_subscription_cycle_if_ready(UUID) IS
        'Releases one complete selected batch only when every action is ready.';
END;
$$;

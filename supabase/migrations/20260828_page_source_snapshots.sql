-- ============================================================================
-- Page Source Snapshots & Cycle Action Claim Support for Improvements
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.page_source_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES public.brand_details(id) ON DELETE CASCADE,
    target_url TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'html'
        CHECK (source_type IN ('html', 'wordpress', 'manual')),
    cms_connection_id UUID REFERENCES public.wordpress_connections(id) ON DELETE SET NULL,
    cms_object_type TEXT,
    cms_object_id BIGINT,
    source_content TEXT NOT NULL,
    normalized_document JSONB NOT NULL DEFAULT '{}'::JSONB,
    source_hash TEXT NOT NULL,
    source_modified_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_source_snapshots_brand_url
    ON public.page_source_snapshots(brand_id, target_url);

ALTER TABLE public.page_source_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own snapshots" ON public.page_source_snapshots;
CREATE POLICY "Users can view own snapshots"
    ON public.page_source_snapshots FOR SELECT
    USING (auth.uid() = user_id);

ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS source_snapshot_id UUID REFERENCES public.page_source_snapshots(id) ON DELETE SET NULL;

-- Support claiming both 'create' and 'refresh' (improve existing) actions
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
      AND action_row.resolution_type IN ('create', 'refresh')
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
        RAISE EXCEPTION 'Selected action has no cycle output';
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

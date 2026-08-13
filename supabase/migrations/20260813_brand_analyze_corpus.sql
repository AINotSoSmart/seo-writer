-- ============================================================================
-- Brand analyze corpus checkpoint
-- ============================================================================
-- Onboarding crawl used to live only in the browser fetch. Refresh aborted the
-- stream, dropped crawledPages (React state), and the next Analyze/scope call
-- paid Tavily again. This table is the artifact: write pages as soon as extract
-- finishes, skip Tavily on a 24h hit, refuse overlapping runs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.brand_analyze_corpus (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    host text NOT NULL,
    pages jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'running',
    started_at timestamptz NOT NULL DEFAULT now(),
    ready_at timestamptz,
    tavily_started_at timestamptz,
    PRIMARY KEY (user_id, host),
    CONSTRAINT brand_analyze_corpus_status_check
        CHECK (status IN ('running', 'ready')),
    CONSTRAINT brand_analyze_corpus_host_check
        CHECK (host = lower(host) AND host NOT LIKE 'www.%')
);

CREATE INDEX IF NOT EXISTS brand_analyze_corpus_user_started_idx
    ON public.brand_analyze_corpus (user_id, started_at DESC);

ALTER TABLE public.brand_analyze_corpus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_analyze_corpus_select_own ON public.brand_analyze_corpus;
CREATE POLICY brand_analyze_corpus_select_own
    ON public.brand_analyze_corpus FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS brand_analyze_corpus_insert_own ON public.brand_analyze_corpus;
CREATE POLICY brand_analyze_corpus_insert_own
    ON public.brand_analyze_corpus FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS brand_analyze_corpus_update_own ON public.brand_analyze_corpus;
CREATE POLICY brand_analyze_corpus_update_own
    ON public.brand_analyze_corpus FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'brand_analyze_corpus'
    ) THEN
        COMMENT ON TABLE public.brand_analyze_corpus IS
            'Per-user 24h checkpoint of the 8-page brand crawl. Refresh cannot resume the HTTP stream; it must reuse this artifact instead of extracting again.';
    END IF;
END $$;

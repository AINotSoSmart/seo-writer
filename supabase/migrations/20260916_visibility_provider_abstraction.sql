-- ============================================================================
-- AI visibility: Provider abstraction (Bright Data + Cloro fallback)
-- ============================================================================
-- Safe, additive forward migration. Replay-safe.

ALTER TABLE public.ai_probe_results
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'brightdata';

ALTER TABLE public.ai_probe_results
    ADD COLUMN IF NOT EXISTS provider_task_id TEXT;

-- For backward compatibility with existing rows: populate provider_task_id from cloro_task_id if empty
UPDATE public.ai_probe_results
SET provider = 'cloro', provider_task_id = cloro_task_id
WHERE cloro_task_id IS NOT NULL AND provider_task_id IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_probe_results'
          AND column_name = 'provider'
    ) THEN
        COMMENT ON COLUMN public.ai_probe_results.provider IS
            'Scraper provider used for this answer (e.g. brightdata, cloro, openai, anthropic).';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_probe_results'
          AND column_name = 'provider_task_id'
    ) THEN
        COMMENT ON COLUMN public.ai_probe_results.provider_task_id IS
            'The asynchronous snapshot or task ID returned by the provider (e.g. Bright Data snapshot_id or Cloro task_id).';
    END IF;
END $$;

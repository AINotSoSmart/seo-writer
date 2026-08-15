-- ============================================================================
-- AI visibility: consumer surfaces, credit accounting, async run progress
-- ============================================================================
-- Follows `20260815_ai_visibility_probe.sql`. Additive and replay-safe.
--
-- WHY THIS EXISTS
--
-- The probe originally called the provider APIs (OpenAI Responses + web_search,
-- Gemini with googleSearch grounding). That measured the wrong thing. Petra
-- Labs ran 900 trials across paid ChatGPT, free ChatGPT and the API on the same
-- prompts on the same day: the same brand's visibility moved 32 percentage
-- points across those three surfaces, and one brand appeared in 15-18% of chat
-- trials and *zero* API trials. Ansvisor — whose tracker this project studied —
-- ships `allowedModels: []` on every paid tier for the same reason; its
-- commercial product is scraper-only.
--
-- Answers now come from Cloro, which drives the real consumer surfaces. The
-- API path is retained for self-hosters without a Cloro key.
--
-- `surface` is therefore load-bearing, not decorative: a consumer-app answer
-- and an API answer are measurements of different things and must never be
-- averaged into one number. Every read path filters or groups by it.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. ai_probe_results — surface, credits, and the vendor task id
-- ----------------------------------------------------------------------------
ALTER TABLE public.ai_probe_results
    ADD COLUMN IF NOT EXISTS surface TEXT NOT NULL DEFAULT 'consumer_app';

ALTER TABLE public.ai_probe_results
    ADD COLUMN IF NOT EXISTS cloro_task_id TEXT;

ALTER TABLE public.ai_probe_results
    ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 0;

-- The sub-queries the engine actually ran, when the surface exposes them
-- (Perplexity and Copilot populate it; ChatGPT returns the key empty). This is
-- observed data — never synthesised — and it is the most direct evidence
-- available of how a surface decomposed a buyer's question.
ALTER TABLE public.ai_probe_results
    ADD COLUMN IF NOT EXISTS search_queries JSONB NOT NULL DEFAULT '[]';

ALTER TABLE public.ai_probe_results
    DROP CONSTRAINT IF EXISTS ai_probe_results_surface_allowed;

ALTER TABLE public.ai_probe_results
    ADD CONSTRAINT ai_probe_results_surface_allowed
    CHECK (surface IN ('consumer_app', 'api'));

CREATE INDEX IF NOT EXISTS ai_probe_results_surface_idx
    ON ai_probe_results (run_id, surface);


-- ----------------------------------------------------------------------------
-- 2. ai_probe_runs — cost and live progress
-- ----------------------------------------------------------------------------
-- Cloro bills in credits and only for successful extractions. Storing the
-- consumed total per run makes the vendor invoice auditable against our own
-- record, which is the difference between knowing unit cost and guessing it.
ALTER TABLE public.ai_probe_runs
    ADD COLUMN IF NOT EXISTS credits_used INTEGER NOT NULL DEFAULT 0;

-- A Cloro task is queued work, so a probe now runs on Trigger.dev rather than
-- in a request. These carry the progress a polling client renders.
ALTER TABLE public.ai_probe_runs
    ADD COLUMN IF NOT EXISTS phase TEXT;

ALTER TABLE public.ai_probe_runs
    ADD COLUMN IF NOT EXISTS phase_detail TEXT;

ALTER TABLE public.ai_probe_runs
    ADD COLUMN IF NOT EXISTS trigger_run_id TEXT;

ALTER TABLE public.ai_probe_runs
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- A probe whose Trigger job never starts must not show a loader forever. The
-- same 20-minute abandonment rule the audit path learned the hard way.
CREATE INDEX IF NOT EXISTS ai_probe_runs_stale_idx
    ON ai_probe_runs (status, started_at)
    WHERE status = 'running';


-- ----------------------------------------------------------------------------
-- 3. Comments, guarded so a replay against an ahead database cannot abort
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_probe_results'
          AND column_name = 'surface'
    ) THEN
        COMMENT ON COLUMN public.ai_probe_results.surface IS
            'consumer_app = the real ChatGPT / Google AI Mode answer via Cloro. api = the provider developer API, a materially weaker proxy (32-point divergence measured across OpenAI surfaces). Never average the two into one visibility number.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_probe_results'
          AND column_name = 'credits_used'
    ) THEN
        COMMENT ON COLUMN public.ai_probe_results.credits_used IS
            'Cloro credits consumed by this single answer. Cloro does not bill failed extractions, so this is counted on success only.';
    END IF;
END $$;

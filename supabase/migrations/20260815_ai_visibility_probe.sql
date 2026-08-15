-- ============================================================================
-- AI visibility probe: observed answer-engine gaps as a harvest source
-- ============================================================================
-- Adds the closed loop described in docs/PIVOT.md §8:
--
--     confirmed families -> buyer prompts -> answer engines -> observed
--     absence -> gap -> the existing clusterer
--
-- Why this is additive and nothing is edited: `20260728_harvest_pool.sql`
-- creates its tables with `CREATE TABLE IF NOT EXISTS`, so editing it to widen
-- the `source` CHECK would be a silent no-op against every database that
-- already has `query_pool` — the repo would say 'ai_answer' is allowed and
-- Postgres would keep rejecting it at write time. See rule 13.
--
-- Every statement here is safe to replay against a database that is ahead of
-- this file.
--
-- PROVENANCE NOTE. The harvest's provenance rule is that every query carries a
-- re-openable `source_url`. An AI answer has no public URL: it is a private,
-- non-reproducible generation. Rather than weaken the rule or fake a URL, the
-- answer itself is stored verbatim in `ai_probe_results` and the query's
-- `source_url` points at an internal evidence permalink that renders that
-- stored row. The claim stays falsifiable — a customer can read the exact
-- answer that produced the gap — but the falsification is against our record,
-- not against a live re-fetch. That is a genuine reduction in evidential
-- strength versus a Google SERP URL, and the report says so rather than
-- implying the two are equivalent.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Widen the query_pool source vocabulary
-- ----------------------------------------------------------------------------
-- The constraint is dropped by name and recreated. `query_pool_source_check` is
-- the name Postgres assigns to an inline column CHECK on `source`; the DO block
-- finds it by definition instead of trusting that name, because a database that
-- received the table from a different path may have named it differently.
DO $$
DECLARE
    v_constraint TEXT;
BEGIN
    SELECT conname INTO v_constraint
    FROM pg_constraint
    WHERE conrelid = 'public.query_pool'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%source%autocomplete%';

    IF v_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.query_pool DROP CONSTRAINT %I', v_constraint);
    END IF;
END $$;

ALTER TABLE public.query_pool
    DROP CONSTRAINT IF EXISTS query_pool_source_allowed;

ALTER TABLE public.query_pool
    ADD CONSTRAINT query_pool_source_allowed
    CHECK (source IN ('autocomplete', 'paa', 'competitor_sitemap', 'ai_answer'));


-- ----------------------------------------------------------------------------
-- 2. ai_probe_runs — one probe of one audit at one point in time
-- ----------------------------------------------------------------------------
-- Immutable, like `topical_audits`. A re-probe is a new row, never an update:
-- the entire value of a trend line is that the earlier measurement was not
-- rewritten once the later one disagreed with it.
CREATE TABLE IF NOT EXISTS ai_probe_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brand_details(id) ON DELETE CASCADE,
    audit_id UUID REFERENCES topical_audits(id) ON DELETE SET NULL,

    subject_name TEXT NOT NULL,
    subject_domains TEXT[] NOT NULL DEFAULT '{}',
    competitors JSONB NOT NULL DEFAULT '[]',

    engines TEXT[] NOT NULL DEFAULT '{}',
    country_code TEXT,

    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed')),
    failure_reason TEXT,

    -- Headline observations. Deliberately plain counts, not a composite score:
    -- "named in 9 of 42 answers" is checkable by opening the 42 stored answers.
    prompt_count INTEGER NOT NULL DEFAULT 0,
    answer_count INTEGER NOT NULL DEFAULT 0,
    present_answer_count INTEGER NOT NULL DEFAULT 0,
    gap_prompt_count INTEGER NOT NULL DEFAULT 0,

    -- Per-engine attempted/succeeded/failed, so a broken key can never be
    -- read as "the brand is invisible". Same contract as source_call_ledger.
    engine_ledger JSONB NOT NULL DEFAULT '[]',

    -- Frozen at completion: the rival leaderboard, cited hosts and headline
    -- rates as computed from this run's answers, plus the cluster plan those
    -- gaps produced. Stored rather than recomputed on read for the same reason
    -- the audit freezes its plan — a report that silently recalculates is a
    -- report whose numbers change under the customer while they read it.
    summary JSONB NOT NULL DEFAULT '{}',
    clusters JSONB NOT NULL DEFAULT '[]',

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Public sharing reuses the audit report's token model: long random token,
    -- noindex, revocable.
    public_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex')
);

CREATE INDEX IF NOT EXISTS ai_probe_runs_brand_idx
    ON ai_probe_runs (brand_id, started_at DESC);
CREATE INDEX IF NOT EXISTS ai_probe_runs_audit_idx
    ON ai_probe_runs (audit_id);


-- ----------------------------------------------------------------------------
-- 3. ai_probe_prompts — the buyer questions asked, owned by one family each
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_probe_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES ai_probe_runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Same invariant as query_pool: exactly one confirmed family owns it.
    scope_family_id UUID NOT NULL REFERENCES audit_scope_families(id) ON DELETE CASCADE,

    prompt TEXT NOT NULL,
    prompt_norm TEXT NOT NULL,
    intent TEXT NOT NULL,
    article_type TEXT NOT NULL
        CHECK (article_type IN ('informational', 'commercial', 'howto')),
    source_seed TEXT NOT NULL,

    -- Rolled up from this prompt's answers across every engine.
    answers_total INTEGER NOT NULL DEFAULT 0,
    answers_present INTEGER NOT NULL DEFAULT 0,
    mean_mention_position REAL,
    -- 'absent' | 'outranked' | 'present' — computed, never hand-tuned.
    verdict TEXT NOT NULL DEFAULT 'absent'
        CHECK (verdict IN ('absent', 'outranked', 'present')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (run_id, prompt_norm)
);

CREATE INDEX IF NOT EXISTS ai_probe_prompts_run_idx
    ON ai_probe_prompts (run_id, verdict);


-- ----------------------------------------------------------------------------
-- 4. ai_probe_results — one engine's verbatim answer. THE evidence record.
-- ----------------------------------------------------------------------------
-- `answer_text` is the provenance. It is stored in full and never truncated:
-- a gap whose supporting answer has been summarised away is exactly the
-- unverifiable claim this product exists to avoid making.
CREATE TABLE IF NOT EXISTS ai_probe_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID NOT NULL REFERENCES ai_probe_prompts(id) ON DELETE CASCADE,
    run_id UUID NOT NULL REFERENCES ai_probe_runs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    engine TEXT NOT NULL,
    model TEXT NOT NULL,

    answer_text TEXT NOT NULL,
    citations JSONB NOT NULL DEFAULT '[]',

    mention_count INTEGER NOT NULL DEFAULT 0,
    citation_count INTEGER NOT NULL DEFAULT 0,
    total_citations INTEGER NOT NULL DEFAULT 0,
    mention_position INTEGER,
    mentioned_entity_count INTEGER NOT NULL DEFAULT 0,
    competitor_mentions JSONB NOT NULL DEFAULT '[]',

    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (prompt_id, engine)
);

CREATE INDEX IF NOT EXISTS ai_probe_results_run_idx
    ON ai_probe_results (run_id, engine);


-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
ALTER TABLE ai_probe_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_probe_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_probe_results ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['ai_probe_runs', 'ai_probe_prompts', 'ai_probe_results']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Users manage own %1$s" ON %1$s', t);
        EXECUTE format(
            'CREATE POLICY "Users manage own %1$s" ON %1$s FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
            t
        );

        EXECUTE format('DROP POLICY IF EXISTS "Service role full access %1$s" ON %1$s', t);
        EXECUTE format(
            'CREATE POLICY "Service role full access %1$s" ON %1$s FOR ALL USING (auth.role() = ''service_role'')',
            t
        );
    END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- 6. Comments, guarded so a replay against an ahead database cannot abort
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ai_probe_results'
    ) THEN
        COMMENT ON TABLE public.ai_probe_results IS
            'Verbatim answer-engine responses. This is the provenance record for every ai_answer gap: an AI answer has no public URL, so the stored text is what makes the claim falsifiable. Never truncate answer_text.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ai_probe_prompts'
          AND column_name = 'verdict'
    ) THEN
        COMMENT ON COLUMN public.ai_probe_prompts.verdict IS
            'absent = named in no answer; outranked = named but behind a competitor in every answer that named it; present = named first in at least one answer. Derived from counted facts, never a tuned score threshold.';
    END IF;
END $$;

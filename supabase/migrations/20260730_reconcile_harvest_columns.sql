-- ============================================================================
-- Reconcile closed-pool table columns
-- ============================================================================
-- Production failed at persistence with:
--
--     column "observed_value" of relation "query_pool" does not exist
--
-- ROOT CAUSE: `20260728_harvest_pool.sql` was edited in place after it had
-- already been applied. Its tables are created with `CREATE TABLE IF NOT
-- EXISTS`, so re-running it against a database where `query_pool` already
-- existed did nothing at all — the columns added by the later edit
-- (`observed_value`, `observed_at`, and the `source_url NOT NULL` tightening)
-- never reached the schema. `20260730_closed_pool_v2.sql` then *referenced*
-- `observed_value` in a trigger and in `finalize_audit_run` without ever adding
-- it, so the mismatch only surfaced at write time, after a full audit had run.
--
-- Editing an applied migration is the actual mistake. This file exists to
-- converge any database to the intended schema whichever version of that file
-- it originally received, and every statement is safe to re-run.
--
-- Adding NOT NULL columns to a table that may already hold rows is done in
-- three steps — add nullable, backfill, then constrain — because a bare
-- `ADD COLUMN ... NOT NULL` fails on any existing row.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- query_pool
-- ----------------------------------------------------------------------------
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS observed_value TEXT;
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS source_seed TEXT;
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS covered_by_url TEXT;
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS covered_by_title TEXT;
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS coverage_similarity REAL;
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS competitor_matches JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.query_pool ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Provenance is the product. A row without the observed string cannot be
-- verified, so backfill from `query` (they are identical for every row written
-- before the column existed) and then enforce it.
UPDATE public.query_pool SET observed_value = query WHERE observed_value IS NULL;
UPDATE public.query_pool SET source_url = '' WHERE source_url IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.query_pool WHERE observed_value IS NULL
    ) THEN
        ALTER TABLE public.query_pool ALTER COLUMN observed_value SET NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.query_pool WHERE source_url IS NULL
    ) THEN
        ALTER TABLE public.query_pool ALTER COLUMN source_url SET NOT NULL;
    END IF;
END $$;


-- ----------------------------------------------------------------------------
-- audit_clusters
-- ----------------------------------------------------------------------------
ALTER TABLE public.audit_clusters ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.audit_clusters ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 100;
ALTER TABLE public.audit_clusters ADD COLUMN IF NOT EXISTS article_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.audit_clusters ADD COLUMN IF NOT EXISTS competitor_urls JSONB NOT NULL DEFAULT '[]'::jsonb;


-- ----------------------------------------------------------------------------
-- planned_articles
-- ----------------------------------------------------------------------------
ALTER TABLE public.planned_articles ADD COLUMN IF NOT EXISTS supporting_keywords TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.planned_articles ADD COLUMN IF NOT EXISTS source_query_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.planned_articles ADD COLUMN IF NOT EXISTS article_type TEXT NOT NULL DEFAULT 'informational';
ALTER TABLE public.planned_articles ADD COLUMN IF NOT EXISTS intent_role TEXT;
ALTER TABLE public.planned_articles ADD COLUMN IF NOT EXISTS is_pillar BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.planned_articles ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE public.planned_articles ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;


-- ----------------------------------------------------------------------------
-- programs
-- ----------------------------------------------------------------------------
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'close';
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS clusters_per_month INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS clusters_included UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS total_articles INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS completed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.programs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;


-- ----------------------------------------------------------------------------
-- Fail loudly if anything the writer needs is still missing, rather than
-- letting the next audit discover it after doing all the expensive work.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    missing TEXT;
BEGIN
    SELECT string_agg(format('%s.%s', t.table_name, t.column_name), ', ')
    INTO missing
    FROM (VALUES
        ('query_pool', 'observed_value'),
        ('query_pool', 'observed_at'),
        ('query_pool', 'source_url'),
        ('query_pool', 'competitor_matches'),
        ('audit_clusters', 'competitor_urls'),
        ('planned_articles', 'supporting_keywords'),
        ('planned_articles', 'source_query_ids'),
        ('programs', 'clusters_included')
    ) AS t(table_name, column_name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = t.table_name
          AND c.column_name = t.column_name
    );

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'Closed-pool schema is still incomplete: %', missing;
    END IF;
END $$;

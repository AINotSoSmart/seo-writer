-- ============================================================================
-- Make audit persistence see pgvector and fail schema drift before harvesting.
-- ============================================================================
--
-- Production reached the final transaction and failed with:
--
--     type "vector" does not exist
--
-- `query_pool.embedding` already uses pgvector, so the extension was installed.
-- The failure came from `finalize_audit_run`: it pins its search_path to
-- `public`, while Supabase normally installs pgvector in `extensions`. Its
-- JSON-to-vector cast is deliberately kept inside the atomic finalizer, but the
-- function must be able to resolve the column's actual type schema.
--
-- Do not hard-code `extensions`. Discover the schema from the installed
-- extension so this also works where vector was installed into `public`.

DO $$
DECLARE
    vector_schema TEXT;
BEGIN
    SELECT n.nspname
    INTO vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';

    IF vector_schema IS NULL THEN
        RAISE EXCEPTION
            'Closed-pool schema is not ready: the pgvector extension is not installed';
    END IF;

    IF to_regprocedure(
        'public.finalize_audit_run(uuid,jsonb,jsonb,jsonb,jsonb,text,text,jsonb)'
    ) IS NULL THEN
        RAISE EXCEPTION
            'Closed-pool schema is not ready: finalize_audit_run is missing';
    END IF;

    EXECUTE format(
        'ALTER FUNCTION public.finalize_audit_run(uuid,jsonb,jsonb,jsonb,jsonb,text,text,jsonb) SET search_path = public, %I',
        vector_schema
    );
END;
$$;

-- Read-only deployment preflight. The API calls this immediately before
-- creating a run and queueing external search/crawl/embedding work.
CREATE OR REPLACE FUNCTION public.assert_harvest_schema_ready()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    missing_columns TEXT;
    vector_schema TEXT;
    finalizer_config TEXT;
BEGIN
    SELECT string_agg(format('%I.%I', required.table_name, required.column_name), ', ')
    INTO missing_columns
    FROM (VALUES
        ('brand_details', 'current_audit_id'),
        ('topical_audits', 'run_status'),
        ('topical_audits', 'harvest_policy_version'),
        ('topical_audits', 'result_hash'),
        ('topical_audits', 'source_call_ledger'),
        ('query_pool', 'audit_id'),
        ('query_pool', 'source_url'),
        ('query_pool', 'observed_value'),
        ('query_pool', 'observed_at'),
        ('query_pool', 'embedding'),
        ('query_pool', 'competitor_matches'),
        ('audit_clusters', 'audit_id'),
        ('audit_clusters', 'article_count'),
        ('planned_articles', 'audit_id'),
        ('planned_articles', 'source_query_ids'),
        ('planned_articles', 'generation_status'),
        ('planned_articles', 'delivery_status'),
        ('planned_articles', 'publication_status')
    ) AS required(table_name, column_name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = required.table_name
          AND c.column_name = required.column_name
    );

    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION
            'Closed-pool schema is incomplete: %', missing_columns;
    END IF;

    SELECT n.nspname
    INTO vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';

    IF vector_schema IS NULL THEN
        RAISE EXCEPTION
            'Closed-pool schema is incomplete: pgvector is not installed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace table_ns ON table_ns.oid = c.relnamespace
        JOIN pg_type t ON t.oid = a.atttypid
        JOIN pg_namespace type_ns ON type_ns.oid = t.typnamespace
        WHERE table_ns.nspname = 'public'
          AND c.relname = 'query_pool'
          AND a.attname = 'embedding'
          AND NOT a.attisdropped
          AND t.typname = 'vector'
          AND type_ns.nspname = vector_schema
    ) THEN
        RAISE EXCEPTION
            'Closed-pool schema is incomplete: query_pool.embedding is not pgvector';
    END IF;

    SELECT array_to_string(p.proconfig, ',')
    INTO finalizer_config
    FROM pg_proc p
    WHERE p.oid = to_regprocedure(
        'public.finalize_audit_run(uuid,jsonb,jsonb,jsonb,jsonb,text,text,jsonb)'
    );

    IF finalizer_config IS NULL
       OR position(vector_schema IN finalizer_config) = 0
    THEN
        RAISE EXCEPTION
            'Closed-pool schema is incomplete: finalizer cannot resolve pgvector';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_harvest_schema_ready()
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_harvest_schema_ready()
    TO service_role;

-- ============================================================================
-- Sub-nodes and absorbed-article provenance
-- ============================================================================
-- A domain too thin to sustain its own cluster used to be destroyed. One
-- production audit measured 6 confirmed domains and 373 queries; three of those
-- domains produced real gap demand (14, 14 and 24 queries) and ZERO articles —
-- 52 of 156 gap queries, 33% of everything measured, filtered into a `residual`
-- counter in the clusterer and never seen again. The audit then showed 4
-- clusters, failed a fixed six-cluster checkout gate, and told the customer
-- their site was "not eligible for a program".
--
-- Thin domains are now absorbed in two passes:
--   * units backed by 2+ observed phrasings become standalone articles, which
--     join the nearest qualifying cluster;
--   * units backed by exactly one become sub-nodes — H2/FAQ sections the
--     writer must answer inside one of those articles.
--
-- Nothing is invented (no FAQ padding to hit a price threshold) and nothing is
-- discarded. These columns are where that survives persistence.
--
-- ON THE FOREIGN KEY: `planned_articles_cluster_scope_fkey` is
--   (cluster_id, audit_id, scope_family_id) -> audit_clusters(id, audit_id, scope_family_id)
-- so an article's family MUST equal its cluster's. That guard is load-bearing —
-- it is what stops cross-family contamination — and is not weakened here. An
-- absorbed article therefore adopts the host cluster's scope_family_id, and
-- `origin_scope_family_id` records the domain the demand was actually measured
-- under so provenance is not lost.
-- ============================================================================

ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS sub_node_intents TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS sub_node_query_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS origin_scope_family_id UUID;

-- Deliberately NOT a foreign key to audit_scope_families. This is an
-- attribution record, and adding a RESTRICT reference would make the origin
-- domain undeletable — a purge would then fail on a column that exists purely
-- to say where something came from.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'planned_articles'
          AND column_name = 'origin_scope_family_id'
    ) THEN
        COMMENT ON COLUMN public.planned_articles.origin_scope_family_id IS
            'Domain this demand was measured under when the article was absorbed into another domain''s cluster. Attribution only; scope_family_id always matches the cluster.';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- finalize_audit_run: persist the new columns.
--
-- Only the planned_articles INSERT changes. Family-ownership validation still
-- compares scope_family_id (the host) and must never compare
-- origin_scope_family_id, or every absorbed article would fail its own check.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_src TEXT;
    v_new TEXT;
BEGIN
    SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc
    WHERE oid = to_regprocedure(
        'public.finalize_audit_run(uuid,jsonb,jsonb,jsonb,jsonb,text,text,jsonb)'
    );

    IF v_src IS NULL THEN
        RAISE EXCEPTION 'finalize_audit_run is missing — apply 20260731 first';
    END IF;

    IF position('sub_node_intents' IN v_src) > 0 THEN
        RAISE NOTICE 'finalize_audit_run already persists sub-nodes; nothing to do';
        RETURN;
    END IF;

    v_new := replace(
        v_src,
        'main_keyword, supporting_keywords, source_query_ids, article_type,',
        'main_keyword, supporting_keywords, source_query_ids, sub_node_intents,'
        || ' sub_node_query_ids, origin_scope_family_id, article_type,'
    );
    v_new := replace(
        v_new,
        'ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->''source_query_ids'', ''[]''::jsonb)))::uuid[],',
        'ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->''source_query_ids'', ''[]''::jsonb)))::uuid[],'
        || ' ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->''sub_node_intents'', ''[]''::jsonb))),'
        || ' ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->''sub_node_query_ids'', ''[]''::jsonb)))::uuid[],'
        || ' NULLIF(item->>''origin_scope_family_id'', '''')::uuid,'
    );

    IF v_new = v_src THEN
        RAISE EXCEPTION
            'Could not patch finalize_audit_run — its planned_articles INSERT no longer matches the expected shape. Update this migration rather than leaving sub-nodes unpersisted.';
    END IF;

    EXECUTE v_new;
    RAISE NOTICE 'finalize_audit_run now persists sub_node_intents, sub_node_query_ids and origin_scope_family_id';
END $$;

-- The immutability guard protects completed evidence column by column. The new
-- columns are attribution and content requirements, not evidence that can be
-- rewritten after the fact, so they are intentionally NOT added to the guarded
-- list — the backfill and any future absorption re-run must be able to set them.

DO $$
DECLARE
    missing TEXT;
BEGIN
    SELECT string_agg(c.name, ', ')
    INTO missing
    FROM (VALUES
        ('sub_node_intents'),
        ('sub_node_query_ids'),
        ('origin_scope_family_id')
    ) AS c(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'planned_articles'
          AND column_name = c.name
    );

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'Sub-node columns missing after migration: %', missing;
    END IF;
END $$;

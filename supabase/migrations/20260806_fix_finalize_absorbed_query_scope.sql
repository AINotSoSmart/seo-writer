-- ============================================================================
-- finalize_audit_run: absorbed / parent-rolled query ownership
-- ============================================================================
-- BringBack production failure after parent-scope rollup (policy v3.2+) and
-- absorption (v3.1+):
--
--   Audit finalization failed: An article references a query outside its
--   confirmed scope
--
-- Cause: planned_articles.scope_family_id is the HOST cluster family (FK to
-- audit_clusters). source_query_ids still point at query_pool rows measured
-- under the ORIGIN family (child sub-area, or thin domain before absorption).
-- finalize_audit_run required qp.scope_family_id = pa.scope_family_id exactly,
-- so every rolled-up or absorbed article failed after a full harvest spend.
--
-- origin_scope_family_id was added in 20260803 for this provenance, but the
-- ownership check was never widened. Fix the check only — do not remap
-- query_pool.scope_family_id (that would erase measured family attribution).
-- ============================================================================

DO $$
DECLARE
    v_src TEXT;
    v_new TEXT;
    v_old CONSTANT TEXT := 'AND qp.scope_family_id = pa.scope_family_id';
    v_replacement CONSTANT TEXT := $rep$AND (
              qp.scope_family_id = pa.scope_family_id
              OR (
                  pa.origin_scope_family_id IS NOT NULL
                  AND qp.scope_family_id = pa.origin_scope_family_id
              )
              OR EXISTS (
                  SELECT 1
                  FROM public.audit_scope_families child_family
                  WHERE child_family.id = qp.scope_family_id
                    AND child_family.audit_id = pa.audit_id
                    AND child_family.parent_scope_family_id = pa.scope_family_id
              )
         )$rep$;
BEGIN
    IF to_regprocedure(
        'public.finalize_audit_run(uuid,jsonb,jsonb,jsonb,jsonb,text,text,jsonb)'
    ) IS NULL THEN
        RAISE EXCEPTION 'finalize_audit_run is missing — apply 20260731 first';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'planned_articles'
          AND column_name = 'origin_scope_family_id'
    ) THEN
        RAISE EXCEPTION
            'planned_articles.origin_scope_family_id is missing — apply 20260803 first';
    END IF;

    SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc
    WHERE oid = to_regprocedure(
        'public.finalize_audit_run(uuid,jsonb,jsonb,jsonb,jsonb,text,text,jsonb)'
    );

    -- Idempotent: already patched.
    IF position('pa.origin_scope_family_id IS NOT NULL' IN v_src) > 0
       AND position('child_family.parent_scope_family_id = pa.scope_family_id' IN v_src) > 0
    THEN
        RAISE NOTICE 'finalize_audit_run already accepts absorbed/parent-rolled query ownership';
        RETURN;
    END IF;

    IF position(v_old IN v_src) = 0 THEN
        RAISE EXCEPTION
            'Could not patch finalize_audit_run query-ownership check — body no longer matches. Update this migration.';
    END IF;

    -- Exactly one occurrence in the stock function (verified).
    IF (length(v_src) - length(replace(v_src, v_old, ''))) / length(v_old) <> 1 THEN
        RAISE EXCEPTION
            'Expected exactly one qp/pa scope_family_id equality in finalize_audit_run';
    END IF;

    v_new := replace(v_src, v_old, v_replacement);
    EXECUTE v_new;
    RAISE NOTICE 'finalize_audit_run now accepts origin_scope_family_id and parent-child query ownership';
END $$;

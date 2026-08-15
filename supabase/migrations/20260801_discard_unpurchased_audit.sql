-- ============================================================================
-- Discarding an unpurchased audit
-- ============================================================================
-- The immutability guards work. That is the problem: there was no legitimate
-- way to remove a bad audit, so deleting one by hand deadlocked —
--
--   DELETE FROM query_pool      -> 'Completed audit evidence cannot be deleted'
--   DELETE FROM topical_audits  -> 'still referenced from table query_pool'
--
-- Every child FK is RESTRICT and every child DELETE is blocked by a trigger, so
-- a completed audit was permanent even when nobody had ever paid for it. A
-- founder-run audit that came back mispositioned is exactly the case that has to
-- be removable: it is not history worth protecting, it is a bad measurement.
--
-- The rule the guards actually exist to enforce is narrower than "nothing may be
-- deleted". It is: **work somebody bought must never disappear.** So this adds
-- the missing operation with that condition enforced in the database rather than
-- by whoever is holding the SQL console.
--
-- Two things are deliberately NOT done here:
--   * The guards are not weakened for ordinary traffic. They gain one escape
--     hatch, scoped to a single audit id inside a single transaction, which only
--     this function can open.
--   * The FKs are not switched to ON DELETE CASCADE. Cascade would make a
--     careless DELETE silently destroy purchased programs — the precise thing
--     RESTRICT is there to prevent.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- The escape hatch.
--
-- `set_config(..., is_local => true)` makes the setting last until the
-- transaction ends, so it cannot leak into another statement or session even if
-- the delete fails halfway. A guard yields only for the exact audit being
-- discarded; every other row stays protected for the whole operation.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_discard_in_progress(p_audit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
    SELECT COALESCE(
        current_setting('flipaeo.discarding_audit_id', true) = p_audit_id::text,
        FALSE
    );
$$;


-- Re-emit the evidence guard with the hatch. Body is otherwise identical to
-- 20260731, including the nested TG_TABLE_NAME dispatch that keeps PL/pgSQL from
-- planning another table's columns.
--
-- CREATE OR REPLACE overwrites a function's search_path along with its body.
-- Re-emitting this function here, with only `public`, silently undid the
-- 20260731 vector fix the moment this migration ran, and broke every audit in
-- production:
--
--   assert_harvest_schema_ready() -> 'cannot resolve pgvector: guard_audit_snapshot_row'
--   POST /api/topical-audit       -> 503 'temporarily unavailable'
--
-- The ALTER FUNCTION immediately below restores it. Do not remove that step,
-- and do not fold its schema name back into a literal `SET search_path` on the
-- CREATE OR REPLACE — the schema pgvector lives in is discovered dynamically
-- because it is not guaranteed to be named `extensions` on every project.
CREATE OR REPLACE FUNCTION public.guard_audit_snapshot_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
    v_audit_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_audit_id := NEW.audit_id;
    ELSE
        v_audit_id := OLD.audit_id;
    END IF;

    -- discard_unpurchased_audit() has already proven this audit was never
    -- bought and holds a lock on it.
    IF TG_OP = 'DELETE' AND public.audit_discard_in_progress(v_audit_id) THEN
        RETURN OLD;
    END IF;

    SELECT run_status INTO v_status
    FROM public.topical_audits
    WHERE id = v_audit_id;

    IF TG_OP = 'INSERT' AND v_status <> 'running' THEN
        RAISE EXCEPTION 'Evidence rows may only be inserted while an audit is running';
    END IF;
    IF TG_OP = 'DELETE' AND v_status = 'completed' THEN
        RAISE EXCEPTION 'Completed audit evidence cannot be deleted';
    END IF;

    IF TG_OP = 'UPDATE' AND v_status = 'completed' THEN
        IF TG_TABLE_NAME = 'query_pool' THEN
            IF NEW.audit_id IS DISTINCT FROM OLD.audit_id
                OR NEW.query IS DISTINCT FROM OLD.query
                OR NEW.query_norm IS DISTINCT FROM OLD.query_norm
                OR NEW.source IS DISTINCT FROM OLD.source
                OR NEW.source_url IS DISTINCT FROM OLD.source_url
                OR NEW.source_seed IS DISTINCT FROM OLD.source_seed
                OR NEW.observed_value IS DISTINCT FROM OLD.observed_value
                OR NEW.observed_at IS DISTINCT FROM OLD.observed_at
                OR NEW.embedding IS DISTINCT FROM OLD.embedding
                OR NEW.status IS DISTINCT FROM OLD.status
                OR NEW.covered_by_url IS DISTINCT FROM OLD.covered_by_url
                OR NEW.covered_by_title IS DISTINCT FROM OLD.covered_by_title
                OR NEW.coverage_similarity IS DISTINCT FROM OLD.coverage_similarity
                OR NEW.competitor_matches IS DISTINCT FROM OLD.competitor_matches
            THEN
                RAISE EXCEPTION 'Completed query evidence is immutable';
            END IF;

        ELSIF TG_TABLE_NAME = 'audit_clusters' THEN
            IF NEW.audit_id IS DISTINCT FROM OLD.audit_id
                OR NEW.name IS DISTINCT FROM OLD.name
                OR NEW.description IS DISTINCT FROM OLD.description
                OR NEW.priority IS DISTINCT FROM OLD.priority
                OR NEW.article_count IS DISTINCT FROM OLD.article_count
                OR NEW.competitor_urls IS DISTINCT FROM OLD.competitor_urls
            THEN
                RAISE EXCEPTION 'Completed cluster evidence is immutable';
            END IF;

        ELSIF TG_TABLE_NAME = 'planned_articles' THEN
            IF NEW.audit_id IS DISTINCT FROM OLD.audit_id
                OR NEW.cluster_id IS DISTINCT FROM OLD.cluster_id
                OR NEW.title IS DISTINCT FROM OLD.title
                OR NEW.main_keyword IS DISTINCT FROM OLD.main_keyword
                OR NEW.supporting_keywords IS DISTINCT FROM OLD.supporting_keywords
                OR NEW.source_query_ids IS DISTINCT FROM OLD.source_query_ids
                OR NEW.article_type IS DISTINCT FROM OLD.article_type
                OR NEW.intent_role IS DISTINCT FROM OLD.intent_role
                OR NEW.is_pillar IS DISTINCT FROM OLD.is_pillar
            THEN
                RAISE EXCEPTION 'Completed planned scope is immutable';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Restore the vector-visible search_path this function needs to compare
-- `embedding` values. Mirrors the repair block in 20260731 exactly; keep both
-- in sync if this function is ever re-emitted again.
DO $$
DECLARE
    v_vector_schema TEXT;
BEGIN
    SELECT n.nspname INTO v_vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';
    IF v_vector_schema IS NULL THEN
        RAISE EXCEPTION 'Discard migration requires pgvector';
    END IF;
    EXECUTE format(
        'ALTER FUNCTION public.guard_audit_snapshot_row() SET search_path = public, %I',
        v_vector_schema
    );
END;
$$;


-- Same hatch on the scope guard. Body otherwise identical to 20260731. This one
-- does not touch `embedding`, so it needs no vector-schema repair.
CREATE OR REPLACE FUNCTION public.guard_audit_scope_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_audit_id := OLD.audit_id;
    ELSE
        v_audit_id := NEW.audit_id;
    END IF;

    IF TG_OP = 'DELETE' AND public.audit_discard_in_progress(v_audit_id) THEN
        RETURN OLD;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.topical_audits
        WHERE id = v_audit_id AND run_status = 'completed'
    ) THEN
        -- Claiming a prospect changes ownership, not evidence. The content of a
        -- completed scope row remains immutable.
        IF TG_OP = 'UPDATE'
           AND NEW.id = OLD.id
           AND NEW.audit_id = OLD.audit_id
           AND NEW.name = OLD.name
           AND NEW.description = OLD.description
           AND NEW.seed_keywords = OLD.seed_keywords
           AND NEW.evidence = OLD.evidence
           AND NEW.source = OLD.source
           AND NEW.priority = OLD.priority
           AND NEW.created_at = OLD.created_at
        THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Completed audit scope is immutable';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- The operation itself.
--
-- Refuses unless the audit is genuinely unsold and unwritten. Deletes children
-- in FK order because every constraint is RESTRICT — deliberately, so that a
-- stray DELETE can never cascade into purchased work.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.discard_unpurchased_audit(p_audit_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_audit public.topical_audits;
    v_generated INTEGER;
    v_deleted JSONB;
    v_queries INTEGER;
    v_clusters INTEGER;
    v_articles INTEGER;
    v_families INTEGER;
    v_claims INTEGER;
BEGIN
    SELECT * INTO v_audit
    FROM public.topical_audits
    WHERE id = p_audit_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Audit % does not exist', p_audit_id;
    END IF;

    -- Money. This is the whole reason the guards exist.
    IF EXISTS (SELECT 1 FROM public.programs WHERE audit_id = p_audit_id) THEN
        RAISE EXCEPTION
            'Audit % has a program and cannot be discarded. Purchased work is permanent.',
            p_audit_id;
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.program_purchase_intents WHERE audit_id = p_audit_id
    ) THEN
        RAISE EXCEPTION
            'Audit % has a purchase intent and cannot be discarded. Cancel the checkout first.',
            p_audit_id;
    END IF;

    -- Delivered writing, even unpaid, is not something to bin silently.
    SELECT count(*) INTO v_generated
    FROM public.planned_articles
    WHERE audit_id = p_audit_id AND article_id IS NOT NULL;
    IF v_generated > 0 THEN
        RAISE EXCEPTION
            'Audit % already has % generated article(s). Delete those first if you really mean to.',
            p_audit_id, v_generated;
    END IF;

    PERFORM set_config('flipaeo.discarding_audit_id', p_audit_id::text, true);

    -- Release the brand pointer before the row goes; the FK would SET NULL
    -- anyway, but an explicit clear keeps the intent readable.
    UPDATE public.brand_details
    SET current_audit_id = NULL
    WHERE current_audit_id = p_audit_id;

    DELETE FROM public.planned_article_links
    WHERE source_article_id IN (
        SELECT id FROM public.planned_articles WHERE audit_id = p_audit_id
    ) OR target_article_id IN (
        SELECT id FROM public.planned_articles WHERE audit_id = p_audit_id
    );

    DELETE FROM public.program_cost_events
    WHERE planned_article_id IN (
        SELECT id FROM public.planned_articles WHERE audit_id = p_audit_id
    );

    DELETE FROM public.subscription_credit_consumptions
    WHERE planned_article_id IN (
        SELECT id FROM public.planned_articles WHERE audit_id = p_audit_id
    );

    DELETE FROM public.program_clusters
    WHERE audit_cluster_id IN (
        SELECT id FROM public.audit_clusters WHERE audit_id = p_audit_id
    );

    DELETE FROM public.planned_articles WHERE audit_id = p_audit_id;
    GET DIAGNOSTICS v_articles = ROW_COUNT;

    DELETE FROM public.audit_clusters WHERE audit_id = p_audit_id;
    GET DIAGNOSTICS v_clusters = ROW_COUNT;

    DELETE FROM public.query_pool WHERE audit_id = p_audit_id;
    GET DIAGNOSTICS v_queries = ROW_COUNT;

    DELETE FROM public.audit_scope_families WHERE audit_id = p_audit_id;
    GET DIAGNOSTICS v_families = ROW_COUNT;

    DELETE FROM public.audit_claims WHERE audit_id = p_audit_id;
    GET DIAGNOSTICS v_claims = ROW_COUNT;

    DELETE FROM public.topical_audits WHERE id = p_audit_id;

    v_deleted := jsonb_build_object(
        'audit_id', p_audit_id,
        'subject_url', v_audit.subject_url,
        'queries', v_queries,
        'clusters', v_clusters,
        'planned_articles', v_articles,
        'scope_families', v_families,
        'claims', v_claims
    );
    RAISE NOTICE 'Discarded audit %: %', p_audit_id, v_deleted;
    RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.discard_unpurchased_audit(UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.discard_unpurchased_audit(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.audit_discard_in_progress(UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_discard_in_progress(UUID) TO service_role;

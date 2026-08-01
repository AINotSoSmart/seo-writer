-- ============================================================================
-- Capability-bound writer contracts
-- ============================================================================
-- WHY THIS EXISTS
-- The previous writer reconstructed product meaning from broad brand JSON after
-- an audit. That allowed a digital SaaS query to drift into a physical service
-- article and allowed researched category facts to become invented product
-- claims. These fields preserve the exact mechanics, source context and intent
-- decision that existed when the immutable audit was completed.
--
-- This is intentionally one append-only migration. Historical content remains
-- readable; old audits get requires_reaudit=true instead of fabricated facts.
-- ============================================================================

ALTER TABLE public.brand_scope_families
    ADD COLUMN IF NOT EXISTS capability_contract JSONB;
ALTER TABLE public.audit_scope_families
    ADD COLUMN IF NOT EXISTS capability_contract JSONB;
ALTER TABLE public.query_pool
    ADD COLUMN IF NOT EXISTS source_context TEXT;
ALTER TABLE public.query_pool
    ADD COLUMN IF NOT EXISTS intent_binding JSONB;
ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS article_contract JSONB;
ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS contract_version TEXT;

ALTER TABLE public.brand_scope_families
    DROP CONSTRAINT IF EXISTS brand_scope_capability_contract_json_check;
ALTER TABLE public.brand_scope_families
    ADD CONSTRAINT brand_scope_capability_contract_json_check
    CHECK (capability_contract IS NULL OR jsonb_typeof(capability_contract) = 'object');

ALTER TABLE public.audit_scope_families
    DROP CONSTRAINT IF EXISTS audit_scope_capability_contract_json_check;
ALTER TABLE public.audit_scope_families
    ADD CONSTRAINT audit_scope_capability_contract_json_check
    CHECK (capability_contract IS NULL OR jsonb_typeof(capability_contract) = 'object');

ALTER TABLE public.query_pool
    DROP CONSTRAINT IF EXISTS query_pool_intent_binding_json_check;
ALTER TABLE public.query_pool
    ADD CONSTRAINT query_pool_intent_binding_json_check
    CHECK (intent_binding IS NULL OR jsonb_typeof(intent_binding) = 'object');

ALTER TABLE public.planned_articles
    DROP CONSTRAINT IF EXISTS planned_article_contract_json_check;
ALTER TABLE public.planned_articles
    ADD CONSTRAINT planned_article_contract_json_check
    CHECK (article_contract IS NULL OR jsonb_typeof(article_contract) = 'object');

ALTER TABLE public.planned_articles
    DROP CONSTRAINT IF EXISTS planned_article_contract_version_check;
ALTER TABLE public.planned_articles
    ADD CONSTRAINT planned_article_contract_version_check
    CHECK (
        (article_contract IS NULL AND contract_version IS NULL)
        OR (
            article_contract IS NOT NULL
            AND contract_version = 'article-contract-v1'
            AND article_contract->>'version' = contract_version
        )
    );

-- `observed_value` was the only saved source excerpt on historical rows. It is
-- honest compatibility data, unlike inventing a new capability decision.
UPDATE public.query_pool
SET source_context = left(observed_value, 700)
WHERE source_context IS NULL
  AND NULLIF(btrim(observed_value), '') IS NOT NULL;

    COMMENT ON COLUMN public.brand_scope_families.capability_contract IS
    'Customer-confirmed inputs/actions/outputs/limits and their first-party evidence.';
    COMMENT ON COLUMN public.audit_scope_families.capability_contract IS
    'Immutable capability-v1 snapshot copied when the audit run is created.';
    COMMENT ON COLUMN public.query_pool.source_context IS
    'Sanitized source answer/title context captured at harvest time; capped by application policy.';
    COMMENT ON COLUMN public.query_pool.intent_binding IS
    'Frozen scope family, capability operation, fit and solution-mode decision.';
    COMMENT ON COLUMN public.planned_articles.article_contract IS
    'Frozen article-contract-v1 controlling intent, product facts, research and length.';

-- ---------------------------------------------------------------------------
-- Scope confirmation: keep the mutable relational rows synchronized with the
-- confirmed JSON snapshot. Do this at the table boundary instead of rewriting
-- another function's pg_get_functiondef() output: textual rewrites are format
-- dependent and can succeed after changing validation while missing INSERT.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hydrate_brand_scope_capability_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_contract JSONB;
BEGIN
    IF NEW.capability_contract IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT family->'capability_contract'
    INTO v_contract
    FROM public.brand_details bd
    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(bd.brand_data->'scope_families', '[]'::jsonb)
    ) AS family
    WHERE bd.id = NEW.brand_id
      AND (
          COALESCE(family->>'id', '') = NEW.id::text
          OR lower(btrim(COALESCE(family->>'name', ''))) = lower(btrim(NEW.name))
      )
      AND jsonb_typeof(family->'capability_contract') = 'object'
      AND family->'capability_contract'->>'version' = 'capability-v1'
    LIMIT 1;

    NEW.capability_contract := v_contract;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hydrate_brand_scope_capability_contract ON public.brand_scope_families;
CREATE TRIGGER trg_hydrate_brand_scope_capability_contract
BEFORE INSERT ON public.brand_scope_families
FOR EACH ROW EXECUTE FUNCTION public.hydrate_brand_scope_capability_contract();

CREATE OR REPLACE FUNCTION public.sync_brand_scope_capability_contracts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.brand_data IS NOT DISTINCT FROM OLD.brand_data THEN
        RETURN NEW;
    END IF;

    UPDATE public.brand_scope_families sf
    SET capability_contract = family->'capability_contract',
        updated_at = now()
    FROM jsonb_array_elements(
        COALESCE(NEW.brand_data->'scope_families', '[]'::jsonb)
    ) AS family
    WHERE sf.brand_id = NEW.id
      AND (
          COALESCE(family->>'id', '') = sf.id::text
          OR lower(btrim(COALESCE(family->>'name', ''))) = lower(btrim(sf.name))
      )
      AND jsonb_typeof(family->'capability_contract') = 'object'
      AND family->'capability_contract'->>'version' = 'capability-v1'
      AND sf.capability_contract IS DISTINCT FROM family->'capability_contract';

    IF NEW.scope_contract_version = 'confirmed-business-scope-v2'
       AND EXISTS (
           SELECT 1
           FROM public.brand_scope_families sf
           WHERE sf.brand_id = NEW.id
             AND sf.enabled = TRUE
             AND (
                 jsonb_typeof(sf.capability_contract) IS DISTINCT FROM 'object'
                 OR sf.capability_contract->>'version' <> 'capability-v1'
             )
       )
    THEN
        RAISE EXCEPTION 'Every confirmed product area requires capability-v1 mechanics';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_brand_scope_capability_contracts ON public.brand_details;
CREATE TRIGGER trg_sync_brand_scope_capability_contracts
AFTER INSERT OR UPDATE OF brand_data ON public.brand_details
FOR EACH ROW EXECUTE FUNCTION public.sync_brand_scope_capability_contracts();

-- Repair rows produced by an earlier run of this migration where brand_data
-- was correct but confirm_brand_scope's INSERT was not actually rewritten.
UPDATE public.brand_scope_families sf
SET capability_contract = family->'capability_contract',
    updated_at = now()
FROM public.brand_details bd
CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(bd.brand_data->'scope_families', '[]'::jsonb)
) AS family
WHERE sf.brand_id = bd.id
  AND (
      COALESCE(family->>'id', '') = sf.id::text
      OR lower(btrim(COALESCE(family->>'name', ''))) = lower(btrim(sf.name))
  )
  AND jsonb_typeof(family->'capability_contract') = 'object'
  AND family->'capability_contract'->>'version' = 'capability-v1'
  AND sf.capability_contract IS DISTINCT FROM family->'capability_contract';

-- All audit creation paths already insert scope-family rows. A BEFORE trigger
-- makes the immutable copy universal (customer, prospect and claim flows)
-- without duplicating three large RPC definitions.
CREATE OR REPLACE FUNCTION public.copy_audit_capability_contract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_snapshot JSONB;
BEGIN
    IF NEW.capability_contract IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.brand_scope_family_id IS NOT NULL THEN
        SELECT capability_contract INTO NEW.capability_contract
        FROM public.brand_scope_families
        WHERE id = NEW.brand_scope_family_id;
    END IF;

    IF NEW.capability_contract IS NULL THEN
        SELECT brand_snapshot INTO v_snapshot
        FROM public.topical_audits
        WHERE id = NEW.audit_id;

        SELECT family->'capability_contract' INTO NEW.capability_contract
        FROM jsonb_array_elements(COALESCE(v_snapshot->'scope_families', '[]'::jsonb)) family
        WHERE COALESCE(family->>'id', '') = NEW.id::text
           OR lower(btrim(COALESCE(family->>'name', ''))) = lower(btrim(NEW.name))
        LIMIT 1;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_copy_audit_capability_contract ON public.audit_scope_families;
CREATE TRIGGER trg_copy_audit_capability_contract
BEFORE INSERT ON public.audit_scope_families
FOR EACH ROW EXECUTE FUNCTION public.copy_audit_capability_contract();

-- Prospect claims use the same table-bound hydration: brand_data is populated
-- from the immutable audit snapshot and every later scope INSERT resolves its
-- capability contract without depending on the current RPC function text.

-- ---------------------------------------------------------------------------
-- Atomic audit finalization: validate and save contexts, bindings and article
-- contracts in the same transaction as the immutable pool and clusters.
--
-- This is an explicit definition, not a text patch. Earlier versions tried to
-- replace fragments returned by pg_get_functiondef(); PostgreSQL normalizes
-- that text differently across prior migration paths, so a valid database
-- could fail on whitespace before any data was touched.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_audit_run(
    p_audit_id UUID,
    p_query_rows JSONB,
    p_cluster_rows JSONB,
    p_article_rows JSONB,
    p_statistics JSONB,
    p_result_hash TEXT,
    p_policy_version TEXT,
    p_source_call_ledger JSONB DEFAULT '[]'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
    v_audit public.topical_audits%ROWTYPE;
    item JSONB;
BEGIN
    SELECT * INTO v_audit
    FROM public.topical_audits
    WHERE id = p_audit_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Audit run not found'; END IF;
    IF v_audit.run_status <> 'running' THEN
        RAISE EXCEPTION 'Only running audits can be finalized';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.audit_scope_families WHERE audit_id = p_audit_id
    ) THEN
        RAISE EXCEPTION 'Audit has no confirmed scope snapshot';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.audit_scope_families sf
        WHERE sf.audit_id = p_audit_id
          AND (
              jsonb_typeof(sf.capability_contract) IS DISTINCT FROM 'object'
              OR sf.capability_contract->>'version' <> 'capability-v1'
          )
    ) THEN
        RAISE EXCEPTION 'Every audit scope family requires capability-v1 mechanics';
    END IF;
    IF jsonb_array_length(p_query_rows) = 0 THEN
        RAISE EXCEPTION 'Audit query pool cannot be empty';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_query_rows) q
        WHERE COALESCE(q->>'source_url', '') = ''
           OR COALESCE(q->>'observed_value', '') = ''
           OR COALESCE(q->>'scope_family_id', '') = ''
    ) THEN
        RAISE EXCEPTION 'Every query must contain provenance and confirmed scope';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_query_rows) q
        WHERE COALESCE(q->>'source_context', '') = ''
           OR jsonb_typeof(q->'intent_binding') IS DISTINCT FROM 'object'
    ) THEN
        RAISE EXCEPTION 'Every new query requires source context and intent binding';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_article_rows) a
        WHERE COALESCE(a->>'contract_version', '') <> 'article-contract-v1'
           OR jsonb_typeof(a->'article_contract') IS DISTINCT FROM 'object'
           OR COALESCE(a->'article_contract'->>'version', '') <> 'article-contract-v1'
    ) THEN
        RAISE EXCEPTION 'Every new planned article requires article-contract-v1';
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(p_query_rows)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.audit_scope_families sf
            WHERE sf.id = (item->>'scope_family_id')::uuid
              AND sf.audit_id = p_audit_id
        ) THEN
            RAISE EXCEPTION 'Query references scope outside its audit';
        END IF;

        INSERT INTO public.query_pool (
            id, audit_id, scope_family_id, user_id, brand_id, query, query_norm,
            source, source_url, source_seed, observed_value, observed_at,
            embedding, status, covered_by_url, covered_by_title,
            coverage_similarity, competitor_matches, source_context,
            intent_binding
        ) VALUES (
            (item->>'id')::uuid,
            p_audit_id,
            (item->>'scope_family_id')::uuid,
            v_audit.user_id,
            v_audit.brand_id,
            item->>'query',
            item->>'query_norm',
            item->>'source',
            item->>'source_url',
            NULLIF(item->>'source_seed', ''),
            item->>'observed_value',
            COALESCE((item->>'observed_at')::timestamptz, now()),
            CASE WHEN item ? 'embedding' THEN (item->'embedding')::text::vector ELSE NULL END,
            COALESCE(item->>'status', 'unknown'),
            NULLIF(item->>'covered_by_url', ''),
            NULLIF(item->>'covered_by_title', ''),
            NULLIF(item->>'coverage_similarity', '')::real,
            COALESCE(item->'competitor_matches', '[]'::jsonb),
            left(item->>'source_context', 700),
            item->'intent_binding'
        );
    END LOOP;

    FOR item IN SELECT * FROM jsonb_array_elements(p_cluster_rows)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.audit_scope_families sf
            WHERE sf.id = (item->>'scope_family_id')::uuid
              AND sf.audit_id = p_audit_id
        ) THEN
            RAISE EXCEPTION 'Cluster references scope outside its audit';
        END IF;

        INSERT INTO public.audit_clusters (
            id, audit_id, scope_family_id, user_id, brand_id, name, description,
            priority, article_count, competitor_urls
        ) VALUES (
            (item->>'id')::uuid,
            p_audit_id,
            (item->>'scope_family_id')::uuid,
            v_audit.user_id,
            v_audit.brand_id,
            item->>'name',
            NULLIF(item->>'description', ''),
            COALESCE((item->>'priority')::integer, 100),
            COALESCE((item->>'article_count')::integer, 0),
            COALESCE(item->'competitor_urls', '[]'::jsonb)
        );
    END LOOP;

    FOR item IN SELECT * FROM jsonb_array_elements(p_article_rows)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.audit_clusters c
            WHERE c.id = (item->>'cluster_id')::uuid
              AND c.audit_id = p_audit_id
              AND c.scope_family_id = (item->>'scope_family_id')::uuid
        ) THEN
            RAISE EXCEPTION 'Article references a cluster outside its confirmed scope';
        END IF;

        INSERT INTO public.planned_articles (
            id, audit_id, scope_family_id, user_id, brand_id, cluster_id, title,
            main_keyword, supporting_keywords, source_query_ids,
            sub_node_intents, sub_node_query_ids, origin_scope_family_id,
            article_contract, contract_version, article_type, intent_role,
            is_pillar, slug, target_url, generation_status, delivery_status,
            publication_status
        ) VALUES (
            (item->>'id')::uuid,
            p_audit_id,
            (item->>'scope_family_id')::uuid,
            v_audit.user_id,
            v_audit.brand_id,
            (item->>'cluster_id')::uuid,
            item->>'title',
            item->>'main_keyword',
            ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'supporting_keywords', '[]'::jsonb))),
            ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'source_query_ids', '[]'::jsonb)))::uuid[],
            ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'sub_node_intents', '[]'::jsonb))),
            ARRAY(SELECT jsonb_array_elements_text(COALESCE(item->'sub_node_query_ids', '[]'::jsonb)))::uuid[],
            NULLIF(item->>'origin_scope_family_id', '')::uuid,
            item->'article_contract',
            item->>'contract_version',
            COALESCE(item->>'article_type', 'informational'),
            NULLIF(item->>'intent_role', ''),
            COALESCE((item->>'is_pillar')::boolean, FALSE),
            NULLIF(item->>'slug', ''),
            NULLIF(item->>'target_url', ''),
            'planned',
            'withheld',
            'unpublished'
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM public.planned_articles pa
        CROSS JOIN LATERAL unnest(
            COALESCE(pa.source_query_ids, '{}'::uuid[])
            || COALESCE(pa.sub_node_query_ids, '{}'::uuid[])
        ) query_id
        LEFT JOIN public.query_pool qp
          ON qp.id = query_id
         AND qp.audit_id = p_audit_id
         AND (
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
         )
        WHERE pa.audit_id = p_audit_id
          AND qp.id IS NULL
    ) THEN
        RAISE EXCEPTION 'An article references a query outside its confirmed scope';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.audit_clusters c
        LEFT JOIN public.planned_articles pa
          ON pa.cluster_id = c.id
         AND pa.audit_id = p_audit_id
         AND pa.scope_family_id = c.scope_family_id
        WHERE c.audit_id = p_audit_id
        GROUP BY c.id, c.article_count
        HAVING COUNT(pa.id) <> c.article_count OR COUNT(pa.id) > 15
    ) THEN
        RAISE EXCEPTION 'Cluster article counts do not match the persisted scope';
    END IF;

    UPDATE public.topical_audits
    SET
        pool_size = COALESCE((p_statistics->>'pool_size')::integer, jsonb_array_length(p_query_rows)),
        article_count = COALESCE((p_statistics->>'article_count')::integer, jsonb_array_length(p_article_rows)),
        cluster_count = COALESCE((p_statistics->>'cluster_count')::integer, jsonb_array_length(p_cluster_rows)),
        authority_score = COALESCE((p_statistics->>'authority_score')::integer, 0),
        competitors_scanned = COALESCE((p_statistics->>'competitors_scanned')::integer, 0),
        user_pages_scanned = COALESCE((p_statistics->>'user_pages_scanned')::integer, 0),
        result_hash = p_result_hash,
        harvest_policy_version = p_policy_version,
        source_call_ledger = COALESCE(p_source_call_ledger, '[]'::jsonb),
        site_page_snapshot = COALESCE(p_statistics->'site_page_snapshot', '[]'::jsonb),
        generation_status = 'completed',
        generation_phase = 'completed',
        run_status = 'completed',
        completed_at = now(),
        updated_at = now(),
        requires_reaudit = FALSE
    WHERE id = p_audit_id;

    IF v_audit.brand_id IS NOT NULL THEN
        UPDATE public.brand_details
        SET current_audit_id = p_audit_id, updated_at = now()
        WHERE id = v_audit.brand_id
          AND scope_hash = v_audit.scope_hash;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand scope changed while the audit was running';
        END IF;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_audit_run(
    UUID, JSONB, JSONB, JSONB, JSONB, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_audit_run(
    UUID, JSONB, JSONB, JSONB, JSONB, TEXT, TEXT, JSONB
) TO service_role;

-- Old audits are honest history, not valid inputs for the new writer. Do not
-- fabricate mechanics or intent decisions during backfill.
UPDATE public.topical_audits ta
SET requires_reaudit = TRUE,
    updated_at = now()
WHERE ta.run_status = 'completed'
  AND (
      NOT EXISTS (
          SELECT 1 FROM public.audit_scope_families sf
          WHERE sf.audit_id = ta.id
            AND sf.capability_contract->>'version' = 'capability-v1'
      )
      OR EXISTS (
          SELECT 1 FROM public.planned_articles pa
          WHERE pa.audit_id = ta.id
            AND pa.article_contract IS NULL
      )
  );

-- Completed evidence remains immutable, including the new semantic boundary.
CREATE OR REPLACE FUNCTION public.guard_completed_writer_contracts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.topical_audits
        WHERE id = OLD.audit_id AND run_status = 'completed'
    ) AND (
        NEW.source_context IS DISTINCT FROM OLD.source_context
        OR NEW.intent_binding IS DISTINCT FROM OLD.intent_binding
    ) THEN
        RAISE EXCEPTION 'Completed audit query contracts are immutable';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_completed_query_contracts ON public.query_pool;
CREATE TRIGGER trg_guard_completed_query_contracts
BEFORE UPDATE OF source_context, intent_binding ON public.query_pool
FOR EACH ROW EXECUTE FUNCTION public.guard_completed_writer_contracts();

CREATE OR REPLACE FUNCTION public.guard_completed_article_contracts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.topical_audits
        WHERE id = OLD.audit_id AND run_status = 'completed'
    ) AND (
        NEW.article_contract IS DISTINCT FROM OLD.article_contract
        OR NEW.contract_version IS DISTINCT FROM OLD.contract_version
    ) THEN
        RAISE EXCEPTION 'Completed audit article contracts are immutable';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_completed_article_contracts ON public.planned_articles;
CREATE TRIGGER trg_guard_completed_article_contracts
BEFORE UPDATE OF article_contract, contract_version ON public.planned_articles
FOR EACH ROW EXECUTE FUNCTION public.guard_completed_article_contracts();

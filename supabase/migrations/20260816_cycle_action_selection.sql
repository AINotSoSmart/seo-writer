-- ============================================================================
-- Subscription Phase 6: ranked action selection and selected-only link graph
-- ============================================================================
-- The immutable audit plan remains evidence. Each selected cycle action gets a
-- separate cycle_output row frozen from the current measurement, so later
-- refresh cycles never rewrite the report or reuse an old delivery record.
-- ============================================================================

ALTER TABLE public.subscription_cycles
    ADD COLUMN IF NOT EXISTS selection_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS selection_policy_version TEXT,
    ADD COLUMN IF NOT EXISTS frozen_publication_url_pattern TEXT,
    ADD COLUMN IF NOT EXISTS eligible_action_groups INTEGER,
    ADD COLUMN IF NOT EXISTS backlog_action_groups INTEGER;

ALTER TABLE public.subscription_cycles
    DROP CONSTRAINT IF EXISTS subscription_cycles_selection_counts_check,
    ADD CONSTRAINT subscription_cycles_selection_counts_check
        CHECK (
            (eligible_action_groups IS NULL AND backlog_action_groups IS NULL)
            OR (
                eligible_action_groups >= 0
                AND backlog_action_groups >= 0
                AND backlog_action_groups <= eligible_action_groups
            )
        );

ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS record_kind TEXT NOT NULL DEFAULT 'audit_plan';

ALTER TABLE public.planned_articles
    DROP CONSTRAINT IF EXISTS planned_articles_record_kind_check,
    ADD CONSTRAINT planned_articles_record_kind_check
        CHECK (record_kind IN ('audit_plan', 'cycle_output'));

CREATE INDEX IF NOT EXISTS planned_articles_cycle_output_idx
    ON public.planned_articles(cycle_action_id, record_kind)
    WHERE cycle_action_id IS NOT NULL;

-- Audit-plan slugs are unique inside the frozen report. A later recurring
-- refresh intentionally reuses the live target URL, so cycle outputs cannot be
-- constrained by the historical audit's slug namespace.
DROP INDEX IF EXISTS public.planned_articles_audit_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS planned_articles_audit_slug_key
    ON public.planned_articles(audit_id, slug)
    WHERE slug IS NOT NULL AND record_kind = 'audit_plan';

ALTER TABLE public.planned_article_links
    DROP CONSTRAINT IF EXISTS planned_article_links_relationship_check,
    ADD CONSTRAINT planned_article_links_relationship_check
        CHECK (relationship IN (
            'pillar_to_leaf', 'leaf_to_pillar', 'sibling',
            'existing_page', 'selected_peer'
        ));

-- ---------------------------------------------------------------------------
-- Completed reports stay immutable, while their selected production derivative
-- may be inserted only through a cycle action tied to that report's run.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_audit_snapshot_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_status TEXT;
    v_audit_id UUID;
    v_valid_cycle_output BOOLEAN := FALSE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_audit_id := NEW.audit_id;
    ELSE
        v_audit_id := OLD.audit_id;
    END IF;

    IF TG_OP = 'DELETE' AND public.audit_discard_in_progress(v_audit_id) THEN
        RETURN OLD;
    END IF;

    SELECT run_status INTO v_status
    FROM public.topical_audits
    WHERE id = v_audit_id;

    IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'planned_articles' THEN
        IF NEW.record_kind = 'cycle_output'
           AND NEW.cycle_action_id IS NOT NULL
        THEN
            SELECT EXISTS (
                SELECT 1
                FROM public.cycle_actions action_row
                JOIN public.subscription_cycles cycle_row
                  ON cycle_row.id = action_row.cycle_id
                JOIN public.ai_probe_runs run_row
                  ON run_row.id = cycle_row.measurement_run_id
                WHERE action_row.id = NEW.cycle_action_id
                  AND action_row.user_id = NEW.user_id
                  AND action_row.brand_id = NEW.brand_id
                  AND run_row.audit_id = NEW.audit_id
                  AND run_row.user_id = NEW.user_id
                  AND run_row.brand_id = NEW.brand_id
            ) INTO v_valid_cycle_output;
        END IF;
    END IF;

    IF TG_OP = 'INSERT'
       AND v_status <> 'running'
       AND NOT v_valid_cycle_output
    THEN
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
                OR NEW.record_kind IS DISTINCT FROM OLD.record_kind
            THEN
                RAISE EXCEPTION 'Completed planned scope is immutable';
            END IF;
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

-- guard_audit_snapshot_row compares pgvector values. Restore the extension
-- schema dynamically after replacing the function, as required by the existing
-- deployment preflight.
DO $$
DECLARE
    v_vector_schema TEXT;
BEGIN
    SELECT n.nspname INTO v_vector_schema
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'vector';
    IF v_vector_schema IS NULL THEN
        RAISE EXCEPTION 'Cycle action selection requires pgvector';
    END IF;
    EXECUTE format(
        'ALTER FUNCTION public.guard_audit_snapshot_row() SET search_path = public, %I',
        v_vector_schema
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.slugify_cycle_output(p_value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT COALESCE(
        NULLIF(
            left(
                btrim(
                    regexp_replace(
                        regexp_replace(lower(COALESCE(p_value, '')), '[^a-z0-9]+', '-', 'g'),
                        '(^-+|-+$)',
                        '',
                        'g'
                    )
                ),
                72
            ),
            ''
        ),
        'article'
    )
$$;

CREATE OR REPLACE FUNCTION public.select_subscription_cycle_actions(
    p_cycle_id UUID,
    p_publication_url_pattern TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_cycle public.subscription_cycles%ROWTYPE;
    v_program public.programs%ROWTYPE;
    v_run public.ai_probe_runs%ROWTYPE;
    v_brand public.brand_details%ROWTYPE;
    v_group RECORD;
    v_action_id UUID;
    v_output_id UUID;
    v_slug TEXT;
    v_target_url TEXT;
    v_base_slug TEXT;
    v_reason TEXT;
    v_intents JSONB;
    v_primary_intent JSONB;
    v_contract JSONB;
    v_delivery_mode TEXT;
    v_research_query TEXT;
    v_supporting TEXT[];
    v_sub_node_ids UUID[];
    v_selected INTEGER := 0;
    v_eligible INTEGER := 0;
    v_backlog INTEGER := 0;
    v_state TEXT;
    v_pattern_host TEXT;
    v_brand_host TEXT;
    v_pattern_count INTEGER;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Cycle action selection is service-role only';
    END IF;

    SELECT * INTO v_cycle
    FROM public.subscription_cycles
    WHERE id = p_cycle_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Subscription cycle not found'; END IF;

    SELECT * INTO v_program
    FROM public.programs
    WHERE id = v_cycle.program_id
      AND user_id = v_cycle.user_id
      AND brand_id = v_cycle.brand_id
      AND status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'Active recurring program not found'; END IF;

    IF v_cycle.selection_completed_at IS NOT NULL THEN
        SELECT COUNT(*) INTO v_selected
        FROM public.cycle_actions
        WHERE cycle_id = v_cycle.id;
        RETURN jsonb_build_object(
            'cycle_id', v_cycle.id,
            'selected', v_selected,
            'eligible_groups', COALESCE(v_cycle.eligible_action_groups, v_selected),
            'backlog_groups', COALESCE(v_cycle.backlog_action_groups, 0),
            'replayed', TRUE,
            'state', v_cycle.state,
            'policy_version', v_cycle.selection_policy_version
        );
    END IF;

    IF EXISTS (SELECT 1 FROM public.cycle_actions WHERE cycle_id = v_cycle.id) THEN
        RAISE EXCEPTION 'Cycle has actions but no completed selection marker';
    END IF;
    IF v_cycle.state <> 'awaiting_input' THEN
        RAISE EXCEPTION 'Cycle must finish measurement and triage before selection';
    END IF;
    IF v_cycle.measurement_run_id IS NULL THEN
        RAISE EXCEPTION 'Cycle has no measurement run';
    END IF;

    SELECT * INTO v_run
    FROM public.ai_probe_runs
    WHERE id = v_cycle.measurement_run_id
      AND user_id = v_cycle.user_id
      AND brand_id = v_cycle.brand_id
      AND status = 'completed';
    IF NOT FOUND OR v_run.audit_id IS NULL THEN
        RAISE EXCEPTION 'Cycle measurement must be completed with frozen audit evidence';
    END IF;

    SELECT * INTO v_brand
    FROM public.brand_details
    WHERE id = v_cycle.brand_id
      AND user_id = v_cycle.user_id
      AND deleted_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cycle brand was not found'; END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_cycle.brand_id::TEXT, 0));

    v_pattern_count := (
        length(COALESCE(p_publication_url_pattern, ''))
        - length(replace(COALESCE(p_publication_url_pattern, ''), '{slug}', ''))
    ) / length('{slug}');
    IF v_pattern_count <> 1
       OR p_publication_url_pattern !~* '^https://[^[:space:]]+$'
       OR position('?' IN p_publication_url_pattern) > 0
       OR position('#' IN p_publication_url_pattern) > 0
       OR regexp_replace(p_publication_url_pattern, '^https://[^/]+', '', 'i') NOT LIKE '%{slug}%'
    THEN
        RAISE EXCEPTION 'Publication URL pattern must be a clean HTTPS path containing {slug} exactly once';
    END IF;

    v_pattern_host := lower(split_part(
        regexp_replace(p_publication_url_pattern, '^https?://(www\.)?', '', 'i'),
        '/',
        1
    ));
    v_brand_host := lower(split_part(
        regexp_replace(v_brand.website_url, '^https?://(www\.)?', '', 'i'),
        '/',
        1
    ));
    IF v_pattern_host <> v_brand_host THEN
        RAISE EXCEPTION 'Publication URL pattern must use the measured website host';
    END IF;

    CREATE TEMP TABLE cycle_candidate_groups ON COMMIT DROP AS
    WITH candidates AS (
        SELECT
            opportunity.id AS opportunity_id,
            opportunity.resolution_type,
            opportunity.target_url,
            opportunity.last_priority,
            opportunity.last_reason,
            opportunity.last_verdict,
            opportunity.created_at AS first_seen_at,
            prompt_row.id AS prompt_id,
            prompt_row.prompt,
            prompt_row.article_type,
            prompt_row.scope_family_id,
            blueprint.id AS blueprint_id,
            blueprint.title AS blueprint_title,
            CASE
                WHEN opportunity.resolution_type = 'refresh'
                    THEN 'refresh:' || lower(opportunity.target_url)
                ELSE 'create:' || COALESCE(blueprint.id::TEXT, opportunity.id::TEXT)
            END AS group_key
        FROM public.content_opportunities opportunity
        JOIN public.tracked_prompts tracked
          ON tracked.id = opportunity.tracked_prompt_id
         AND tracked.user_id = opportunity.user_id
         AND tracked.brand_id = opportunity.brand_id
         AND tracked.tracking_status = 'active'
        JOIN public.ai_probe_prompts prompt_row
          ON prompt_row.run_id = v_run.id
         AND prompt_row.tracked_prompt_id = opportunity.tracked_prompt_id
         AND prompt_row.verdict = opportunity.last_verdict
         AND prompt_row.answers_total > 0
        JOIN public.query_pool query_row
          ON query_row.id = prompt_row.id
         AND query_row.audit_id = v_run.audit_id
        LEFT JOIN LATERAL (
            SELECT planned.id, planned.title
            FROM public.planned_articles planned
            WHERE planned.audit_id = v_run.audit_id
              AND planned.record_kind = 'audit_plan'
              AND (
                  prompt_row.id = ANY(planned.source_query_ids)
                  OR prompt_row.id = ANY(COALESCE(planned.sub_node_query_ids, '{}'::UUID[]))
              )
            ORDER BY
                CASE WHEN prompt_row.id = ANY(planned.source_query_ids) THEN 0 ELSE 1 END,
                planned.is_pillar,
                planned.id
            LIMIT 1
        ) blueprint ON TRUE
        WHERE opportunity.user_id = v_cycle.user_id
          AND opportunity.brand_id = v_cycle.brand_id
          AND opportunity.state = 'open'
          AND opportunity.resolution_type IN ('create', 'refresh')
          AND opportunity.last_verdict IN ('absent', 'outranked')
          AND opportunity.last_seen_run_id = v_run.id
          AND (
              (
                  opportunity.resolution_type = 'create'
                  AND tracked.coverage_state = 'no_page'
                  AND opportunity.target_url IS NULL
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public.cycle_action_opportunities prior_link
                      JOIN public.cycle_actions prior_action
                        ON prior_action.id = prior_link.cycle_action_id
                      WHERE prior_link.opportunity_id = opportunity.id
                        AND prior_action.state = 'delivered'
                        AND prior_action.resolution_type = 'create'
                  )
              )
              OR (
                  opportunity.resolution_type = 'refresh'
                  AND tracked.coverage_state = 'has_page'
                  AND tracked.target_url = opportunity.target_url
                  AND opportunity.target_url IS NOT NULL
              )
          )
          AND NOT EXISTS (
              SELECT 1
              FROM public.cycle_action_opportunities pending_link
              JOIN public.cycle_actions pending_action
                ON pending_action.id = pending_link.cycle_action_id
              WHERE pending_link.opportunity_id = opportunity.id
                AND pending_action.state <> 'delivered'
          )
    ), grouped AS (
        SELECT
            group_key,
            resolution_type,
            target_url,
            array_agg(opportunity_id ORDER BY last_priority DESC NULLS LAST, opportunity_id) AS opportunity_ids,
            array_agg(prompt_id ORDER BY last_priority DESC NULLS LAST, prompt_id) AS prompt_ids,
            (array_agg(prompt ORDER BY last_priority DESC NULLS LAST, prompt_id))[1] AS primary_prompt,
            (array_agg(article_type ORDER BY last_priority DESC NULLS LAST, prompt_id))[1] AS primary_article_type,
            (array_agg(scope_family_id ORDER BY last_priority DESC NULLS LAST, prompt_id))[1] AS primary_scope_family_id,
            (array_agg(last_reason ORDER BY last_priority DESC NULLS LAST, prompt_id))[1] AS primary_reason,
            (array_agg(blueprint_title ORDER BY (blueprint_title IS NULL), last_priority DESC NULLS LAST, prompt_id))[1] AS blueprint_title,
            MAX(COALESCE(last_priority, 0)) AS highest_priority,
            MAX(CASE WHEN last_verdict = 'absent' THEN 1 ELSE 0 END) AS has_absence,
            MIN(first_seen_at) AS oldest_seen,
            COUNT(*)::INTEGER AS opportunity_count
        FROM candidates
        GROUP BY group_key, resolution_type, target_url
    )
    SELECT
        grouped.*,
        row_number() OVER (
            ORDER BY
                highest_priority DESC,
                has_absence DESC,
                opportunity_count DESC,
                oldest_seen,
                group_key
        )::INTEGER AS action_rank
    FROM grouped;

    SELECT COUNT(*) INTO v_eligible FROM pg_temp.cycle_candidate_groups;
    v_backlog := GREATEST(v_eligible - v_cycle.action_allowance, 0);

    FOR v_group IN
        SELECT *
        FROM pg_temp.cycle_candidate_groups
        WHERE action_rank <= v_cycle.action_allowance
        ORDER BY action_rank
    LOOP
        v_base_slug := public.slugify_cycle_output(
            COALESCE(v_group.blueprint_title, v_group.primary_prompt)
        );
        IF v_group.resolution_type = 'refresh' THEN
            v_target_url := v_group.target_url;
            v_slug := public.slugify_cycle_output(
                regexp_replace(v_target_url, '^.*/([^/?#]+)/?$', '\1')
            );
        ELSE
            v_slug := v_base_slug;
            v_target_url := replace(p_publication_url_pattern, '{slug}', v_slug);
            IF EXISTS (
                SELECT 1 FROM public.planned_articles
                WHERE brand_id = v_cycle.brand_id
                  AND target_url = v_target_url
            ) THEN
                v_slug := left(v_base_slug, 64) || '-' || v_group.action_rank;
                v_target_url := replace(p_publication_url_pattern, '{slug}', v_slug);
            END IF;
        END IF;

        v_reason := COALESCE(
            NULLIF(btrim(v_group.primary_reason), ''),
            'Still losing in the latest completed measurement.'
        );
        IF v_group.opportunity_count > 1 THEN
            v_reason := v_reason || format(
                ' One %s action covers %s compatible measured questions.',
                v_group.resolution_type,
                v_group.opportunity_count
            );
        END IF;

        INSERT INTO public.cycle_actions (
            user_id, cycle_id, brand_id, resolution_type, state,
            rank, selection_reason, target_url
        ) VALUES (
            v_cycle.user_id, v_cycle.id, v_cycle.brand_id,
            v_group.resolution_type, 'selected', v_group.action_rank,
            v_reason, v_target_url
        ) RETURNING id INTO v_action_id;

        INSERT INTO public.cycle_action_opportunities (
            user_id, brand_id, cycle_id, cycle_action_id, opportunity_id
        )
        SELECT
            v_cycle.user_id,
            v_cycle.brand_id,
            v_cycle.id,
            v_action_id,
            selected_opportunity.opportunity_id
        FROM unnest(v_group.opportunity_ids)
            AS selected_opportunity(opportunity_id);

        SELECT
            jsonb_agg(
                jsonb_build_object(
                    'queryId', query_row.id,
                    'query', query_row.query,
                    'sourceUrl', COALESCE(query_row.source_url, ''),
                    'sourceContext', COALESCE(query_row.source_context, query_row.query),
                    'operationKey', query_row.intent_binding->'operationKey',
                    'capabilityFit', COALESCE(query_row.intent_binding->>'capabilityFit', 'educational'),
                    'capabilityFactIds', '[]'::JSONB
                ) ORDER BY array_position(v_group.prompt_ids, query_row.id)
            ),
            string_agg(query_row.query, ' ' ORDER BY array_position(v_group.prompt_ids, query_row.id))
        INTO v_intents, v_research_query
        FROM public.query_pool query_row
        WHERE query_row.id = ANY(v_group.prompt_ids)
          AND query_row.audit_id = v_run.audit_id;

        v_primary_intent := v_intents->0;
        SELECT COALESCE(scope_row.capability_contract->>'deliveryMode', 'Product or service')
        INTO v_delivery_mode
        FROM public.audit_scope_families scope_row
        WHERE scope_row.id = v_group.primary_scope_family_id
          AND scope_row.audit_id = v_run.audit_id;

        v_contract := jsonb_build_object(
            'version', 'article-contract-v1',
            'entity', jsonb_build_object(
                'name', v_run.subject_name,
                'entityType', 'Product or service',
                'deliveryMode', COALESCE(v_delivery_mode, 'Product or service')
            ),
            'primaryIntent', v_primary_intent,
            'requiredIntents', v_intents,
            'scopeFamilyId', v_group.primary_scope_family_id,
            'solutionMode', COALESCE(
                (
                    SELECT query_row.intent_binding->>'solutionMode'
                    FROM public.query_pool query_row
                    WHERE query_row.id = v_group.prompt_ids[1]
                ),
                'category_educational'
            ),
            'capabilityFactIds', '[]'::JSONB,
            'researchQuery', left(COALESCE(v_research_query, v_group.primary_prompt), 300),
            'articleLength', CASE
                WHEN v_group.opportunity_count >= 3 THEN 'long'
                WHEN v_group.primary_article_type IN ('commercial', 'howto')
                    OR v_group.opportunity_count = 2 THEN 'medium'
                ELSE 'short'
            END
        );

        SELECT COALESCE(array_agg(query_row.query ORDER BY array_position(v_group.prompt_ids, query_row.id)), '{}'::TEXT[])
        INTO v_supporting
        FROM public.query_pool query_row
        WHERE query_row.id = ANY(v_group.prompt_ids)
          AND query_row.id <> v_group.prompt_ids[1];

        v_sub_node_ids := array_remove(v_group.prompt_ids, v_group.prompt_ids[1]);
        v_output_id := gen_random_uuid();

        INSERT INTO public.planned_articles (
            id, audit_id, scope_family_id, user_id, brand_id, cluster_id,
            title, main_keyword, supporting_keywords, source_query_ids,
            sub_node_intents, sub_node_query_ids, origin_scope_family_id,
            article_contract, contract_version, article_type, intent_role,
            is_pillar, slug, target_url, generation_status, delivery_status,
            publication_status, cycle_action_id, record_kind
        ) VALUES (
            v_output_id, v_run.audit_id, v_group.primary_scope_family_id,
            v_cycle.user_id, v_cycle.brand_id, NULL,
            COALESCE(v_group.blueprint_title, v_group.primary_prompt),
            v_group.primary_prompt,
            COALESCE(v_supporting, '{}'::TEXT[]),
            v_group.prompt_ids,
            COALESCE(v_supporting, '{}'::TEXT[]),
            v_sub_node_ids,
            NULL,
            v_contract,
            'article-contract-v1',
            v_group.primary_article_type,
            'standalone',
            FALSE,
            v_slug,
            v_target_url,
            'planned',
            'withheld',
            'unpublished',
            v_action_id,
            'cycle_output'
        );

        v_selected := v_selected + 1;
    END LOOP;

    -- Every edge originates in and resolves to this selected cycle batch.
    -- Zero edges are valid for a one-action batch.
    INSERT INTO public.planned_article_links (
        program_id, cycle_id, source_article_id, target_article_id,
        target_url, anchor_text, relationship, graph_version
    )
    SELECT
        v_cycle.program_id,
        v_cycle.id,
        peer.source_id,
        peer.target_id,
        peer.target_url,
        peer.anchor_text,
        CASE
            WHEN peer.target_resolution = 'refresh' THEN 'existing_page'
            ELSE 'selected_peer'
        END,
        'cycle-selected-graph-v1'
    FROM (
        SELECT
            source_planned.id AS source_id,
            target_planned.id AS target_id,
            target_planned.target_url,
            array_to_string(
                (regexp_split_to_array(btrim(target_planned.main_keyword), '[[:space:]]+'))[1:8],
                ' '
            ) AS anchor_text,
            target_action.resolution_type AS target_resolution,
            row_number() OVER (
                PARTITION BY source_planned.id
                ORDER BY
                    abs(target_action.rank - source_action.rank),
                    target_action.rank
            ) AS peer_rank
        FROM public.cycle_actions source_action
        JOIN public.planned_articles source_planned
          ON source_planned.cycle_action_id = source_action.id
         AND source_planned.record_kind = 'cycle_output'
        JOIN public.cycle_actions target_action
          ON target_action.cycle_id = source_action.cycle_id
         AND target_action.id <> source_action.id
        JOIN public.planned_articles target_planned
          ON target_planned.cycle_action_id = target_action.id
         AND target_planned.record_kind = 'cycle_output'
         AND target_planned.scope_family_id = source_planned.scope_family_id
        WHERE source_action.cycle_id = v_cycle.id
    ) peer
    WHERE peer.peer_rank <= 2;

    v_state := CASE WHEN v_selected = 0 THEN 'ready' ELSE 'producing' END;
    UPDATE public.subscription_cycles
    SET state = v_state,
        selection_completed_at = now(),
        selection_policy_version = 'cycle-action-selection-v1',
        frozen_publication_url_pattern = p_publication_url_pattern,
        eligible_action_groups = v_eligible,
        backlog_action_groups = v_backlog,
        failure_code = NULL,
        updated_at = now()
    WHERE id = v_cycle.id;

    RETURN jsonb_build_object(
        'cycle_id', v_cycle.id,
        'selected', v_selected,
        'eligible_groups', v_eligible,
        'backlog_groups', v_backlog,
        'replayed', FALSE,
        'state', v_state,
        'policy_version', 'cycle-action-selection-v1',
        'graph_version', 'cycle-selected-graph-v1'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.select_subscription_cycle_actions(UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.select_subscription_cycle_actions(UUID, TEXT)
    TO service_role;

DO $$
BEGIN
    COMMENT ON FUNCTION public.select_subscription_cycle_actions(UUID, TEXT) IS
        'Atomically ranks current eligible opportunities, selects at most the cycle allowance, freezes cycle outputs and links, and preserves the rest as backlog.';
END;
$$;

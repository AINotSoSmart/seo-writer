-- Customer confirmation freezes only grouped, site-aware proposals. The old
-- per-question/legacy-cluster selector remains historical and is not called.

ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS deliverable_type TEXT NOT NULL DEFAULT 'full_article'
        CHECK (deliverable_type IN (
            'full_article', 'full_page_replacement', 'section_patch'
        ));

CREATE OR REPLACE FUNCTION public.confirm_action_proposals(
    p_proposal_set_id UUID,
    p_proposal_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_set public.action_proposal_sets%ROWTYPE;
    v_cycle public.subscription_cycles%ROWTYPE;
    v_program public.programs%ROWTYPE;
    v_run public.ai_probe_runs%ROWTYPE;
    v_proposal RECORD;
    v_action_id UUID;
    v_output_id UUID;
    v_prompt_ids UUID[];
    v_opportunity_ids UUID[];
    v_supporting TEXT[];
    v_sub_node_ids UUID[];
    v_primary_prompt TEXT;
    v_article_type TEXT;
    v_scope_family_id UUID;
    v_intents JSONB;
    v_contract JSONB;
    v_slug TEXT;
    v_target_url TEXT;
    v_selected INTEGER;
    v_eligible INTEGER;
    v_backlog INTEGER;
    v_rank INTEGER := 0;
    v_state TEXT;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    IF p_proposal_ids IS NULL THEN p_proposal_ids := ARRAY[]::UUID[]; END IF;
    IF cardinality(p_proposal_ids) <> (
        SELECT count(DISTINCT selected.proposal_id)
        FROM unnest(p_proposal_ids) AS selected(proposal_id)
    ) THEN
        RAISE EXCEPTION 'Confirmed proposal ids must be unique';
    END IF;

    SELECT * INTO v_set
    FROM public.action_proposal_sets
    WHERE id = p_proposal_set_id
      AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND OR v_set.state <> 'review' THEN
        RAISE EXCEPTION 'Action proposal set is not awaiting confirmation';
    END IF;

    SELECT * INTO v_cycle
    FROM public.subscription_cycles
    WHERE id = v_set.cycle_id
      AND user_id = v_user_id
      AND brand_id = v_set.brand_id
    FOR UPDATE;
    IF NOT FOUND OR v_cycle.state <> 'awaiting_input' THEN
        RAISE EXCEPTION 'Subscription cycle is not awaiting grouped input';
    END IF;
    IF cardinality(p_proposal_ids) > v_cycle.action_allowance THEN
        RAISE EXCEPTION 'Confirmed actions exceed this cycle allowance';
    END IF;
    IF EXISTS (SELECT 1 FROM public.cycle_actions WHERE cycle_id = v_cycle.id) THEN
        RAISE EXCEPTION 'This cycle already has selected actions';
    END IF;

    SELECT * INTO v_program
    FROM public.programs
    WHERE id = v_cycle.program_id
      AND user_id = v_user_id
      AND brand_id = v_cycle.brand_id
      AND status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'Active recurring program not found'; END IF;

    SELECT * INTO v_run
    FROM public.ai_probe_runs
    WHERE id = v_set.measurement_run_id
      AND id = v_cycle.measurement_run_id
      AND user_id = v_user_id
      AND brand_id = v_cycle.brand_id
      AND status = 'completed';
    IF NOT FOUND OR v_run.audit_id IS NULL THEN
        RAISE EXCEPTION 'Proposal set has no completed measurement evidence';
    END IF;

    IF EXISTS (
        SELECT 1 FROM unnest(p_proposal_ids) selected(id)
        LEFT JOIN public.action_proposals proposal
          ON proposal.id = selected.id
         AND proposal.proposal_set_id = v_set.id
         AND proposal.user_id = v_user_id
         AND proposal.resolution_type IN ('create', 'refresh')
        WHERE proposal.id IS NULL
    ) THEN
        RAISE EXCEPTION 'A confirmed action is not an actionable proposal in this set';
    END IF;

    SELECT count(*) INTO v_eligible
    FROM public.action_proposals
    WHERE proposal_set_id = v_set.id
      AND resolution_type IN ('create', 'refresh');
    v_selected := cardinality(p_proposal_ids);
    v_backlog := GREATEST(v_eligible - v_selected, 0);

    UPDATE public.action_proposals
    SET status = CASE WHEN id = ANY(p_proposal_ids) THEN 'confirmed' ELSE 'suggested' END,
        updated_at = now()
    WHERE proposal_set_id = v_set.id;

    FOR v_proposal IN
        SELECT proposal.*
        FROM public.action_proposals proposal
        WHERE proposal.id = ANY(p_proposal_ids)
        ORDER BY proposal.priority DESC, proposal.created_at, proposal.id
    LOOP
        v_rank := v_rank + 1;
        SELECT
            array_agg(run_prompt.id ORDER BY prompt_row.position),
            array_agg(link_row.opportunity_id ORDER BY prompt_row.position),
            (array_agg(prompt_row.prompt ORDER BY prompt_row.position))[1],
            (array_agg(prompt_row.article_type ORDER BY prompt_row.position))[1],
            (array_agg(run_prompt.scope_family_id ORDER BY prompt_row.position))[1]
        INTO v_prompt_ids, v_opportunity_ids, v_primary_prompt,
             v_article_type, v_scope_family_id
        FROM public.action_proposal_prompts link_row
        JOIN public.tracked_prompts prompt_row
          ON prompt_row.id = link_row.tracked_prompt_id
         AND prompt_row.user_id = v_user_id
         AND prompt_row.brand_id = v_cycle.brand_id
         AND prompt_row.tracking_status = 'active'
        JOIN public.ai_probe_prompts run_prompt
          ON run_prompt.run_id = v_run.id
         AND run_prompt.tracked_prompt_id = prompt_row.id
         AND run_prompt.answers_total > 0
         AND run_prompt.verdict IN ('absent', 'outranked')
        WHERE link_row.proposal_id = v_proposal.id;

        IF COALESCE(cardinality(v_prompt_ids), 0) = 0 THEN
            RAISE EXCEPTION 'Confirmed proposal has no measured buyer questions';
        END IF;
        IF EXISTS (
            SELECT 1
            FROM unnest(v_opportunity_ids) selected(opportunity_id)
            JOIN public.cycle_action_opportunities prior_link
              ON prior_link.opportunity_id = selected.opportunity_id
            JOIN public.cycle_actions prior_action
              ON prior_action.id = prior_link.cycle_action_id
             AND prior_action.state <> 'delivered'
        ) THEN
            RAISE EXCEPTION 'A confirmed proposal contains work already selected elsewhere';
        END IF;
        IF v_proposal.resolution_type = 'create' AND EXISTS (
            SELECT 1
            FROM unnest(v_opportunity_ids) AS selected(opportunity_id)
            JOIN public.cycle_action_opportunities prior_link
              ON prior_link.opportunity_id = selected.opportunity_id
            JOIN public.cycle_actions prior_action
              ON prior_action.id = prior_link.cycle_action_id
             AND prior_action.resolution_type = 'create'
             AND prior_action.state = 'delivered'
        ) THEN
            RAISE EXCEPTION 'A delivered create requires publication confirmation, not another draft';
        END IF;

        v_slug := public.slugify_cycle_output(v_proposal.title);
        IF v_proposal.resolution_type = 'refresh' THEN
            v_target_url := v_proposal.target_url;
            UPDATE public.tracked_prompts tracked
            SET coverage_state = 'has_page',
                target_url = v_target_url,
                updated_at = now()
            WHERE tracked.id IN (
                SELECT link_row.tracked_prompt_id
                FROM public.action_proposal_prompts link_row
                WHERE link_row.proposal_id = v_proposal.id
            );
        ELSE
            IF v_program.publication_url_pattern IS NULL THEN
                RAISE EXCEPTION 'Create actions require a confirmed publication URL pattern';
            END IF;
            v_target_url := replace(v_program.publication_url_pattern, '{slug}', v_slug);
            IF EXISTS (
                SELECT 1 FROM public.site_inventory_pages inventory
                WHERE inventory.brand_id = v_cycle.brand_id
                  AND inventory.canonical_url = v_target_url
            ) OR EXISTS (
                SELECT 1 FROM public.planned_articles planned
                WHERE planned.brand_id = v_cycle.brand_id
                  AND planned.target_url = v_target_url
            ) THEN
                -- A proposal id is stable and globally unique; a rank is not.
                -- This suffix therefore remains collision-safe across cycles.
                v_slug := left(v_slug, 31) || '-' || replace(v_proposal.id::TEXT, '-', '');
                v_target_url := replace(v_program.publication_url_pattern, '{slug}', v_slug);
            END IF;
            UPDATE public.tracked_prompts tracked
            SET coverage_state = 'no_page', target_url = NULL, updated_at = now()
            WHERE tracked.id IN (
                SELECT link_row.tracked_prompt_id
                FROM public.action_proposal_prompts link_row
                WHERE link_row.proposal_id = v_proposal.id
            );
        END IF;

        UPDATE public.content_opportunities opportunity
        SET state = 'open',
            resolution_type = v_proposal.resolution_type,
            target_url = CASE
                WHEN v_proposal.resolution_type = 'refresh' THEN v_target_url
                ELSE NULL
            END,
            updated_at = now()
        WHERE opportunity.id = ANY(v_opportunity_ids);

        INSERT INTO public.cycle_actions (
            user_id, cycle_id, brand_id, proposal_id, resolution_type,
            state, rank, selection_reason, target_url
        ) VALUES (
            v_user_id, v_cycle.id, v_cycle.brand_id, v_proposal.id,
            v_proposal.resolution_type, 'selected', v_rank,
            v_proposal.reason, v_target_url
        ) RETURNING id INTO v_action_id;

        INSERT INTO public.cycle_action_opportunities (
            user_id, brand_id, cycle_id, cycle_action_id, opportunity_id
        )
        SELECT v_user_id, v_cycle.brand_id, v_cycle.id, v_action_id, selected.opportunity_id
        FROM unnest(v_opportunity_ids) AS selected(opportunity_id);

        SELECT jsonb_agg(
                   jsonb_build_object(
                       'queryId', query_row.id,
                       'query', query_row.query,
                       'sourceUrl', COALESCE(query_row.source_url, ''),
                       'sourceContext', COALESCE(query_row.source_context, query_row.query),
                       'operationKey', v_proposal.intent_binding->>'operationKey',
                       'capabilityFit', COALESCE(v_proposal.intent_binding->>'capabilityFit', 'educational'),
                       'capabilityFactIds', COALESCE(v_proposal.evidence->'capabilityFactIds', '[]'::JSONB)
                   ) ORDER BY array_position(v_prompt_ids, query_row.id)
               ),
               COALESCE(
                   array_agg(query_row.query ORDER BY array_position(v_prompt_ids, query_row.id))
                       FILTER (WHERE query_row.id <> v_prompt_ids[1]),
                   ARRAY[]::TEXT[]
               )
        INTO v_intents, v_supporting
        FROM public.query_pool query_row
        WHERE query_row.audit_id = v_run.audit_id
          AND query_row.id = ANY(v_prompt_ids);
        IF jsonb_array_length(COALESCE(v_intents, '[]'::JSONB)) <> cardinality(v_prompt_ids) THEN
            RAISE EXCEPTION 'Confirmed proposal is missing frozen query evidence';
        END IF;

        v_sub_node_ids := array_remove(v_prompt_ids, v_prompt_ids[1]);
        v_contract := jsonb_build_object(
            'version', 'article-contract-v1',
            'entity', jsonb_build_object(
                'name', v_run.subject_name,
                'entityType', 'Product or service',
                'deliveryMode', COALESCE(
                    (
                        SELECT scope_row.capability_contract->>'deliveryMode'
                        FROM public.audit_scope_families scope_row
                        WHERE scope_row.id = v_scope_family_id
                    ),
                    'Product or service'
                )
            ),
            'primaryIntent', v_intents->0,
            'requiredIntents', v_intents,
            'scopeFamilyId', v_scope_family_id,
            'solutionMode', COALESCE(
                v_proposal.intent_binding->>'solutionMode',
                'category_educational'
            ),
            'capabilityFactIds', COALESCE(
                v_proposal.evidence->'capabilityFactIds',
                '[]'::JSONB
            ),
            'researchQuery', left(array_to_string(ARRAY[v_primary_prompt] || v_supporting, ' '), 300),
            'articleLength', CASE
                WHEN cardinality(v_prompt_ids) >= 3 THEN 'long'
                WHEN v_article_type IN ('commercial', 'howto')
                     OR cardinality(v_prompt_ids) = 2 THEN 'medium'
                ELSE 'short'
            END
        );

        v_output_id := gen_random_uuid();
        INSERT INTO public.planned_articles (
            id, audit_id, scope_family_id, user_id, brand_id, cluster_id,
            title, main_keyword, supporting_keywords, source_query_ids,
            sub_node_intents, sub_node_query_ids, article_contract,
            contract_version, article_type, intent_role, is_pillar, slug,
            target_url, generation_status, delivery_status,
            publication_status, cycle_action_id, record_kind, deliverable_type
        ) VALUES (
            v_output_id, v_run.audit_id, v_scope_family_id, v_user_id,
            v_cycle.brand_id, NULL, v_proposal.title, v_primary_prompt,
            COALESCE(v_supporting, ARRAY[]::TEXT[]), v_prompt_ids,
            COALESCE(v_supporting, ARRAY[]::TEXT[]), v_sub_node_ids,
            v_contract, 'article-contract-v1', v_article_type, 'standalone',
            FALSE, v_slug, v_target_url, 'planned', 'withheld',
            'unpublished', v_action_id, 'cycle_output',
            v_proposal.deliverable_type
        );
    END LOOP;

    INSERT INTO public.planned_article_links (
        program_id, cycle_id, source_article_id, target_article_id,
        target_url, anchor_text, relationship, graph_version
    )
    SELECT v_cycle.program_id, v_cycle.id, peer.source_id, peer.target_id,
           peer.target_url, peer.anchor_text,
           CASE WHEN peer.target_resolution = 'refresh'
                THEN 'existing_page' ELSE 'selected_peer' END,
           'proposal-selected-graph-v1'
    FROM (
        SELECT source_planned.id AS source_id,
               target_planned.id AS target_id,
               target_planned.target_url,
               left(target_planned.main_keyword, 100) AS anchor_text,
               target_action.resolution_type AS target_resolution,
               row_number() OVER (
                   PARTITION BY source_planned.id
                   ORDER BY abs(target_action.rank - source_action.rank), target_action.rank
               ) AS peer_rank
        FROM public.cycle_actions source_action
        JOIN public.planned_articles source_planned
          ON source_planned.cycle_action_id = source_action.id
        JOIN public.cycle_actions target_action
          ON target_action.cycle_id = source_action.cycle_id
         AND target_action.id <> source_action.id
        JOIN public.planned_articles target_planned
          ON target_planned.cycle_action_id = target_action.id
         AND target_planned.scope_family_id = source_planned.scope_family_id
        WHERE source_action.cycle_id = v_cycle.id
    ) peer
    WHERE peer.peer_rank <= 2;

    v_state := CASE WHEN v_selected = 0 THEN 'ready' ELSE 'producing' END;
    UPDATE public.action_proposal_sets
    SET state = 'confirmed', confirmed_at = now(), updated_at = now()
    WHERE id = v_set.id;
    UPDATE public.subscription_cycles
    SET state = v_state,
        selection_completed_at = now(),
        selection_policy_version = 'site-aware-actions-v1',
        frozen_publication_url_pattern = v_program.publication_url_pattern,
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
        'state', v_state,
        'policy_version', 'site-aware-actions-v1'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_action_proposals(UUID, UUID[])
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_action_proposals(UUID, UUID[])
    TO authenticated, service_role;

-- Existing writer/refresh callers keep using this completion hook, but during
-- founding beta it stops at ready. Only the founder approval endpoint calls
-- deliver_subscription_cycle and makes the complete batch customer-visible.
CREATE OR REPLACE FUNCTION public.release_subscription_cycle_if_ready(p_cycle_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Cycle readiness is service-role only';
    END IF;
    PERFORM 1 FROM public.subscription_cycles WHERE id = p_cycle_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Subscription cycle not found'; END IF;
    IF EXISTS (
        SELECT 1 FROM public.cycle_actions
        WHERE cycle_id = p_cycle_id AND state <> 'ready'
    ) THEN
        RETURN FALSE;
    END IF;
    UPDATE public.subscription_cycles
    SET state = 'ready', failure_code = NULL, updated_at = now()
    WHERE id = p_cycle_id AND state = 'producing';
    RETURN EXISTS (
        SELECT 1 FROM public.subscription_cycles
        WHERE id = p_cycle_id AND state IN ('ready', 'delivered')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.release_subscription_cycle_if_ready(UUID)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_subscription_cycle_if_ready(UUID)
    TO service_role;

-- The grouped confirmation boundary is now the only selector. These two
-- functions had no remaining runtime callers; dropping them prevents an old
-- tab or future import from reviving automatic/per-question production.
DROP FUNCTION IF EXISTS public.select_subscription_cycle_actions(UUID, TEXT);
DROP FUNCTION IF EXISTS public.triage_content_opportunity_target(UUID, TEXT, TEXT);

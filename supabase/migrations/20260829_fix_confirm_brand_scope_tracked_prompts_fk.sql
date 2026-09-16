-- ============================================================================
-- Fix: brand_scope_families foreign key violation on tracked_prompts
-- ============================================================================
-- When confirm_brand_scope was called on a brand that already had tracked_prompts
-- (such as re-running onboarding or updating scope), it executed
-- `DELETE FROM brand_scope_families WHERE brand_id = p_brand_id;`
-- and generated brand-new random UUIDs for all families.
-- Because tracked_prompts.scope_family_id had an ON DELETE NO ACTION foreign key,
-- this raised:
-- "update or delete on table 'brand_scope_families' violates foreign key
--  constraint 'tracked_prompts_scope_family_fkey' on table 'tracked_prompts'".
--
-- Fix:
-- 1. Update tracked_prompts_scope_family_fkey to ON DELETE CASCADE
--    DEFERRABLE INITIALLY DEFERRED.
-- 2. Update confirm_brand_scope to:
--    - Match and preserve existing brand_scope_families IDs by id or name.
--    - Re-link any existing tracked_prompts pointing to removed families to
--      the primary surviving family, preventing accidental prompt loss.
--    - Delete only families that are no longer in the confirmed set.
--    - Upsert the confirmed families using ON CONFLICT (id) DO UPDATE.
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tracked_prompts_scope_family_fkey'
    ) THEN
        ALTER TABLE public.tracked_prompts
            DROP CONSTRAINT tracked_prompts_scope_family_fkey;
    END IF;

    ALTER TABLE public.tracked_prompts
        ADD CONSTRAINT tracked_prompts_scope_family_fkey
        FOREIGN KEY (scope_family_id)
        REFERENCES public.brand_scope_families(id)
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_brand_scope(
    p_brand_id UUID,
    p_families JSONB,
    p_contract_version TEXT,
    p_scope_hash TEXT,
    p_brand_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_count INTEGER;
    v_total_seeds INTEGER;
    v_target_family_ids UUID[] := ARRAY[]::UUID[];
    v_resolved_id UUID;
    v_primary_family_id UUID;
    v_deleted_family_ids UUID[];
    item JSONB;
    i INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    PERFORM 1
    FROM public.brand_details
    WHERE id = p_brand_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Brand not found';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.topical_audits
        WHERE brand_id = p_brand_id
          AND user_id = v_user_id
          AND run_status = 'running'
    ) THEN
        RAISE EXCEPTION 'Business scope cannot change while an audit is running';
    END IF;

    v_count := jsonb_array_length(COALESCE(p_families, '[]'::jsonb));
    IF v_count < 1 OR v_count > 12 THEN
        RAISE EXCEPTION 'Confirmed scope must contain 1-12 product areas';
    END IF;
    IF COALESCE(p_contract_version, '') = ''
       OR COALESCE(p_scope_hash, '') = ''
       OR p_brand_data IS NULL
       OR jsonb_typeof(p_brand_data) <> 'object'
    THEN
        RAISE EXCEPTION 'Scope version and hash are required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_families) family
        WHERE length(btrim(COALESCE(family->>'name', ''))) NOT BETWEEN 2 AND 100
           OR length(btrim(COALESCE(family->>'description', ''))) NOT BETWEEN 8 AND 500
           OR jsonb_array_length(COALESCE(family->'seed_keywords', '[]'::jsonb)) NOT BETWEEN 1 AND 8
    ) THEN
        RAISE EXCEPTION 'A confirmed product area is incomplete';
    END IF;
    SELECT COALESCE(
        SUM(jsonb_array_length(COALESCE(family->'seed_keywords', '[]'::jsonb))),
        0
    )
    INTO v_total_seeds
    FROM jsonb_array_elements(p_families) family;
    IF v_total_seeds > 12 THEN
        RAISE EXCEPTION 'Confirmed scope may contain at most 12 search directions';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_families) family
        CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(family->'seed_keywords', '[]'::jsonb)
        ) AS seed(value)
        GROUP BY lower(btrim(seed.value))
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Every search direction must belong to exactly one product area';
    END IF;

    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_families) family
        WHERE jsonb_typeof(family->'capability_contract') IS DISTINCT FROM 'object'
           OR family->'capability_contract'->>'version' <> 'capability-v1'
    ) THEN
        RAISE EXCEPTION 'Every confirmed product area requires capability-v1 mechanics';
    END IF;

    -- Pass 1: Resolve unique IDs for all incoming families
    -- Retain existing ID if passed explicitly or if an existing family matches by name
    FOR i IN 1..jsonb_array_length(p_families)
    LOOP
        item := p_families->(i - 1);
        v_resolved_id := NULL;

        -- 1. Try explicit ID if valid UUID belonging to this brand
        IF NULLIF(item->>'id', '') IS NOT NULL THEN
            SELECT id INTO v_resolved_id
            FROM public.brand_scope_families
            WHERE brand_id = p_brand_id
              AND id = (item->>'id')::uuid
              AND id != ALL(v_target_family_ids);
        END IF;

        -- 2. Match existing family for this brand by trimmed case-insensitive name
        IF v_resolved_id IS NULL THEN
            SELECT id INTO v_resolved_id
            FROM public.brand_scope_families
            WHERE brand_id = p_brand_id
              AND lower(btrim(name)) = lower(btrim(item->>'name'))
              AND id != ALL(v_target_family_ids)
            LIMIT 1;
        END IF;

        -- 3. If no existing match, generate a new UUID
        IF v_resolved_id IS NULL THEN
            v_resolved_id := COALESCE(NULLIF(item->>'id', '')::uuid, gen_random_uuid());
        END IF;

        v_target_family_ids := array_append(v_target_family_ids, v_resolved_id);
    END LOOP;

    v_primary_family_id := v_target_family_ids[1];

    -- Identify existing families that are NOT in the incoming target set
    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO v_deleted_family_ids
    FROM public.brand_scope_families
    WHERE brand_id = p_brand_id
      AND id != ALL(v_target_family_ids);

    -- If any families are being removed, re-link any existing tracked_prompts
    -- pointing to them to the primary family to prevent accidental prompt loss
    IF array_length(v_deleted_family_ids, 1) > 0 THEN
        UPDATE public.tracked_prompts
        SET scope_family_id = v_primary_family_id,
            updated_at = now()
        WHERE brand_id = p_brand_id
          AND scope_family_id = ANY(v_deleted_family_ids);

        -- Clear any self-references in parent_scope_family_id
        UPDATE public.brand_scope_families
        SET parent_scope_family_id = NULL
        WHERE brand_id = p_brand_id
          AND parent_scope_family_id = ANY(v_deleted_family_ids);

        DELETE FROM public.brand_scope_families
        WHERE brand_id = p_brand_id
          AND id = ANY(v_deleted_family_ids);
    END IF;

    -- Pass 2: Upsert incoming families with their resolved IDs
    FOR i IN 1..jsonb_array_length(p_families)
    LOOP
        item := p_families->(i - 1);
        v_resolved_id := v_target_family_ids[i];

        INSERT INTO public.brand_scope_families (
            id, brand_id, user_id, name, description, seed_keywords, evidence,
            capability_contract, source, priority, enabled
        ) VALUES (
            v_resolved_id,
            p_brand_id,
            v_user_id,
            btrim(item->>'name'),
            btrim(item->>'description'),
            ARRAY(
                SELECT value
                FROM jsonb_array_elements_text(item->'seed_keywords') value
            ),
            COALESCE(item->'evidence', '[]'::jsonb),
            item->'capability_contract',
            COALESCE(item->>'source', 'user'),
            COALESCE((item->>'priority')::integer, 0),
            TRUE
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            seed_keywords = EXCLUDED.seed_keywords,
            evidence = EXCLUDED.evidence,
            capability_contract = COALESCE(EXCLUDED.capability_contract, brand_scope_families.capability_contract),
            source = EXCLUDED.source,
            priority = EXCLUDED.priority,
            enabled = EXCLUDED.enabled,
            updated_at = now();
    END LOOP;

    -- Pass 3: Wire parent_scope_family_id links
    UPDATE public.brand_scope_families child
    SET parent_scope_family_id = NULLIF(family_row->>'parent_scope_family_id', '')::uuid
    FROM jsonb_array_elements(p_families) AS family_row
    WHERE child.brand_id = p_brand_id
      AND child.id = COALESCE(NULLIF(family_row->>'id', '')::uuid, child.id)
      AND NULLIF(family_row->>'parent_scope_family_id', '') IS NOT NULL
      AND NULLIF(family_row->>'parent_scope_family_id', '')::uuid <> child.id
      AND EXISTS (
          SELECT 1 FROM public.brand_scope_families parent
          WHERE parent.id = NULLIF(family_row->>'parent_scope_family_id', '')::uuid
            AND parent.brand_id = p_brand_id
      );

    UPDATE public.brand_details
    SET brand_data = p_brand_data,
        scope_confirmed_at = now(),
        scope_contract_version = p_contract_version,
        scope_hash = p_scope_hash,
        updated_at = now()
    WHERE id = p_brand_id AND user_id = v_user_id;

    UPDATE public.topical_audits ta
    SET requires_reaudit = TRUE,
        updated_at = now()
    WHERE ta.brand_id = p_brand_id
      AND ta.user_id = v_user_id
      AND ta.run_status = 'completed'
      AND ta.scope_hash IS DISTINCT FROM p_scope_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_brand_scope(UUID, JSONB, TEXT, TEXT, JSONB)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_brand_scope(UUID, JSONB, TEXT, TEXT, JSONB)
    TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.confirm_tracked_prompts_v1(
    p_brand_id UUID,
    p_prompts JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_item JSONB;
    v_text TEXT;
    v_norm TEXT;
    v_scope_family_id UUID;
    v_source_seed TEXT;
    v_position INTEGER := 0;
    v_previously_active UUID[] := ARRAY[]::UUID[];
    v_active_count INTEGER;
    v_expected_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_prompts IS NULL OR jsonb_typeof(p_prompts) <> 'array' THEN
        RAISE EXCEPTION 'Buyer questions must be an array';
    END IF;
    v_expected_count := jsonb_array_length(p_prompts);
    IF v_expected_count NOT BETWEEN 1 AND 25 THEN
        RAISE EXCEPTION 'Confirm between 1 and 25 buyer questions';
    END IF;

    PERFORM 1
    FROM public.brand_details
    WHERE id = p_brand_id
      AND user_id = v_user_id
      AND deleted_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Brand not found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_prompts) prompt_row
        GROUP BY public.normalize_tracked_prompt(prompt_row->>'prompt')
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Tracked buyer questions must be unique';
    END IF;

    SELECT COALESCE(array_agg(id), ARRAY[]::UUID[])
    INTO v_previously_active
    FROM public.tracked_prompts
    WHERE brand_id = p_brand_id
      AND user_id = v_user_id
      AND tracking_status = 'active';

    UPDATE public.tracked_prompts
    SET tracking_status = 'inactive', updated_at = now()
    WHERE id = ANY(v_previously_active);

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_prompts)
    LOOP
        v_text := btrim(COALESCE(v_item->>'prompt', ''));
        v_norm := public.normalize_tracked_prompt(v_text);
        v_source_seed := btrim(COALESCE(v_item->>'source_seed', ''));

        IF length(v_text) NOT BETWEEN 15 AND 200 OR v_norm = '' THEN
            RAISE EXCEPTION 'Every tracked buyer question must contain 15-200 characters';
        END IF;
        IF length(v_source_seed) NOT BETWEEN 1 AND 200 THEN
            RAISE EXCEPTION 'Every tracked buyer question must retain its confirmed scope provenance';
        END IF;
        IF COALESCE(v_item->>'intent', '') NOT IN (
            'recommendation', 'alternatives', 'comparison', 'problem', 'howto'
        ) THEN
            RAISE EXCEPTION 'Tracked question has an invalid intent';
        END IF;
        IF COALESCE(v_item->>'article_type', '') NOT IN (
            'commercial', 'informational', 'howto'
        ) THEN
            RAISE EXCEPTION 'Tracked question has an invalid article type';
        END IF;

        SELECT family.id
        INTO v_scope_family_id
        FROM public.brand_scope_families family
        WHERE family.brand_id = p_brand_id
          AND family.user_id = v_user_id
          AND family.enabled = TRUE
          AND (
              family.id::text = COALESCE(v_item->>'scope_family_id', '')
              OR lower(family.name) = lower(v_source_seed)
              OR EXISTS (
                  SELECT 1 FROM unnest(family.seed_keywords) seed
                  WHERE lower(seed) = lower(v_source_seed)
              )
          )
        ORDER BY
            CASE WHEN family.id::text = COALESCE(v_item->>'scope_family_id', '') THEN 0
                 WHEN lower(family.name) = lower(v_source_seed) THEN 1
                 ELSE 2 END,
            family.priority
        LIMIT 1;

        -- Fallback: if not matched by specific ID or seed, use the first enabled family for this brand
        IF v_scope_family_id IS NULL THEN
            SELECT family.id
            INTO v_scope_family_id
            FROM public.brand_scope_families family
            WHERE family.brand_id = p_brand_id
              AND family.user_id = v_user_id
              AND family.enabled = TRUE
            ORDER BY family.priority
            LIMIT 1;
        END IF;

        IF v_scope_family_id IS NULL THEN
            RAISE EXCEPTION 'A tracked buyer question could not be matched to confirmed scope';
        END IF;

        INSERT INTO public.tracked_prompts (
            user_id, brand_id, scope_family_id, prompt, prompt_norm,
            intent, article_type, source_seed, position, tracking_status,
            coverage_state, target_url, retired_at
        ) VALUES (
            v_user_id, p_brand_id, v_scope_family_id, v_text, v_norm,
            v_item->>'intent', v_item->>'article_type', v_source_seed,
            v_position, 'active', 'unknown', NULL, NULL
        )
        ON CONFLICT (brand_id, prompt_norm) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            scope_family_id = EXCLUDED.scope_family_id,
            prompt = EXCLUDED.prompt,
            intent = EXCLUDED.intent,
            article_type = EXCLUDED.article_type,
            source_seed = EXCLUDED.source_seed,
            position = EXCLUDED.position,
            tracking_status = 'active',
            retired_at = NULL,
            updated_at = now();

        v_position := v_position + 1;
        v_scope_family_id := NULL;
    END LOOP;

    UPDATE public.tracked_prompts
    SET tracking_status = 'retired', retired_at = now(), updated_at = now()
    WHERE id = ANY(v_previously_active)
      AND tracking_status = 'inactive';

    SELECT COUNT(*) INTO v_active_count
    FROM public.tracked_prompts
    WHERE brand_id = p_brand_id
      AND user_id = v_user_id
      AND tracking_status = 'active';

    IF v_active_count <> v_expected_count THEN
        RAISE EXCEPTION 'Tracked question confirmation did not preserve the reviewed set';
    END IF;

    RETURN v_active_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_tracked_prompts(
    p_brand_id UUID,
    p_prompts JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_count INTEGER;
    v_item JSONB;
    v_binding JSONB;
    v_tracked public.tracked_prompts%ROWTYPE;
    v_operation_key TEXT;
    v_selection_class TEXT;
BEGIN
    v_count := public.confirm_tracked_prompts_v1(p_brand_id, p_prompts);

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_prompts)
    LOOP
        SELECT * INTO v_tracked
        FROM public.tracked_prompts
        WHERE brand_id = p_brand_id
          AND user_id = auth.uid()
          AND prompt_norm = public.normalize_tracked_prompt(v_item->>'prompt')
          AND tracking_status = 'active';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Confirmed tracked question was not found for binding';
        END IF;

        v_binding := v_item->'intent_binding';
        IF jsonb_typeof(v_binding) IS DISTINCT FROM 'object' THEN
            v_binding := jsonb_build_object(
                'scopeFamilyId', v_tracked.scope_family_id::TEXT,
                'operationKey', NULL,
                'capabilityFit', 'educational',
                'solutionMode', 'category_educational',
                'reason', 'default binding'
            );
        ELSE
            -- Ensure binding's scopeFamilyId matches the tracked prompt's scope_family_id
            v_binding := jsonb_set(
                v_binding,
                '{scopeFamilyId}',
                to_jsonb(v_tracked.scope_family_id::TEXT)
            );
        END IF;

        IF COALESCE(v_binding->>'capabilityFit', '') NOT IN (
            'explicit', 'mechanically_entailed', 'educational'
        ) THEN
            v_binding := jsonb_set(v_binding, '{capabilityFit}', '"educational"'::jsonb);
        END IF;
        IF COALESCE(v_binding->>'solutionMode', '') NOT IN (
            'product_led', 'category_educational'
        ) THEN
            v_binding := jsonb_set(v_binding, '{solutionMode}', '"category_educational"'::jsonb);
        END IF;

        v_operation_key := NULLIF(v_binding->>'operationKey', '');
        IF v_operation_key IS NOT NULL AND NOT EXISTS (
            SELECT 1
            FROM public.brand_scope_families family,
                 jsonb_array_elements(
                     COALESCE(family.capability_contract->'operations', '[]'::JSONB)
                 ) operation
            WHERE family.id = v_tracked.scope_family_id
              AND family.user_id = auth.uid()
              AND operation->>'key' = v_operation_key
        ) THEN
            v_binding := jsonb_set(v_binding, '{operationKey}', 'null'::jsonb);
        END IF;

        v_selection_class := COALESCE(v_item->>'selection_class', 'knowledge');
        IF v_selection_class NOT IN (
            'knowledge', 'instruction', 'exploration',
            'solution', 'discovery', 'recommendation', 'constrained'
        ) THEN
            v_selection_class := 'knowledge';
        END IF;

        UPDATE public.tracked_prompts
        SET intent_binding = v_binding,
            selection_class = v_selection_class,
            updated_at = now()
        WHERE id = v_tracked.id;
    END LOOP;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_tracked_prompts_v1(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_tracked_prompts_v1(UUID, JSONB) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.confirm_tracked_prompts(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_tracked_prompts(UUID, JSONB) TO authenticated, service_role;


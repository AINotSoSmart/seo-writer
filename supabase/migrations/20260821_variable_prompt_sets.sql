-- ============================================================================
-- Buyer-question quality: distinct variable-size sets, never quota filler
-- ============================================================================
-- The company-wide generator stops when another question would only paraphrase
-- an existing buyer situation. Confirmation and measurement must therefore
-- accept the exact reviewed set instead of forcing forty rows back into it.

CREATE OR REPLACE FUNCTION public.guard_tracked_prompt_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_active_count INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.brand_details brand
        JOIN public.brand_scope_families family
          ON family.brand_id = brand.id
         AND family.user_id = brand.user_id
        WHERE brand.id = NEW.brand_id
          AND brand.user_id = NEW.user_id
          AND brand.deleted_at IS NULL
          AND family.id = NEW.scope_family_id
          AND family.enabled = TRUE
    ) THEN
        RAISE EXCEPTION 'Tracked question must belong to an enabled scope family owned by the same brand';
    END IF;

    NEW.prompt := btrim(NEW.prompt);
    NEW.prompt_norm := public.normalize_tracked_prompt(NEW.prompt);
    NEW.updated_at := now();

    IF NEW.tracking_status = 'active' AND TG_OP = 'INSERT' THEN
        SELECT COUNT(*) INTO v_active_count
        FROM public.tracked_prompts
        WHERE brand_id = NEW.brand_id
          AND tracking_status = 'active';
        IF v_active_count >= 25 THEN
            RAISE EXCEPTION 'A brand may track at most 25 active buyer questions';
        END IF;
    END IF;

    IF NEW.tracking_status = 'active'
       AND TG_OP = 'UPDATE'
       AND (
           OLD.tracking_status IS DISTINCT FROM 'active'
           OR OLD.brand_id IS DISTINCT FROM NEW.brand_id
       )
    THEN
        SELECT COUNT(*) INTO v_active_count
        FROM public.tracked_prompts
        WHERE brand_id = NEW.brand_id
          AND tracking_status = 'active'
          AND id <> OLD.id;
        IF v_active_count >= 25 THEN
            RAISE EXCEPTION 'A brand may track at most 25 active buyer questions';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

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
        IF jsonb_typeof(v_binding) IS DISTINCT FROM 'object'
           OR COALESCE(v_binding->>'scopeFamilyId', '') <> v_tracked.scope_family_id::TEXT
           OR COALESCE(v_binding->>'capabilityFit', '') NOT IN (
               'explicit', 'mechanically_entailed', 'educational'
           )
           OR COALESCE(v_binding->>'solutionMode', '') NOT IN (
               'product_led', 'category_educational'
           )
        THEN
            RAISE EXCEPTION 'Tracked question has an invalid capability binding';
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
            RAISE EXCEPTION 'Capability binding references an unknown product operation';
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

CREATE OR REPLACE FUNCTION public.begin_subscription_cycle_measurement(
    p_cycle_id UUID,
    p_user_id UUID,
    p_brand_id UUID,
    p_audit_id UUID,
    p_subject_name TEXT,
    p_subject_domains TEXT[],
    p_competitors JSONB,
    p_engines TEXT[],
    p_country_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_cycle public.subscription_cycles%ROWTYPE;
    v_run_id UUID;
    v_prompt_count INTEGER;
BEGIN
    SELECT cycle_row.*
    INTO v_cycle
    FROM public.subscription_cycles cycle_row
    JOIN public.programs program_row
      ON program_row.id = cycle_row.program_id
     AND program_row.user_id = cycle_row.user_id
     AND program_row.brand_id = cycle_row.brand_id
     AND program_row.status = 'active'
    JOIN public.dodo_subscriptions subscription_row
      ON subscription_row.dodo_subscription_id = program_row.dodo_subscription_id
     AND subscription_row.user_id = cycle_row.user_id
     AND subscription_row.status = 'active'
    WHERE cycle_row.id = p_cycle_id
      AND cycle_row.user_id = p_user_id
      AND cycle_row.brand_id = p_brand_id
    FOR UPDATE OF cycle_row;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Active paid subscription cycle not found';
    END IF;
    IF v_cycle.billing_grant_id IS NULL THEN
        RAISE EXCEPTION 'Subscription cycle has no authoritative billing grant';
    END IF;
    IF v_cycle.state <> 'pending' OR v_cycle.measurement_run_id IS NOT NULL THEN
        RAISE EXCEPTION 'Subscription cycle measurement is already claimed';
    END IF;
    IF now() < v_cycle.period_start OR now() >= v_cycle.period_end THEN
        RAISE EXCEPTION 'Subscription cycle is outside its authoritative billing period';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM public.topical_audits audit_row
        WHERE audit_row.id = p_audit_id
          AND audit_row.user_id = p_user_id
          AND audit_row.brand_id = p_brand_id
          AND audit_row.run_status = 'running'
    ) THEN
        RAISE EXCEPTION 'Measurement audit is not an open audit for this brand';
    END IF;

    SELECT count(*)
    INTO v_prompt_count
    FROM public.tracked_prompts prompt_row
    WHERE prompt_row.user_id = p_user_id
      AND prompt_row.brand_id = p_brand_id
      AND prompt_row.tracking_status = 'active';

    IF v_prompt_count NOT BETWEEN 1 AND 25 THEN
        RAISE EXCEPTION 'A subscription measurement requires 1-25 active tracked questions';
    END IF;
    IF cardinality(COALESCE(p_engines, ARRAY[]::TEXT[])) = 0 THEN
        RAISE EXCEPTION 'A subscription measurement requires at least one configured engine';
    END IF;
    IF jsonb_typeof(COALESCE(p_competitors, '[]'::JSONB)) <> 'array' THEN
        RAISE EXCEPTION 'Tracked competitors must be a JSON array';
    END IF;

    INSERT INTO public.ai_probe_runs (
        user_id, brand_id, audit_id, subject_name, subject_domains,
        competitors, engines, country_code, status, phase, public_token
    ) VALUES (
        p_user_id, p_brand_id, p_audit_id, btrim(p_subject_name),
        COALESCE(p_subject_domains, ARRAY[]::TEXT[]),
        COALESCE(p_competitors, '[]'::JSONB), p_engines, p_country_code,
        'running', 'queued', NULL
    )
    RETURNING id INTO v_run_id;

    UPDATE public.subscription_cycles
    SET measurement_run_id = v_run_id,
        state = 'measuring',
        failure_code = NULL,
        updated_at = now()
    WHERE id = v_cycle.id;

    RETURN v_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_tracked_prompts_v1(UUID, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_tracked_prompts_v1(UUID, JSONB)
    TO service_role;
REVOKE ALL ON FUNCTION public.confirm_tracked_prompts(UUID, JSONB)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_tracked_prompts(UUID, JSONB)
    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.begin_subscription_cycle_measurement(
    UUID, UUID, UUID, UUID, TEXT, TEXT[], JSONB, TEXT[], TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_subscription_cycle_measurement(
    UUID, UUID, UUID, UUID, TEXT, TEXT[], JSONB, TEXT[], TEXT
) TO service_role;

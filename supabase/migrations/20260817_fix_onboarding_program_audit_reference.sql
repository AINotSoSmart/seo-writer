-- ============================================================================
-- Repair onboarding after recurring-program pivot
-- ============================================================================
-- Phase 3 removed the finite-program programs.audit_id relationship. These two
-- authenticated onboarding functions retained the old "unpurchased audit"
-- exception and therefore failed before confirmed prompts could be saved.
--
-- In the recurring model an audit is an immutable measurement snapshot, while
-- programs own brands and cycles freeze the run they measured. Scope or subject
-- changes should mark completed evidence stale regardless of program existence;
-- there is no audit-owned program exception to preserve.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_brand_scope(p_brand_id uuid, p_families jsonb, p_contract_version text, p_scope_hash text, p_brand_data jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_count INTEGER;
    v_total_seeds INTEGER;
    item JSONB;
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

    DELETE FROM public.brand_scope_families WHERE brand_id = p_brand_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_families)
    LOOP
        INSERT INTO public.brand_scope_families (
            id, brand_id, user_id, name, description, seed_keywords, evidence,
            source, priority, enabled
        ) VALUES (
            COALESCE(NULLIF(item->>'id', '')::uuid, gen_random_uuid()),
            p_brand_id,
            v_user_id,
            btrim(item->>'name'),
            btrim(item->>'description'),
            ARRAY(
                SELECT value
                FROM jsonb_array_elements_text(item->'seed_keywords') value
            ),
            COALESCE(item->'evidence', '[]'::jsonb),
            COALESCE(item->>'source', 'user'),
            COALESCE((item->>'priority')::integer, 0),
            TRUE
        );
    END LOOP;

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
$function$;

CREATE OR REPLACE FUNCTION public.save_onboarding_brand_with_scope(p_brand_id uuid, p_website_url text, p_discovered_competitors jsonb, p_families jsonb, p_contract_version text, p_scope_hash text, p_brand_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_brand_id UUID := p_brand_id;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF COALESCE(p_website_url, '') !~* '^https://[^[:space:]]+$' THEN
        RAISE EXCEPTION 'A valid HTTPS website URL is required';
    END IF;
    IF p_discovered_competitors IS NULL
       OR jsonb_typeof(p_discovered_competitors) <> 'array'
    THEN
        RAISE EXCEPTION 'Competitors must be a JSON array';
    END IF;
    IF jsonb_array_length(p_discovered_competitors) > 4 THEN
        RAISE EXCEPTION 'A brand may contain at most four direct competitors';
    END IF;

    IF v_brand_id IS NULL THEN
        INSERT INTO public.brand_details (
            user_id,
            website_url,
            brand_data,
            discovered_competitors
        ) VALUES (
            v_user_id,
            p_website_url,
            p_brand_data,
            p_discovered_competitors
        )
        RETURNING id INTO v_brand_id;
    ELSE
        PERFORM 1
        FROM public.brand_details
        WHERE id = v_brand_id
          AND user_id = v_user_id
          AND deleted_at IS NULL
        FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Brand not found';
        END IF;

        UPDATE public.brand_details
        SET website_url = p_website_url,
            discovered_competitors = p_discovered_competitors,
            current_audit_id = CASE
                WHEN website_url IS DISTINCT FROM p_website_url
                  OR COALESCE(discovered_competitors, '[]'::jsonb)
                     IS DISTINCT FROM p_discovered_competitors
                THEN NULL
                ELSE current_audit_id
            END,
            updated_at = now()
        WHERE id = v_brand_id
          AND user_id = v_user_id;
    END IF;

    PERFORM public.confirm_brand_scope(
        v_brand_id,
        p_families,
        p_contract_version,
        p_scope_hash,
        p_brand_data
    );

    -- Even an identical business-scope hash cannot make evidence from another
    -- URL current. This also covers same-host path changes, which the active
    -- program host guard intentionally allows.
    UPDATE public.topical_audits ta
    SET requires_reaudit = TRUE,
        updated_at = now()
    WHERE ta.brand_id = v_brand_id
      AND ta.user_id = v_user_id
      AND ta.run_status = 'completed'
      AND (
          ta.subject_url IS DISTINCT FROM p_website_url
          OR ARRAY(
              SELECT competitor_url.value
              FROM unnest(COALESCE(ta.input_competitors, ARRAY[]::TEXT[]))
                  AS competitor_url(value)
              ORDER BY competitor_url.value
          ) IS DISTINCT FROM ARRAY(
              SELECT competitor->>'url'
              FROM jsonb_array_elements(p_discovered_competitors) competitor
              ORDER BY competitor->>'url'
          )
      );

    RETURN v_brand_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_brand_scope(UUID, JSONB, TEXT, TEXT, JSONB)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_brand_scope(UUID, JSONB, TEXT, TEXT, JSONB)
    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.save_onboarding_brand_with_scope(
    UUID, TEXT, JSONB, JSONB, TEXT, TEXT, JSONB
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_brand_with_scope(
    UUID, TEXT, JSONB, JSONB, TEXT, TEXT, JSONB
) TO authenticated, service_role;


-- ============================================================================
-- Parent scope family — taxonomy steers thin-domain absorption
-- ============================================================================
-- Extraction emits `parent_hint` when a domain is a sub-intent of a broader
-- peer. That hint was shown on the confirmation screen but absorption still
-- routed thin domains purely by embedding proximity. These columns persist the
-- resolved parent link on the confirmed scope snapshot so Pass 2 of absorption
-- prefers the parent's qualifying cluster and only falls back to embedding
-- adjacency when the parent has no cluster.
-- ============================================================================

ALTER TABLE public.brand_scope_families
    ADD COLUMN IF NOT EXISTS parent_scope_family_id UUID;

ALTER TABLE public.audit_scope_families
    ADD COLUMN IF NOT EXISTS parent_scope_family_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'brand_scope_family_parent_fkey'
    ) THEN
        ALTER TABLE public.brand_scope_families
            ADD CONSTRAINT brand_scope_family_parent_fkey
            FOREIGN KEY (parent_scope_family_id)
            REFERENCES public.brand_scope_families(id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'audit_scope_family_parent_fkey'
    ) THEN
        ALTER TABLE public.audit_scope_families
            ADD CONSTRAINT audit_scope_family_parent_fkey
            FOREIGN KEY (parent_scope_family_id, audit_id)
            REFERENCES public.audit_scope_families(id, audit_id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'audit_scope_families'
          AND column_name = 'parent_scope_family_id'
    ) THEN
        COMMENT ON COLUMN public.audit_scope_families.parent_scope_family_id IS
            'Broader confirmed domain this area is a sub-intent of. Steers thin-domain absorption; null means no declared parent.';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- confirm_brand_scope: persist stable family ids and parent links.
-- ---------------------------------------------------------------------------
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
      AND ta.scope_hash IS DISTINCT FROM p_scope_hash
      AND NOT EXISTS (
          SELECT 1 FROM public.programs p WHERE p.audit_id = ta.id
      );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_brand_scope(UUID, JSONB, TEXT, TEXT, JSONB)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_brand_scope(UUID, JSONB, TEXT, TEXT, JSONB)
    TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_customer_audit_with_scope: copy parent links into the audit snapshot.
-- Parameter order MUST match 20260731 — Postgres rejects CREATE OR REPLACE
-- when input parameter names change.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_customer_audit_with_scope(
    p_user_id UUID,
    p_brand_id UUID,
    p_public_token TEXT,
    p_policy_version TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_brand public.brand_details%ROWTYPE;
    v_audit_id UUID;
    v_seeds TEXT[];
BEGIN
    SELECT * INTO v_brand
    FROM public.brand_details
    WHERE id = p_brand_id
      AND user_id = p_user_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Brand not found';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.topical_audits
        WHERE brand_id = p_brand_id
          AND user_id = p_user_id
          AND audit_kind = 'customer'
          AND run_status = 'running'
    ) THEN
        RAISE EXCEPTION 'An audit is already running for this brand';
    END IF;
    IF v_brand.scope_confirmed_at IS NULL
       OR COALESCE(v_brand.scope_contract_version, '') = ''
       OR COALESCE(v_brand.scope_hash, '') = ''
       OR NOT EXISTS (
           SELECT 1 FROM public.brand_scope_families
           WHERE brand_id = p_brand_id
             AND user_id = p_user_id
             AND enabled = TRUE
       )
    THEN
        RAISE EXCEPTION 'Brand has no confirmed business scope';
    END IF;

    SELECT array_agg(seed ORDER BY family_priority, seed_order)
    INTO v_seeds
    FROM (
        SELECT
            sf.priority AS family_priority,
            seed_row.ordinality AS seed_order,
            seed_row.seed
        FROM public.brand_scope_families sf
        CROSS JOIN LATERAL unnest(sf.seed_keywords)
            WITH ORDINALITY AS seed_row(seed, ordinality)
        WHERE sf.brand_id = p_brand_id
          AND sf.user_id = p_user_id
          AND sf.enabled = TRUE
    ) confirmed_seeds;

    INSERT INTO public.topical_audits (
        user_id, brand_id, subject_url, input_seeds, brand_snapshot,
        scope_contract_version, scope_hash, audit_kind, created_by_user_id,
        run_status, generation_status, generation_phase,
        harvest_policy_version, generation_error, authority_score, pool_size,
        article_count, cluster_count, competitors_scanned, topics_analyzed,
        user_pages_scanned, public_token, started_at, updated_at
    ) VALUES (
        p_user_id, p_brand_id, v_brand.website_url,
        COALESCE(v_seeds, ARRAY[]::TEXT[]), v_brand.brand_data,
        v_brand.scope_contract_version, v_brand.scope_hash, 'customer',
        p_user_id, 'running', 'running', 'competitor_discovery',
        p_policy_version, NULL, 0, 0, 0, 0, 0, 0, 0, p_public_token,
        now(), now()
    )
    RETURNING id INTO v_audit_id;

    INSERT INTO public.audit_scope_families (
        audit_id, brand_scope_family_id, user_id, name, description,
        seed_keywords, evidence, source, priority
    )
    SELECT
        v_audit_id, id, p_user_id, name, description, seed_keywords,
        evidence, source, priority
    FROM public.brand_scope_families
    WHERE brand_id = p_brand_id
      AND user_id = p_user_id
      AND enabled = TRUE
    ORDER BY priority;

    UPDATE public.audit_scope_families AS child
    SET parent_scope_family_id = parent_audit.id
    FROM public.brand_scope_families AS child_bsf
    JOIN public.brand_scope_families AS parent_bsf
        ON parent_bsf.id = child_bsf.parent_scope_family_id
    JOIN public.audit_scope_families AS parent_audit
        ON parent_audit.audit_id = v_audit_id
       AND parent_audit.brand_scope_family_id = parent_bsf.id
    WHERE child.audit_id = v_audit_id
      AND child.brand_scope_family_id = child_bsf.id
      AND child_bsf.brand_id = p_brand_id
      AND child_bsf.user_id = p_user_id
      AND child_bsf.parent_scope_family_id IS NOT NULL;

    RETURN v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_audit_with_scope(
    UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_audit_with_scope(
    UUID, UUID, TEXT, TEXT
) TO service_role;

-- ---------------------------------------------------------------------------
-- create_scoped_prospect_audit: preserve client family ids + parent links.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_scoped_prospect_audit(
    p_creator_user_id UUID,
    p_subject_url TEXT,
    p_input_seeds TEXT[],
    p_input_competitors TEXT[],
    p_brand_snapshot JSONB,
    p_policy_version TEXT,
    p_scope_contract_version TEXT,
    p_scope_hash TEXT,
    p_scope_families JSONB,
    p_public_token TEXT,
    p_claim_token_hash TEXT,
    p_claim_email_normalized TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_audit_id UUID;
    item JSONB;
    v_count INTEGER;
    v_total_seeds INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = p_creator_user_id
    ) THEN
        RAISE EXCEPTION 'Prospect audit creator does not exist';
    END IF;

    v_count := jsonb_array_length(COALESCE(p_scope_families, '[]'::jsonb));
    SELECT COALESCE(
        SUM(jsonb_array_length(COALESCE(family->'seed_keywords', '[]'::jsonb))),
        0
    )
    INTO v_total_seeds
    FROM jsonb_array_elements(COALESCE(p_scope_families, '[]'::jsonb)) family;

    IF v_count < 1 OR v_count > 12 OR v_total_seeds > 12 THEN
        RAISE EXCEPTION 'Prospect scope must contain 1-12 areas and at most 12 searches';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_scope_families) family
        CROSS JOIN LATERAL jsonb_array_elements_text(
            COALESCE(family->'seed_keywords', '[]'::jsonb)
        ) AS seed(value)
        GROUP BY lower(btrim(seed.value))
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Every prospect search must belong to exactly one area';
    END IF;
    IF COALESCE(p_scope_hash, '') = ''
       OR COALESCE(p_scope_contract_version, '') = ''
    THEN
        RAISE EXCEPTION 'Prospect scope version and hash are required';
    END IF;

    INSERT INTO public.topical_audits (
        user_id, brand_id, subject_url, input_seeds, input_competitors,
        brand_snapshot, audit_kind, created_by_user_id, run_status,
        generation_status, generation_phase, harvest_policy_version,
        scope_contract_version, scope_hash, public_token
    ) VALUES (
        p_creator_user_id, NULL, p_subject_url, p_input_seeds,
        p_input_competitors, p_brand_snapshot, 'prospect', p_creator_user_id,
        'running', 'running', 'queued', p_policy_version,
        p_scope_contract_version, p_scope_hash, p_public_token
    )
    RETURNING id INTO v_audit_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_scope_families)
    LOOP
        INSERT INTO public.audit_scope_families (
            id, audit_id, user_id, name, description, seed_keywords, evidence,
            source, priority
        ) VALUES (
            COALESCE(NULLIF(item->>'id', '')::uuid, gen_random_uuid()),
            v_audit_id,
            p_creator_user_id,
            btrim(item->>'name'),
            btrim(item->>'description'),
            ARRAY(
                SELECT value
                FROM jsonb_array_elements_text(item->'seed_keywords') value
            ),
            COALESCE(item->'evidence', '[]'::jsonb),
            'user',
            COALESCE((item->>'priority')::integer, 0)
        );
    END LOOP;

    UPDATE public.audit_scope_families child
    SET parent_scope_family_id = NULLIF(family_row->>'parent_scope_family_id', '')::uuid
    FROM jsonb_array_elements(p_scope_families) AS family_row
    WHERE child.audit_id = v_audit_id
      AND child.id = COALESCE(NULLIF(family_row->>'id', '')::uuid, child.id)
      AND NULLIF(family_row->>'parent_scope_family_id', '') IS NOT NULL
      AND NULLIF(family_row->>'parent_scope_family_id', '')::uuid <> child.id
      AND EXISTS (
          SELECT 1 FROM public.audit_scope_families parent
          WHERE parent.id = NULLIF(family_row->>'parent_scope_family_id', '')::uuid
            AND parent.audit_id = v_audit_id
      );

    INSERT INTO public.audit_claims (
        audit_id, claim_token_hash, claim_email_normalized
    ) VALUES (
        v_audit_id, p_claim_token_hash, lower(trim(p_claim_email_normalized))
    );

    RETURN v_audit_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_scoped_prospect_audit(
    UUID, TEXT, TEXT[], TEXT[], JSONB, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_scoped_prospect_audit(
    UUID, TEXT, TEXT[], TEXT[], JSONB, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) TO service_role;

DO $$
DECLARE
    missing TEXT;
BEGIN
    SELECT string_agg(c.name, ', ')
    INTO missing
    FROM (VALUES
        ('brand_scope_families.parent_scope_family_id'),
        ('audit_scope_families.parent_scope_family_id')
    ) AS c(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = split_part(c.name, '.', 1)
          AND column_name = split_part(c.name, '.', 2)
    );

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'Parent scope family columns missing after migration: %', missing;
    END IF;
END $$;

-- claim_prospect_audit: preserve family ids and parent links when scope transfers
-- to the claimed brand, so a re-audit keeps parent-guided absorption.
DO $$
DECLARE
    v_src TEXT;
    v_new TEXT;
BEGIN
    SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc
    WHERE oid = to_regprocedure('public.claim_prospect_audit(text)');

    IF v_src IS NULL THEN
        RAISE NOTICE 'claim_prospect_audit is missing; skip parent-link patch';
        RETURN;
    END IF;

    IF position('parent_scope_family_id' IN v_src) > 0 THEN
        RAISE NOTICE 'claim_prospect_audit already copies parent links';
        RETURN;
    END IF;

    v_new := replace(
        v_src,
        $patch$'name', sf.name,
            'description', sf.description,$patch$,
        $patch$'id', sf.id,
            'name', sf.name,
            'description', sf.description,
            'parent_scope_family_id', sf.parent_scope_family_id,$patch$
    );
    v_new := replace(
        v_new,
        $patch$INSERT INTO public.brand_scope_families (
        brand_id, user_id, name, description, seed_keywords, evidence,
        source, priority, enabled
    )
    SELECT
        v_brand_id, v_user_id, sf.name, sf.description, sf.seed_keywords,
        sf.evidence,
        CASE WHEN sf.source = 'legacy' THEN 'user' ELSE sf.source END,
        sf.priority, TRUE
    FROM public.audit_scope_families sf$patch$,
        $patch$INSERT INTO public.brand_scope_families (
        id, brand_id, user_id, name, description, seed_keywords, evidence,
        source, priority, enabled, parent_scope_family_id
    )
    SELECT
        sf.id, v_brand_id, v_user_id, sf.name, sf.description, sf.seed_keywords,
        sf.evidence,
        CASE WHEN sf.source = 'legacy' THEN 'user' ELSE sf.source END,
        sf.priority, TRUE, sf.parent_scope_family_id
    FROM public.audit_scope_families sf$patch$
    );

    IF v_new = v_src THEN
        RAISE EXCEPTION
            'Could not patch claim_prospect_audit — its scope copy no longer matches the expected shape.';
    END IF;

    EXECUTE v_new;
    RAISE NOTICE 'claim_prospect_audit now preserves parent_scope_family_id';
END $$;

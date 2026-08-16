-- ============================================================================
-- Subscription Phase 8: one launch plan and provider-owned introductory price
-- ============================================================================
-- Dodo owns the recurring $189 price and the three-cycle $90 discount. The
-- database owns a stable local plan identity and the publication path chosen
-- before checkout. Historical tier rows remain for invoices/subscriptions but
-- cannot be selected by a new checkout.
-- ============================================================================

ALTER TABLE public.dodo_pricing_plans
    ADD COLUMN IF NOT EXISTS plan_code TEXT;

-- Repair the spelling used by an early manual sandbox setup before creating
-- the canonical row. Without this, a re-run would insert a second Founding
-- beta plan while checkout continued to ignore `FOUNDINGBETA`.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.dodo_pricing_plans
        WHERE plan_code = 'founding_beta'
    ) THEN
        UPDATE public.dodo_pricing_plans
        SET plan_code = 'founding_beta',
            updated_at = now()
        WHERE id = (
            SELECT id
            FROM public.dodo_pricing_plans
            WHERE lower(regexp_replace(COALESCE(plan_code, ''), '[^a-z0-9]', '', 'g')) = 'foundingbeta'
            ORDER BY is_active DESC, created_at
            LIMIT 1
        );
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS dodo_pricing_plans_plan_code_key
    ON public.dodo_pricing_plans(plan_code)
    WHERE plan_code IS NOT NULL;

UPDATE public.dodo_pricing_plans
SET is_active = FALSE,
    updated_at = now()
WHERE plan_code IS DISTINCT FROM 'founding_beta'
  AND (
      lower(name) IN ('close', 'accelerate', 'dominate')
      OR COALESCE(metadata->>'tier', '') IN ('close', 'accelerate', 'dominate')
  );

INSERT INTO public.dodo_pricing_plans (
    name,
    description,
    price,
    credits,
    currency,
    dodo_product_id,
    is_active,
    metadata,
    plan_code
)
SELECT
    'Founding beta',
    'One site, 40 tracked buyer questions, two AI engines and up to eight prioritised create or refresh actions per billing cycle.',
    189,
    0,
    'USD',
    NULL,
    TRUE,
    jsonb_build_object(
        'plan_id', 'founding_beta',
        'introductory_price', 99,
        'introductory_periods', 3,
        'continuing_price', 189,
        'tracked_prompt_allowance', 40,
        'action_allowance', 8,
        'price_phase_owner', 'dodo_cycle_limited_discount'
    ),
    'founding_beta'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.dodo_pricing_plans
    WHERE plan_code = 'founding_beta'
);

UPDATE public.dodo_pricing_plans
SET name = 'Founding beta',
    description = 'One site, 40 tracked buyer questions, two AI engines and up to eight prioritised create or refresh actions per billing cycle.',
    price = 189,
    credits = 0,
    currency = 'USD',
    is_active = TRUE,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'plan_id', 'founding_beta',
        'introductory_price', 99,
        'introductory_periods', 3,
        'continuing_price', 189,
        'tracked_prompt_allowance', 40,
        'action_allowance', 8,
        'price_phase_owner', 'dodo_cycle_limited_discount'
    ),
    updated_at = now()
WHERE plan_code = 'founding_beta';

DO $$
BEGIN
    IF to_regclass('public.dodo_pricing_plans') IS NOT NULL THEN
        COMMENT ON TABLE public.dodo_pricing_plans IS
            'Provider product mappings. plan_code=founding_beta is the only launch checkout; inactive tier rows are retained for historical billing joins.';
        COMMENT ON COLUMN public.dodo_pricing_plans.plan_code IS
            'Stable application plan identity; never use provider product IDs as the product contract.';
    END IF;
END;
$$;

ALTER TABLE public.programs
    ADD COLUMN IF NOT EXISTS publication_url_pattern TEXT;

ALTER TABLE public.programs
    DROP CONSTRAINT IF EXISTS programs_publication_url_pattern_check,
    ADD CONSTRAINT programs_publication_url_pattern_check CHECK (
        publication_url_pattern IS NULL
        OR (
            publication_url_pattern LIKE 'https://%'
            AND publication_url_pattern NOT LIKE '%?%'
            AND publication_url_pattern NOT LIKE '%#%'
            AND (
                length(publication_url_pattern)
                - length(replace(publication_url_pattern, '{slug}', ''))
            ) = length('{slug}')
        )
    );

DO $$
BEGIN
    IF to_regclass('public.programs') IS NOT NULL THEN
        COMMENT ON COLUMN public.programs.publication_url_pattern IS
            'Same-site HTTPS URL template confirmed before checkout; contains {slug} exactly once.';
    END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.ensure_recurring_program(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.ensure_recurring_program(
    p_user_id UUID,
    p_brand_id UUID,
    p_dodo_subscription_id TEXT,
    p_publication_url_pattern TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_program_id UUID;
    v_brand_url TEXT;
    v_brand_host TEXT;
    v_pattern_host TEXT;
BEGIN
    SELECT website_url INTO v_brand_url
    FROM public.brand_details brand
    WHERE brand.id = p_brand_id
      AND brand.user_id = p_user_id
      AND brand.deleted_at IS NULL;
    IF v_brand_url IS NULL THEN
        RAISE EXCEPTION 'Recurring program brand is not owned by this user';
    END IF;

    IF p_publication_url_pattern IS NOT NULL THEN
        IF p_publication_url_pattern NOT LIKE 'https://%'
           OR p_publication_url_pattern LIKE '%?%'
           OR p_publication_url_pattern LIKE '%#%'
           OR (
               length(p_publication_url_pattern)
               - length(replace(p_publication_url_pattern, '{slug}', ''))
           ) <> length('{slug}') THEN
            RAISE EXCEPTION 'Recurring program publication pattern is invalid';
        END IF;
        v_brand_host := lower(regexp_replace(
            split_part(split_part(v_brand_url, '://', 2), '/', 1),
            '^www\.',
            ''
        ));
        v_pattern_host := lower(regexp_replace(
            split_part(split_part(p_publication_url_pattern, '://', 2), '/', 1),
            '^www\.',
            ''
        ));
        IF v_brand_host = '' OR v_pattern_host IS DISTINCT FROM v_brand_host THEN
            RAISE EXCEPTION 'Recurring program publication pattern must use the brand host';
        END IF;
    END IF;

    SELECT id INTO v_program_id
    FROM public.programs
    WHERE dodo_subscription_id = p_dodo_subscription_id
    FOR UPDATE;

    IF v_program_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.programs
            WHERE id = v_program_id
              AND user_id = p_user_id
              AND brand_id = p_brand_id
        ) THEN
            RAISE EXCEPTION 'Subscription is already attached to another program';
        END IF;
        UPDATE public.programs
        SET status = CASE
                WHEN status IN ('pending', 'cancelled') THEN 'active'
                ELSE status
            END,
            paused_at = CASE
                WHEN status IN ('pending', 'cancelled') THEN NULL
                ELSE paused_at
            END,
            publication_url_pattern = COALESCE(
                publication_url_pattern,
                p_publication_url_pattern
            ),
            updated_at = now()
        WHERE id = v_program_id;
        RETURN v_program_id;
    END IF;

    IF p_publication_url_pattern IS NULL THEN
        RAISE EXCEPTION 'A new recurring program requires a publication URL pattern';
    END IF;

    INSERT INTO public.programs (
        user_id,
        brand_id,
        dodo_subscription_id,
        plan_id,
        tracked_prompt_allowance,
        action_allowance,
        publication_url_pattern,
        status
    ) VALUES (
        p_user_id,
        p_brand_id,
        p_dodo_subscription_id,
        'founding_beta',
        40,
        8,
        p_publication_url_pattern,
        'active'
    )
    RETURNING id INTO v_program_id;

    RETURN v_program_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_recurring_program(UUID, UUID, TEXT, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_recurring_program(UUID, UUID, TEXT, TEXT)
    TO service_role;

-- ============================================================================
-- Subscription Phase 1: durable tracked buyer questions
-- ============================================================================
-- A probe prompt used to exist only inside ai_probe_prompts, so its identity
-- disappeared with the run. This separates the question the customer chose
-- from one month's observation of that question.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tracked_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    scope_family_id UUID NOT NULL,
    prompt TEXT NOT NULL,
    prompt_norm TEXT NOT NULL,
    intent TEXT NOT NULL,
    article_type TEXT NOT NULL,
    source_seed TEXT NOT NULL,
    position INTEGER NOT NULL,
    tracking_status TEXT NOT NULL DEFAULT 'active',
    coverage_state TEXT NOT NULL DEFAULT 'unknown',
    target_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retired_at TIMESTAMPTZ,

    CONSTRAINT tracked_prompts_scope_family_fkey
        FOREIGN KEY (scope_family_id)
        REFERENCES public.brand_scope_families(id)
        ON DELETE NO ACTION
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT tracked_prompts_prompt_length_check
        CHECK (length(btrim(prompt)) BETWEEN 15 AND 200),
    CONSTRAINT tracked_prompts_source_seed_check
        CHECK (length(btrim(source_seed)) BETWEEN 1 AND 200),
    CONSTRAINT tracked_prompts_no_calendar_year_check
        CHECK (prompt !~ '\m(19|20|21)[0-9]{2}\M'),
    CONSTRAINT tracked_prompts_intent_check
        CHECK (intent IN ('recommendation', 'alternatives', 'comparison', 'problem', 'howto')),
    CONSTRAINT tracked_prompts_article_type_check
        CHECK (article_type IN ('commercial', 'informational', 'howto')),
    CONSTRAINT tracked_prompts_position_check
        CHECK (position BETWEEN 0 AND 39),
    CONSTRAINT tracked_prompts_tracking_status_check
        CHECK (tracking_status IN ('active', 'inactive', 'retired')),
    CONSTRAINT tracked_prompts_coverage_state_check
        CHECK (coverage_state IN ('unknown', 'no_page', 'has_page')),
    CONSTRAINT tracked_prompts_retired_at_check
        CHECK ((tracking_status = 'retired') = (retired_at IS NOT NULL)),
    CONSTRAINT tracked_prompts_target_url_check
        CHECK (
            (coverage_state = 'has_page' AND target_url ~* '^https://[^[:space:]]+$')
            OR (coverage_state IN ('unknown', 'no_page') AND target_url IS NULL)
        ),
    CONSTRAINT tracked_prompts_brand_prompt_key UNIQUE (brand_id, prompt_norm)
);

CREATE UNIQUE INDEX IF NOT EXISTS tracked_prompts_active_position_key
    ON public.tracked_prompts(brand_id, position)
    WHERE tracking_status = 'active';
CREATE INDEX IF NOT EXISTS tracked_prompts_active_brand_idx
    ON public.tracked_prompts(brand_id, position)
    WHERE tracking_status = 'active';
CREATE INDEX IF NOT EXISTS tracked_prompts_owner_idx
    ON public.tracked_prompts(user_id, brand_id);

ALTER TABLE public.ai_probe_prompts
    ADD COLUMN IF NOT EXISTS tracked_prompt_id UUID
        REFERENCES public.tracked_prompts(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS ai_probe_prompts_run_tracked_key
    ON public.ai_probe_prompts(run_id, tracked_prompt_id)
    WHERE tracked_prompt_id IS NOT NULL;

-- Keep SQL-side dedupe identical to lib/harvest/types.ts::normalizeQuery.
-- The RPC is callable by authenticated clients, so it must derive the norm
-- rather than trusting a client-supplied value.
CREATE OR REPLACE FUNCTION public.normalize_tracked_prompt(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
    SELECT btrim(
        regexp_replace(
            regexp_replace(
                translate(
                    lower(COALESCE(p_text, '')),
                    chr(34) || chr(39),
                    ''
                ),
                '[?!.,;:]+$',
                '',
                'g'
            ),
            '[[:space:]]+',
            ' ',
            'g'
        )
    )
$$;

-- Enforce ownership and the 40-active-question allowance even for writes that
-- do not use the confirmation RPC.
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

    IF NEW.tracking_status = 'active'
       AND TG_OP = 'INSERT'
    THEN
        SELECT COUNT(*) INTO v_active_count
        FROM public.tracked_prompts
        WHERE brand_id = NEW.brand_id
          AND tracking_status = 'active';
        IF v_active_count >= 40 THEN
            RAISE EXCEPTION 'A brand may track at most 40 active buyer questions';
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
        IF v_active_count >= 40 THEN
            RAISE EXCEPTION 'A brand may track at most 40 active buyer questions';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tracked_prompt_write_trigger ON public.tracked_prompts;
CREATE TRIGGER guard_tracked_prompt_write_trigger
    BEFORE INSERT OR UPDATE ON public.tracked_prompts
    FOR EACH ROW EXECUTE FUNCTION public.guard_tracked_prompt_write();

-- Atomically commits the exact set reviewed on the confirmation screen. Rows
-- with the same normalized question are reactivated rather than duplicated,
-- so stable identity survives an edit/retry.
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
    v_user_id UUID := auth.uid();
    v_item JSONB;
    v_text TEXT;
    v_norm TEXT;
    v_scope_family_id UUID;
    v_source_seed TEXT;
    v_position INTEGER := 0;
    v_previously_active UUID[] := ARRAY[]::UUID[];
    v_active_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;
    IF p_prompts IS NULL OR jsonb_typeof(p_prompts) <> 'array'
       OR jsonb_array_length(p_prompts) <> 40
    THEN
        RAISE EXCEPTION 'Confirm exactly 40 buyer questions';
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

    -- Free active positions before applying a reordered set. Only rows that
    -- were active on entry are candidates for retirement below.
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

    IF v_active_count <> 40 THEN
        RAISE EXCEPTION 'Tracked question confirmation did not produce exactly 40 active rows';
    END IF;

    RETURN v_active_count;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_tracked_prompt(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_tracked_prompt(TEXT)
    TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.confirm_tracked_prompts(UUID, JSONB)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_tracked_prompts(UUID, JSONB)
    TO authenticated, service_role;

ALTER TABLE public.tracked_prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own tracked prompts"
    ON public.tracked_prompts;
CREATE POLICY "Users manage own tracked prompts"
    ON public.tracked_prompts
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_prompts TO authenticated;

    COMMENT ON TABLE public.tracked_prompts IS
    'Stable buyer questions confirmed once and observed again in each subscription cycle.';
    COMMENT ON COLUMN public.ai_probe_prompts.tracked_prompt_id IS
    'The durable tracked question this run-scoped observation measured; null only for historical pre-subscription runs.';

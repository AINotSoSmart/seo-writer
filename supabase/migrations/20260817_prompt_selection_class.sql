-- ============================================================================
-- Buyer questions carry a selection class
-- ============================================================================
-- A question is only a competitive measurement if a good answer has to NAME
-- PRODUCTS. A live run returned 32 tutorials out of 40 ("how do I remove
-- scratches from scanned family pictures"); an assistant answers those with
-- technique and names nothing, so the brand's absence proved nothing — yet all
-- 40 sat in one denominator.
--
-- `selection_class` is the axis that separates them. It is ORTHOGONAL to
-- `intent`: intent decides `article_type` for the writer and must keep meaning
-- exactly what it means. See lib/visibility/selection-class.ts.
--
-- Forward-only and re-runnable. Apply through the Supabase SQL editor.
-- ============================================================================

ALTER TABLE public.tracked_prompts
    ADD COLUMN IF NOT EXISTS selection_class TEXT NOT NULL DEFAULT 'knowledge';

ALTER TABLE public.ai_probe_prompts
    ADD COLUMN IF NOT EXISTS selection_class TEXT NOT NULL DEFAULT 'knowledge';

-- The default is the WEAKEST class on purpose. An unclassified question must
-- not be able to inflate the headline metric: it stays out of the
-- recommendation denominator until something classifies it, which is the safe
-- direction to be wrong in. Every row that existed before this migration is
-- genuinely unclassified, so 'knowledge' is also the honest value for them.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tracked_prompts_selection_class_valid'
          AND conrelid = 'public.tracked_prompts'::regclass
    ) THEN
        ALTER TABLE public.tracked_prompts
            ADD CONSTRAINT tracked_prompts_selection_class_valid
            CHECK (selection_class IN (
                'knowledge', 'instruction', 'exploration',
                'solution', 'discovery', 'recommendation', 'constrained'
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ai_probe_prompts_selection_class_valid'
          AND conrelid = 'public.ai_probe_prompts'::regclass
    ) THEN
        ALTER TABLE public.ai_probe_prompts
            ADD CONSTRAINT ai_probe_prompts_selection_class_valid
            CHECK (selection_class IN (
                'knowledge', 'instruction', 'exploration',
                'solution', 'discovery', 'recommendation', 'constrained'
            ));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS tracked_prompts_selection_class_idx
    ON public.tracked_prompts (brand_id, selection_class)
    WHERE tracking_status = 'active';

-- ----------------------------------------------------------------------------
-- Persist the class at confirm time
-- ----------------------------------------------------------------------------
-- Same delegation shape the previous pass used: `_v1` still owns the insert,
-- this wrapper adds the capability binding and now the selection class, so the
-- insert statement itself is not duplicated a third time.

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
            RAISE EXCEPTION 'Confirmed tracked question was not found for capability binding';
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

        -- Unrecognised or absent values fall back to the weakest class rather
        -- than raising. A caller that omits it gets an honest "unclassified",
        -- not a rejected confirmation — the class is a measurement refinement,
        -- not a correctness precondition for saving the customer's questions.
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

REVOKE ALL ON FUNCTION public.confirm_tracked_prompts(UUID, JSONB)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_tracked_prompts(UUID, JSONB)
    TO authenticated, service_role;

DO $$
BEGIN
    IF to_regclass('public.tracked_prompts') IS NOT NULL THEN
        COMMENT ON COLUMN public.tracked_prompts.selection_class IS
            'How strongly this question forces an assistant to choose between products. Orthogonal to intent, which decides article_type. The four strongest classes form the Recommendation Visibility denominator.';
    END IF;
    IF to_regclass('public.ai_probe_prompts') IS NOT NULL THEN
        COMMENT ON COLUMN public.ai_probe_prompts.selection_class IS
            'Copied from the tracked question at probe time, so a run keeps the class it was measured under even if the question is later reclassified.';
    END IF;
END;
$$;

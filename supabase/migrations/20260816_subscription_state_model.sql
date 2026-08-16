-- ============================================================================
-- Subscription Phase 2: recurring opportunities, cycles and selected actions
-- ============================================================================
-- Measurement evidence remains immutable and run-scoped. These tables add the
-- durable commercial state above it:
--
--   tracked question -> opportunity -> selected cycle action -> planned output
--
-- The finite-program tables remain intact until Phase 3 re-homes their billing,
-- cost, link and delivery dependants.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.content_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    tracked_prompt_id UUID NOT NULL REFERENCES public.tracked_prompts(id) ON DELETE RESTRICT,

    state TEXT NOT NULL DEFAULT 'open'
        CHECK (state IN ('open', 'needs_input', 'monitoring', 'resolved', 'dismissed')),
    resolution_type TEXT NOT NULL DEFAULT 'unknown'
        CHECK (resolution_type IN ('create', 'refresh', 'report_only', 'unknown')),

    first_seen_run_id UUID REFERENCES public.ai_probe_runs(id) ON DELETE RESTRICT,
    last_seen_run_id UUID REFERENCES public.ai_probe_runs(id) ON DELETE RESTRICT,
    last_verdict TEXT CHECK (last_verdict IN ('absent', 'outranked', 'present')),
    last_priority REAL,
    last_reason TEXT,
    target_url TEXT,

    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT content_opportunities_brand_prompt_key
        UNIQUE (brand_id, tracked_prompt_id),
    CONSTRAINT content_opportunities_resolved_at_check
        CHECK ((state = 'resolved') = (resolved_at IS NOT NULL)),
    CONSTRAINT content_opportunities_target_url_check
        CHECK (
            (target_url IS NULL OR target_url ~* '^https://[^[:space:]]+$')
            AND (resolution_type <> 'refresh' OR target_url IS NOT NULL)
        )
);

CREATE INDEX IF NOT EXISTS content_opportunities_brand_state_idx
    ON public.content_opportunities(brand_id, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS content_opportunities_last_run_idx
    ON public.content_opportunities(last_seen_run_id);

CREATE TABLE IF NOT EXISTS public.subscription_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE RESTRICT,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE RESTRICT,
    billing_grant_id UUID REFERENCES public.subscription_period_grants(id) ON DELETE RESTRICT,

    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    measurement_run_id UUID REFERENCES public.ai_probe_runs(id) ON DELETE RESTRICT,
    state TEXT NOT NULL DEFAULT 'pending'
        CHECK (state IN (
            'pending', 'measuring', 'awaiting_input', 'producing',
            'ready', 'delivered', 'failed'
        )),
    action_allowance INTEGER NOT NULL DEFAULT 8
        CHECK (action_allowance BETWEEN 0 AND 8),

    delivered_at TIMESTAMPTZ,
    failure_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT subscription_cycles_program_period_key
        UNIQUE (program_id, period_start),
    CONSTRAINT subscription_cycles_period_check
        CHECK (period_end > period_start),
    CONSTRAINT subscription_cycles_delivered_at_check
        CHECK ((state = 'delivered') = (delivered_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_cycles_billing_grant_key
    ON public.subscription_cycles(billing_grant_id)
    WHERE billing_grant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subscription_cycles_measurement_run_key
    ON public.subscription_cycles(measurement_run_id)
    WHERE measurement_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscription_cycles_brand_period_idx
    ON public.subscription_cycles(brand_id, period_start DESC);
CREATE INDEX IF NOT EXISTS subscription_cycles_state_idx
    ON public.subscription_cycles(state, period_start);

CREATE TABLE IF NOT EXISTS public.cycle_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES public.subscription_cycles(id) ON DELETE RESTRICT,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE RESTRICT,

    resolution_type TEXT NOT NULL
        CHECK (resolution_type IN ('create', 'refresh')),
    state TEXT NOT NULL DEFAULT 'selected'
        CHECK (state IN ('selected', 'generating', 'ready', 'delivered', 'failed')),
    rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 8),
    selection_reason TEXT NOT NULL CHECK (length(btrim(selection_reason)) > 0),
    target_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ready_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failure_code TEXT,

    CONSTRAINT cycle_actions_cycle_rank_key UNIQUE (cycle_id, rank),
    CONSTRAINT cycle_actions_target_url_check
        CHECK (
            (target_url IS NULL OR target_url ~* '^https://[^[:space:]]+$')
            AND (resolution_type <> 'refresh' OR target_url IS NOT NULL)
        ),
    CONSTRAINT cycle_actions_ready_at_check
        CHECK (state NOT IN ('ready', 'delivered') OR ready_at IS NOT NULL),
    CONSTRAINT cycle_actions_delivered_at_check
        CHECK ((state = 'delivered') = (delivered_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS cycle_actions_cycle_state_idx
    ON public.cycle_actions(cycle_id, state, rank);
CREATE INDEX IF NOT EXISTS cycle_actions_brand_idx
    ON public.cycle_actions(brand_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.cycle_action_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE RESTRICT,
    cycle_id UUID NOT NULL REFERENCES public.subscription_cycles(id) ON DELETE RESTRICT,
    cycle_action_id UUID NOT NULL REFERENCES public.cycle_actions(id) ON DELETE RESTRICT,
    opportunity_id UUID NOT NULL REFERENCES public.content_opportunities(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT cycle_action_opportunities_action_opportunity_key
        UNIQUE (cycle_action_id, opportunity_id),
    CONSTRAINT cycle_action_opportunities_cycle_opportunity_key
        UNIQUE (cycle_id, opportunity_id)
);

CREATE INDEX IF NOT EXISTS cycle_action_opportunities_action_idx
    ON public.cycle_action_opportunities(cycle_action_id);
CREATE INDEX IF NOT EXISTS cycle_action_opportunities_opportunity_idx
    ON public.cycle_action_opportunities(opportunity_id);

-- The output owns the single authoritative action/output link. Keeping a
-- second planned_article_id on cycle_actions would permit contradictory pairs.
ALTER TABLE public.planned_articles
    ADD COLUMN IF NOT EXISTS cycle_action_id UUID
        REFERENCES public.cycle_actions(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS planned_articles_cycle_action_key
    ON public.planned_articles(cycle_action_id)
    WHERE cycle_action_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Cross-table ownership and allowance guards
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_content_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.tracked_prompts tracked
        WHERE tracked.id = NEW.tracked_prompt_id
          AND tracked.user_id = NEW.user_id
          AND tracked.brand_id = NEW.brand_id
    ) THEN
        RAISE EXCEPTION 'Opportunity must reference a tracked question owned by the same brand';
    END IF;

    IF NEW.first_seen_run_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.ai_probe_runs run_row
        WHERE run_row.id = NEW.first_seen_run_id
          AND run_row.user_id = NEW.user_id
          AND run_row.brand_id = NEW.brand_id
    ) THEN
        RAISE EXCEPTION 'First observation run must belong to the opportunity brand';
    END IF;

    IF NEW.last_seen_run_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.ai_probe_runs run_row
        WHERE run_row.id = NEW.last_seen_run_id
          AND run_row.user_id = NEW.user_id
          AND run_row.brand_id = NEW.brand_id
    ) THEN
        RAISE EXCEPTION 'Latest observation run must belong to the opportunity brand';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_content_opportunity_trigger ON public.content_opportunities;
CREATE TRIGGER guard_content_opportunity_trigger
    BEFORE INSERT OR UPDATE ON public.content_opportunities
    FOR EACH ROW EXECUTE FUNCTION public.guard_content_opportunity();

CREATE OR REPLACE FUNCTION public.guard_subscription_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.programs program_row
        WHERE program_row.id = NEW.program_id
          AND program_row.user_id = NEW.user_id
          AND program_row.brand_id = NEW.brand_id
    ) THEN
        RAISE EXCEPTION 'Subscription cycle must belong to its program and brand';
    END IF;

    IF NEW.billing_grant_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.subscription_period_grants grant_row
        WHERE grant_row.id = NEW.billing_grant_id
          AND grant_row.user_id = NEW.user_id
          AND grant_row.program_id = NEW.program_id
    ) THEN
        RAISE EXCEPTION 'Billing grant must authorize the same user and program';
    END IF;

    IF NEW.measurement_run_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.ai_probe_runs run_row
        WHERE run_row.id = NEW.measurement_run_id
          AND run_row.user_id = NEW.user_id
          AND run_row.brand_id = NEW.brand_id
    ) THEN
        RAISE EXCEPTION 'Measurement run must belong to the subscription cycle brand';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_subscription_cycle_trigger ON public.subscription_cycles;
CREATE TRIGGER guard_subscription_cycle_trigger
    BEFORE INSERT OR UPDATE ON public.subscription_cycles
    FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_cycle();

CREATE OR REPLACE FUNCTION public.guard_cycle_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_allowance INTEGER;
    v_count INTEGER;
BEGIN
    SELECT cycle_row.action_allowance
    INTO v_allowance
    FROM public.subscription_cycles cycle_row
    WHERE cycle_row.id = NEW.cycle_id
      AND cycle_row.user_id = NEW.user_id
      AND cycle_row.brand_id = NEW.brand_id
    FOR UPDATE;

    IF v_allowance IS NULL THEN
        RAISE EXCEPTION 'Cycle action must belong to its subscription cycle and brand';
    END IF;

    IF NEW.rank > v_allowance THEN
        RAISE EXCEPTION 'Cycle action rank exceeds this cycle allowance';
    END IF;

    SELECT COUNT(*)
    INTO v_count
    FROM public.cycle_actions action_row
    WHERE action_row.cycle_id = NEW.cycle_id
      AND (TG_OP = 'INSERT' OR action_row.id <> NEW.id);

    IF v_count >= v_allowance THEN
        RAISE EXCEPTION 'Cycle action allowance is already full';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_cycle_action_trigger ON public.cycle_actions;
CREATE TRIGGER guard_cycle_action_trigger
    BEFORE INSERT OR UPDATE ON public.cycle_actions
    FOR EACH ROW EXECUTE FUNCTION public.guard_cycle_action();

CREATE OR REPLACE FUNCTION public.guard_cycle_action_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_resolution_type TEXT;
    v_action_target_url TEXT;
    v_opportunity_resolution_type TEXT;
    v_opportunity_target_url TEXT;
BEGIN
    SELECT action_row.resolution_type, action_row.target_url
    INTO v_resolution_type, v_action_target_url
    FROM public.cycle_actions action_row
    WHERE action_row.id = NEW.cycle_action_id
      AND action_row.cycle_id = NEW.cycle_id
      AND action_row.user_id = NEW.user_id
      AND action_row.brand_id = NEW.brand_id;

    IF v_resolution_type IS NULL THEN
        RAISE EXCEPTION 'Selected action must belong to the junction cycle and brand';
    END IF;

    SELECT opportunity_row.resolution_type, opportunity_row.target_url
    INTO v_opportunity_resolution_type, v_opportunity_target_url
    FROM public.content_opportunities opportunity_row
    WHERE opportunity_row.id = NEW.opportunity_id
      AND opportunity_row.user_id = NEW.user_id
      AND opportunity_row.brand_id = NEW.brand_id;

    IF v_opportunity_resolution_type IS NULL THEN
        RAISE EXCEPTION 'Opportunity must belong to the selected action brand';
    END IF;

    IF v_opportunity_resolution_type <> v_resolution_type THEN
        RAISE EXCEPTION 'Selected action and opportunity must use the same resolution type';
    END IF;

    IF v_resolution_type = 'refresh'
       AND v_action_target_url IS DISTINCT FROM v_opportunity_target_url
    THEN
        RAISE EXCEPTION 'A refresh action can only combine opportunities for the same target URL';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_cycle_action_opportunity_trigger ON public.cycle_action_opportunities;
CREATE TRIGGER guard_cycle_action_opportunity_trigger
    BEFORE INSERT OR UPDATE ON public.cycle_action_opportunities
    FOR EACH ROW EXECUTE FUNCTION public.guard_cycle_action_opportunity();

CREATE OR REPLACE FUNCTION public.guard_planned_article_cycle_action()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF NEW.cycle_action_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.cycle_actions action_row
        WHERE action_row.id = NEW.cycle_action_id
          AND action_row.user_id = NEW.user_id
          AND action_row.brand_id = NEW.brand_id
    ) THEN
        RAISE EXCEPTION 'Planned output must belong to the selected action brand';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_planned_article_cycle_action_trigger ON public.planned_articles;
CREATE TRIGGER guard_planned_article_cycle_action_trigger
    BEFORE INSERT OR UPDATE OF cycle_action_id, user_id, brand_id
    ON public.planned_articles
    FOR EACH ROW EXECUTE FUNCTION public.guard_planned_article_cycle_action();

-- ---------------------------------------------------------------------------
-- Customers can inspect their recurring state. Mutations remain server-owned
-- until the Phase 4 reconciliation and Phase 5 target-page APIs land.
-- ---------------------------------------------------------------------------

ALTER TABLE public.content_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_action_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own content opportunities" ON public.content_opportunities;
CREATE POLICY "Users can read own content opportunities"
    ON public.content_opportunities FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own subscription cycles" ON public.subscription_cycles;
CREATE POLICY "Users can read own subscription cycles"
    ON public.subscription_cycles FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own cycle actions" ON public.cycle_actions;
CREATE POLICY "Users can read own cycle actions"
    ON public.cycle_actions FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own cycle action opportunities" ON public.cycle_action_opportunities;
CREATE POLICY "Users can read own cycle action opportunities"
    ON public.cycle_action_opportunities FOR SELECT
    USING (auth.uid() = user_id);

    COMMENT ON TABLE public.content_opportunities IS
    'One durable finding per tracked buyer question; reopens instead of duplicating across measurement runs.';
    COMMENT ON TABLE public.subscription_cycles IS
    'One recurring delivery cycle per paid program billing period.';
    COMMENT ON TABLE public.cycle_actions IS
    'At most eight create or refresh units selected for one subscription cycle.';
    COMMENT ON TABLE public.cycle_action_opportunities IS
    'Maps one selected production action to every measured opportunity it honestly resolves.';
    COMMENT ON COLUMN public.planned_articles.cycle_action_id IS
    'Single authoritative link from a generated output to its selected recurring-cycle action.';

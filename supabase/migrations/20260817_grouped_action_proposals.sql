-- Site-aware grouped action planning. A measured absence is not an article
-- until it survives inventory matching and grouped customer confirmation.

CREATE TABLE IF NOT EXISTS public.site_inventory_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed')),
    sitemap_url_count INTEGER NOT NULL DEFAULT 0 CHECK (sitemap_url_count >= 0),
    page_count INTEGER NOT NULL DEFAULT 0 CHECK (page_count >= 0),
    truncated BOOLEAN NOT NULL DEFAULT FALSE,
    failure_code TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT site_inventory_runs_completion_check CHECK (
        (status = 'running' AND completed_at IS NULL)
        OR (status IN ('completed', 'failed') AND completed_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS site_inventory_runs_one_running_brand
    ON public.site_inventory_runs(brand_id)
    WHERE status = 'running';
CREATE INDEX IF NOT EXISTS site_inventory_runs_brand_created_idx
    ON public.site_inventory_runs(brand_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.site_inventory_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    inventory_run_id UUID NOT NULL REFERENCES public.site_inventory_runs(id) ON DELETE CASCADE,
    canonical_url TEXT NOT NULL CHECK (canonical_url ~* '^https://[^[:space:]]+$'),
    title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
    title_source TEXT NOT NULL CHECK (
        title_source IN ('html_title', 'og_title', 'meta_title', 'h1', 'url_slug')
    ),
    page_kind TEXT NOT NULL CHECK (
        page_kind IN ('home', 'blog', 'product', 'feature', 'comparison', 'docs', 'other')
    ),
    content_excerpt TEXT,
    content_hash TEXT,
    fetch_status TEXT NOT NULL DEFAULT 'discovered'
        CHECK (fetch_status IN ('discovered', 'fetched', 'failed')),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Inventory is an immutable per-run snapshot. Reusing one row per brand URL
    -- would silently rewrite the evidence behind an older confirmed proposal.
    CONSTRAINT site_inventory_pages_run_url_key UNIQUE (inventory_run_id, canonical_url)
);

CREATE INDEX IF NOT EXISTS site_inventory_pages_brand_kind_idx
    ON public.site_inventory_pages(brand_id, page_kind, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS site_inventory_pages_inventory_idx
    ON public.site_inventory_pages(inventory_run_id);

ALTER TABLE public.tracked_prompts
    ADD COLUMN IF NOT EXISTS intent_binding JSONB;

DO $$
BEGIN
    IF to_regprocedure('public.confirm_tracked_prompts_v1(uuid,jsonb)') IS NULL
       AND to_regprocedure('public.confirm_tracked_prompts(uuid,jsonb)') IS NOT NULL
    THEN
        ALTER FUNCTION public.confirm_tracked_prompts(UUID, JSONB)
            RENAME TO confirm_tracked_prompts_v1;
    END IF;
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

        UPDATE public.tracked_prompts
        SET intent_binding = v_binding,
            updated_at = now()
        WHERE id = v_tracked.id;
    END LOOP;
    RETURN v_count;
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

CREATE TABLE IF NOT EXISTS public.action_proposal_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    cycle_id UUID NOT NULL REFERENCES public.subscription_cycles(id) ON DELETE RESTRICT,
    measurement_run_id UUID NOT NULL REFERENCES public.ai_probe_runs(id) ON DELETE RESTRICT,
    inventory_run_id UUID NOT NULL REFERENCES public.site_inventory_runs(id) ON DELETE RESTRICT,
    state TEXT NOT NULL DEFAULT 'draft'
        CHECK (state IN ('draft', 'review', 'confirmed', 'superseded', 'failed')),
    policy_version TEXT NOT NULL DEFAULT 'site-aware-actions-v1',
    failure_code TEXT,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT action_proposal_sets_cycle_run_key UNIQUE (cycle_id, measurement_run_id),
    CONSTRAINT action_proposal_sets_confirmed_check CHECK (
        (state = 'confirmed') = (confirmed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS action_proposal_sets_brand_created_idx
    ON public.action_proposal_sets(brand_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.action_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    proposal_set_id UUID NOT NULL REFERENCES public.action_proposal_sets(id) ON DELETE CASCADE,
    resolution_type TEXT NOT NULL CHECK (
        resolution_type IN ('create', 'refresh', 'report_only')
    ),
    deliverable_type TEXT NOT NULL CHECK (
        deliverable_type IN ('full_article', 'full_page_replacement', 'section_patch', 'report_only')
    ),
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 8 AND 240),
    normalized_title TEXT NOT NULL CHECK (length(btrim(normalized_title)) > 0),
    dedupe_key TEXT NOT NULL CHECK (length(btrim(dedupe_key)) > 0),
    target_url TEXT CHECK (target_url IS NULL OR target_url ~* '^https://[^[:space:]]+$'),
    target_page_kind TEXT CHECK (
        target_page_kind IS NULL OR target_page_kind IN (
            'home', 'blog', 'product', 'feature', 'comparison', 'docs', 'other'
        )
    ),
    status TEXT NOT NULL DEFAULT 'suggested'
        CHECK (status IN ('suggested', 'confirmed', 'rejected')),
    priority INTEGER NOT NULL CHECK (priority BETWEEN 0 AND 100),
    reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
    intent_binding JSONB,
    evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT action_proposals_set_dedupe_key UNIQUE (proposal_set_id, dedupe_key),
    CONSTRAINT action_proposals_resolution_target_check CHECK (
        (resolution_type = 'refresh' AND target_url IS NOT NULL)
        OR (resolution_type IN ('create', 'report_only') AND target_url IS NULL)
    ),
    CONSTRAINT action_proposals_deliverable_check CHECK (
        (resolution_type = 'create' AND deliverable_type = 'full_article')
        OR (resolution_type = 'refresh' AND deliverable_type IN ('full_page_replacement', 'section_patch'))
        OR (resolution_type = 'report_only' AND deliverable_type = 'report_only')
    )
);

CREATE INDEX IF NOT EXISTS action_proposals_set_priority_idx
    ON public.action_proposals(proposal_set_id, priority DESC, created_at);

CREATE TABLE IF NOT EXISTS public.action_proposal_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    proposal_set_id UUID NOT NULL REFERENCES public.action_proposal_sets(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.action_proposals(id) ON DELETE CASCADE,
    tracked_prompt_id UUID NOT NULL REFERENCES public.tracked_prompts(id) ON DELETE RESTRICT,
    opportunity_id UUID NOT NULL REFERENCES public.content_opportunities(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT action_proposal_prompts_set_prompt_key UNIQUE (
        proposal_set_id, tracked_prompt_id
    ),
    CONSTRAINT action_proposal_prompts_proposal_opportunity_key UNIQUE (
        proposal_id, opportunity_id
    )
);

CREATE INDEX IF NOT EXISTS action_proposal_prompts_proposal_idx
    ON public.action_proposal_prompts(proposal_id);

-- Cover ownership/cascade foreign keys as well as the normal read paths. These
-- tables are small at launch, but monthly immutable inventories are cumulative.
CREATE INDEX IF NOT EXISTS site_inventory_runs_user_idx
    ON public.site_inventory_runs(user_id);
CREATE INDEX IF NOT EXISTS site_inventory_pages_user_idx
    ON public.site_inventory_pages(user_id);
CREATE INDEX IF NOT EXISTS action_proposal_sets_user_idx
    ON public.action_proposal_sets(user_id);
CREATE INDEX IF NOT EXISTS action_proposal_sets_measurement_idx
    ON public.action_proposal_sets(measurement_run_id);
CREATE INDEX IF NOT EXISTS action_proposal_sets_inventory_idx
    ON public.action_proposal_sets(inventory_run_id);
CREATE INDEX IF NOT EXISTS action_proposals_user_idx
    ON public.action_proposals(user_id);
CREATE INDEX IF NOT EXISTS action_proposals_brand_idx
    ON public.action_proposals(brand_id);
CREATE INDEX IF NOT EXISTS action_proposal_prompts_user_idx
    ON public.action_proposal_prompts(user_id);
CREATE INDEX IF NOT EXISTS action_proposal_prompts_brand_idx
    ON public.action_proposal_prompts(brand_id);
CREATE INDEX IF NOT EXISTS action_proposal_prompts_tracked_idx
    ON public.action_proposal_prompts(tracked_prompt_id);
CREATE INDEX IF NOT EXISTS action_proposal_prompts_opportunity_idx
    ON public.action_proposal_prompts(opportunity_id);

-- Service-role writers still get database-enforced tenant consistency. RLS is
-- a read boundary, not protection against an application bug joining two users.
CREATE OR REPLACE FUNCTION public.guard_action_proposal_ownership()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF TG_TABLE_NAME = 'site_inventory_runs' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.brand_details brand
            WHERE brand.id = NEW.brand_id AND brand.user_id = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'Site inventory owner does not own the brand';
        END IF;
    ELSIF TG_TABLE_NAME = 'site_inventory_pages' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.site_inventory_runs inventory
            WHERE inventory.id = NEW.inventory_run_id
              AND inventory.user_id = NEW.user_id
              AND inventory.brand_id = NEW.brand_id
        ) THEN
            RAISE EXCEPTION 'Inventory page does not belong to its inventory run';
        END IF;
    ELSIF TG_TABLE_NAME = 'action_proposal_sets' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.subscription_cycles cycle_row
            JOIN public.ai_probe_runs run_row
              ON run_row.id = NEW.measurement_run_id
             AND run_row.user_id = cycle_row.user_id
             AND run_row.brand_id = cycle_row.brand_id
             AND run_row.status = 'completed'
            JOIN public.site_inventory_runs inventory
              ON inventory.id = NEW.inventory_run_id
             AND inventory.user_id = cycle_row.user_id
             AND inventory.brand_id = cycle_row.brand_id
             AND inventory.status = 'completed'
            WHERE cycle_row.id = NEW.cycle_id
              AND cycle_row.user_id = NEW.user_id
              AND cycle_row.brand_id = NEW.brand_id
              AND cycle_row.measurement_run_id = NEW.measurement_run_id
        ) THEN
            RAISE EXCEPTION 'Proposal set crosses a cycle, run, inventory, or owner boundary';
        END IF;
    ELSIF TG_TABLE_NAME = 'action_proposals' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.action_proposal_sets proposal_set
            WHERE proposal_set.id = NEW.proposal_set_id
              AND proposal_set.user_id = NEW.user_id
              AND proposal_set.brand_id = NEW.brand_id
        ) THEN
            RAISE EXCEPTION 'Action proposal does not belong to its proposal set';
        END IF;
    ELSIF TG_TABLE_NAME = 'action_proposal_prompts' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.action_proposals proposal
            JOIN public.tracked_prompts tracked
              ON tracked.id = NEW.tracked_prompt_id
             AND tracked.user_id = proposal.user_id
             AND tracked.brand_id = proposal.brand_id
            JOIN public.content_opportunities opportunity
              ON opportunity.id = NEW.opportunity_id
             AND opportunity.user_id = proposal.user_id
             AND opportunity.brand_id = proposal.brand_id
             AND opportunity.tracked_prompt_id = tracked.id
            WHERE proposal.id = NEW.proposal_id
              AND proposal.proposal_set_id = NEW.proposal_set_id
              AND proposal.user_id = NEW.user_id
              AND proposal.brand_id = NEW.brand_id
        ) THEN
            RAISE EXCEPTION 'Proposal prompt crosses a proposal, question, opportunity, or owner boundary';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_site_inventory_runs_ownership ON public.site_inventory_runs;
CREATE TRIGGER guard_site_inventory_runs_ownership
    BEFORE INSERT OR UPDATE ON public.site_inventory_runs
    FOR EACH ROW EXECUTE FUNCTION public.guard_action_proposal_ownership();
DROP TRIGGER IF EXISTS guard_site_inventory_pages_ownership ON public.site_inventory_pages;
CREATE TRIGGER guard_site_inventory_pages_ownership
    BEFORE INSERT OR UPDATE ON public.site_inventory_pages
    FOR EACH ROW EXECUTE FUNCTION public.guard_action_proposal_ownership();
DROP TRIGGER IF EXISTS guard_action_proposal_sets_ownership ON public.action_proposal_sets;
CREATE TRIGGER guard_action_proposal_sets_ownership
    BEFORE INSERT OR UPDATE ON public.action_proposal_sets
    FOR EACH ROW EXECUTE FUNCTION public.guard_action_proposal_ownership();
DROP TRIGGER IF EXISTS guard_action_proposals_ownership ON public.action_proposals;
CREATE TRIGGER guard_action_proposals_ownership
    BEFORE INSERT OR UPDATE ON public.action_proposals
    FOR EACH ROW EXECUTE FUNCTION public.guard_action_proposal_ownership();
DROP TRIGGER IF EXISTS guard_action_proposal_prompts_ownership ON public.action_proposal_prompts;
CREATE TRIGGER guard_action_proposal_prompts_ownership
    BEFORE INSERT OR UPDATE ON public.action_proposal_prompts
    FOR EACH ROW EXECUTE FUNCTION public.guard_action_proposal_ownership();

REVOKE ALL ON FUNCTION public.guard_action_proposal_ownership() FROM PUBLIC;

ALTER TABLE public.cycle_actions
    ADD COLUMN IF NOT EXISTS proposal_id UUID
        REFERENCES public.action_proposals(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS cycle_actions_proposal_key
    ON public.cycle_actions(proposal_id)
    WHERE proposal_id IS NOT NULL;

ALTER TABLE public.site_inventory_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_inventory_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_proposal_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_proposal_prompts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own site inventory runs" ON public.site_inventory_runs;
CREATE POLICY "Users read own site inventory runs"
    ON public.site_inventory_runs FOR SELECT USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users read own site inventory pages" ON public.site_inventory_pages;
CREATE POLICY "Users read own site inventory pages"
    ON public.site_inventory_pages FOR SELECT USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users read own action proposal sets" ON public.action_proposal_sets;
CREATE POLICY "Users read own action proposal sets"
    ON public.action_proposal_sets FOR SELECT USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users read own action proposals" ON public.action_proposals;
CREATE POLICY "Users read own action proposals"
    ON public.action_proposals FOR SELECT USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users read own action proposal prompts" ON public.action_proposal_prompts;
CREATE POLICY "Users read own action proposal prompts"
    ON public.action_proposal_prompts FOR SELECT USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.site_inventory_runs FROM anon, authenticated;
REVOKE ALL ON public.site_inventory_pages FROM anon, authenticated;
REVOKE ALL ON public.action_proposal_sets FROM anon, authenticated;
REVOKE ALL ON public.action_proposals FROM anon, authenticated;
REVOKE ALL ON public.action_proposal_prompts FROM anon, authenticated;
GRANT SELECT ON public.site_inventory_runs TO authenticated;
GRANT SELECT ON public.site_inventory_pages TO authenticated;
GRANT SELECT ON public.action_proposal_sets TO authenticated;
GRANT SELECT ON public.action_proposals TO authenticated;
GRANT SELECT ON public.action_proposal_prompts TO authenticated;
GRANT ALL ON public.site_inventory_runs TO service_role;
GRANT ALL ON public.site_inventory_pages TO service_role;
GRANT ALL ON public.action_proposal_sets TO service_role;
GRANT ALL ON public.action_proposals TO service_role;
GRANT ALL ON public.action_proposal_prompts TO service_role;

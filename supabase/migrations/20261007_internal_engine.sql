-- ============================================================================
-- Internal SEO engine (2026-10-07)
--
-- FlipAEO stopped being a paid product. It now runs as the owner's internal
-- AI-search engine across several of their own SaaS tools:
--
--   Monday 08:30 GMT → ask each tool's tracked buyer questions (existing probe)
--   → findings (gap = not mentioned by any engine that answered)
--   → full inventory of the tool's WordPress posts/pages + site sitemaps
--   → triage each gap into create / refresh / monitor / page_suggestion
--   → duplicate guard → production → owner review.
--
-- These tables sit beside the subscription machinery (programs, cycles,
-- proposals), which is left untouched and simply unused in internal mode. No
-- payment, allowance or batch-delivery rule applies here: a week's work is
-- exactly its verified gaps.
--
-- Replay-safe: every statement survives a second run.
-- ============================================================================

-- One settings row per tool (brand).
CREATE TABLE IF NOT EXISTS public.engine_brand_settings (
    brand_id UUID PRIMARY KEY REFERENCES public.brand_details(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    -- Every host the tool owns (site, blog subdomain, app). A citation of any
    -- of them counts as the tool being cited.
    owned_hosts TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    -- Other names the tool goes by in answers ("BringBack", "Bring Back").
    aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    wordpress_connection_id UUID REFERENCES public.wordpress_connections(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per tool per week. `week_start` is the Monday (UTC) the run belongs to.
CREATE TABLE IF NOT EXISTS public.engine_weeks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    probe_run_id UUID REFERENCES public.ai_probe_runs(id) ON DELETE SET NULL,
    state TEXT NOT NULL DEFAULT 'measuring'
        CHECK (state IN ('measuring', 'analysing', 'producing', 'ready', 'partial', 'failed')),
    trigger_source TEXT NOT NULL DEFAULT 'schedule'
        CHECK (trigger_source IN ('schedule', 'manual')),
    stats JSONB NOT NULL DEFAULT '{}'::JSONB,
    failure_reason TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    analysed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS engine_weeks_brand_week_key
    ON public.engine_weeks(brand_id, week_start);
CREATE INDEX IF NOT EXISTS engine_weeks_probe_run_idx
    ON public.engine_weeks(probe_run_id);

-- One row per tracked question per week: the counted facts the work is based on.
CREATE TABLE IF NOT EXISTS public.engine_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id UUID NOT NULL REFERENCES public.engine_weeks(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tracked_prompt_id UUID NOT NULL REFERENCES public.tracked_prompts(id) ON DELETE CASCADE,
    probe_prompt_id UUID REFERENCES public.ai_probe_prompts(id) ON DELETE SET NULL,
    prompt TEXT NOT NULL,
    -- gap: not mentioned by any engine, and every engine answered
    -- partial: mentioned by some engines only
    -- outranked: mentioned everywhere, never first
    -- won: named first at least once and mentioned everywhere
    -- insufficient: not mentioned, but an engine failed to answer
    state TEXT NOT NULL
        CHECK (state IN ('gap', 'partial', 'outranked', 'won', 'insufficient')),
    confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    engines_expected INTEGER NOT NULL,
    engines_answered INTEGER NOT NULL,
    engines_mentioning INTEGER NOT NULL,
    engines_citing INTEGER NOT NULL,
    per_engine JSONB NOT NULL DEFAULT '[]'::JSONB,
    cited_rival_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS engine_findings_week_prompt_key
    ON public.engine_findings(week_id, tracked_prompt_id);
CREATE INDEX IF NOT EXISTS engine_findings_brand_prompt_idx
    ON public.engine_findings(brand_id, tracked_prompt_id, created_at DESC);

-- Everything the tool has already published or drafted.
CREATE TABLE IF NOT EXISTS public.engine_inventory_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    canonical_url TEXT NOT NULL,
    -- wordpress: from the WordPress REST API (complete, includes drafts)
    -- sitemap: a site page found only in a sitemap (e.g. a Next.js page)
    -- app_article: written by this app, not yet in WordPress
    source TEXT NOT NULL CHECK (source IN ('wordpress', 'sitemap', 'app_article')),
    wp_object_type TEXT,
    wp_object_id BIGINT,
    wp_status TEXT,
    article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    content_text TEXT NOT NULL DEFAULT '',
    content_hash TEXT,
    embedding REAL[],
    embedded_hash TEXT,
    modified_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    gone_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS engine_inventory_pages_brand_url_key
    ON public.engine_inventory_pages(brand_id, canonical_url);

-- One unit of work (or a deliberate non-action) per gap cluster.
CREATE TABLE IF NOT EXISTS public.engine_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id UUID NOT NULL REFERENCES public.engine_weeks(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brand_details(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL
        CHECK (kind IN ('create', 'refresh', 'monitor', 'page_suggestion')),
    state TEXT NOT NULL DEFAULT 'planned'
        CHECK (state IN (
            'planned', 'producing', 'ready', 'failed', 'blocked_duplicate',
            'pushed', 'done', 'dismissed'
        )),
    title TEXT NOT NULL,
    reason TEXT NOT NULL,
    tracked_prompt_ids UUID[] NOT NULL,
    prompts TEXT[] NOT NULL,
    target_url TEXT,
    inventory_page_id UUID REFERENCES public.engine_inventory_pages(id) ON DELETE SET NULL,
    -- Quoted passages, cited rival pages, missing items with sources.
    evidence JSONB NOT NULL DEFAULT '{}'::JSONB,
    duplicate_check JSONB,
    -- create: the article id. refresh: original + updated content and the
    -- change list. page_suggestion: the suggestion list.
    article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
    output JSONB,
    attempts INTEGER NOT NULL DEFAULT 0,
    failure_reason TEXT,
    wordpress_post_id BIGINT,
    wordpress_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS engine_actions_week_idx ON public.engine_actions(week_id);
CREATE INDEX IF NOT EXISTS engine_actions_brand_state_idx ON public.engine_actions(brand_id, state);

-- A WordPress connection now belongs to one tool.
ALTER TABLE public.wordpress_connections
    ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brand_details(id) ON DELETE SET NULL;

-- Owner read access; every write goes through the service role.
ALTER TABLE public.engine_brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_inventory_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engine_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads engine settings" ON public.engine_brand_settings;
CREATE POLICY "Owner reads engine settings" ON public.engine_brand_settings
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Owner reads engine weeks" ON public.engine_weeks;
CREATE POLICY "Owner reads engine weeks" ON public.engine_weeks
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Owner reads engine findings" ON public.engine_findings;
CREATE POLICY "Owner reads engine findings" ON public.engine_findings
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Owner reads engine inventory" ON public.engine_inventory_pages;
CREATE POLICY "Owner reads engine inventory" ON public.engine_inventory_pages
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Owner reads engine actions" ON public.engine_actions;
CREATE POLICY "Owner reads engine actions" ON public.engine_actions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

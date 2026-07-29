-- ============================================================================
-- Closed-Pool Harvest Architecture
-- ============================================================================
-- Replaces the LLM-invented "niche blueprint" with an observed, sourced query
-- universe. Every row in query_pool carries the URL where the query was
-- actually seen, which is what makes the audit falsifiable.
--
-- Pipeline: harvest -> query_pool -> coverage -> gaps -> article units
--           -> audit_clusters -> planned_articles -> programs (burn-down)
-- ============================================================================


-- ----------------------------------------------------------------------------
-- query_pool: the finite, observed universe of real search queries
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS query_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brand_details(id) ON DELETE CASCADE,

    -- The query as observed, plus a normalized form for dedup
    query TEXT NOT NULL,
    query_norm TEXT NOT NULL,

    -- PROVENANCE — the whole point of this table.
    --
    -- source_url is always populated and always re-openable:
    --   paa / competitor_sitemap -> the page whose visible text contains it
    --   autocomplete             -> the exact Google Suggest request URL
    --
    -- NOT NULL is deliberate. The first run of this pipeline allowed nulls for
    -- autocomplete rows and 86% of resulting gaps were unverifiable.
    source TEXT NOT NULL CHECK (source IN ('autocomplete', 'paa', 'competitor_sitemap')),
    source_url TEXT NOT NULL,
    source_seed TEXT,

    -- Immutable evidence: the raw string the source returned, and when.
    -- Autocomplete responses drift, so re-opening source_url later may not
    -- reproduce this exact string — observed_value is what was actually seen.
    observed_value TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    embedding vector(768),

    -- Coverage state, recomputed on each audit run
    status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (status IN ('unknown', 'covered', 'partial', 'gap')),
    covered_by_url TEXT,
    covered_by_title TEXT,
    coverage_similarity REAL,

    -- Which competitors own this query (array of {name, url, similarity})
    competitor_matches JSONB NOT NULL DEFAULT '[]',

    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Re-harvesting is an upsert: same query for same brand updates last_seen_at
    UNIQUE (brand_id, query_norm)
);

CREATE INDEX IF NOT EXISTS idx_query_pool_brand ON query_pool(brand_id);
CREATE INDEX IF NOT EXISTS idx_query_pool_brand_status ON query_pool(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_query_pool_embedding ON query_pool
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


-- ----------------------------------------------------------------------------
-- audit_clusters: thematic groups of article units
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brand_details(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT,

    -- Lower number = higher priority. Drives which clusters land in the
    -- recommended program vs. which are shown greyed out.
    priority INTEGER NOT NULL DEFAULT 100,
    article_count INTEGER NOT NULL DEFAULT 0,

    -- Distinct competitor URLs owning queries in this cluster — the evidence
    -- layer shown on the audit screen.
    competitor_urls JSONB NOT NULL DEFAULT '[]',

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_clusters_brand ON audit_clusters(brand_id, priority);


-- ----------------------------------------------------------------------------
-- planned_articles: one row per article unit (collapsed from N queries)
-- ----------------------------------------------------------------------------
-- Normalized rows rather than a JSONB blob so the burn-down can be queried
-- directly and clusters can be shipped as batches.
CREATE TABLE IF NOT EXISTS planned_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brand_details(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES audit_clusters(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    main_keyword TEXT NOT NULL,
    supporting_keywords TEXT[] NOT NULL DEFAULT '{}',

    -- Traceability back to the harvested rows this article was collapsed from
    source_query_ids UUID[] NOT NULL DEFAULT '{}',

    article_type TEXT NOT NULL DEFAULT 'informational'
        CHECK (article_type IN ('informational', 'commercial', 'howto')),
    intent_role TEXT,

    -- Position within the cluster; the pillar is the hub every leaf links back to
    is_pillar BOOLEAN NOT NULL DEFAULT FALSE,

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'scheduled', 'writing', 'published', 'failed', 'skipped')),
    scheduled_date DATE,
    shipped_at TIMESTAMPTZ,

    -- Set once the writing engine produces the actual article
    article_id UUID REFERENCES articles(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planned_articles_brand ON planned_articles(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_planned_articles_cluster ON planned_articles(cluster_id);
CREATE INDEX IF NOT EXISTS idx_planned_articles_scheduled ON planned_articles(scheduled_date)
    WHERE status IN ('pending', 'scheduled');


-- ----------------------------------------------------------------------------
-- programs: the sold scope and its burn-down state
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brand_details(id) ON DELETE CASCADE,

    -- Velocity is what's sold: clusters shipped per month
    tier TEXT NOT NULL DEFAULT 'close' CHECK (tier IN ('close', 'accelerate', 'dominate')),
    clusters_per_month INTEGER NOT NULL DEFAULT 1,

    -- The prioritized subset actually committed to (not the whole map)
    clusters_included UUID[] NOT NULL DEFAULT '{}',
    total_articles INTEGER NOT NULL DEFAULT 0,
    completed_count INTEGER NOT NULL DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programs_brand ON programs(brand_id, status);

-- A brand may accumulate many completed programs, but only one active at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_one_active_per_brand
    ON programs(brand_id) WHERE status = 'active';


-- ----------------------------------------------------------------------------
-- topical_audits: add the real scope numbers.
--
-- The fabricated columns (niche_blueprint, projected_score, gap_matrix,
-- pillar_suggestions, pillar_scores) are NOT dropped here. Nothing writes them
-- any more — run-audit.ts stopped as of this migration — but actions/audit.ts
-- and components/audit/audit-results.tsx still read them. Stop-writing-then-drop
-- keeps this migration safe to run against a live deployment; the drop lands
-- with the audit UI rewrite.
-- ----------------------------------------------------------------------------
COMMENT ON COLUMN topical_audits.niche_blueprint IS
    'DEPRECATED: LLM-invented topic map. No longer written. Drop with the audit UI rewrite.';
COMMENT ON COLUMN topical_audits.projected_score IS
    'DEPRECATED: simulated post-plan score. No longer written. Drop with the audit UI rewrite.';

ALTER TABLE topical_audits ADD COLUMN IF NOT EXISTS pool_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE topical_audits ADD COLUMN IF NOT EXISTS article_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE topical_audits ADD COLUMN IF NOT EXISTS cluster_count INTEGER NOT NULL DEFAULT 0;

-- Token for the public, un-authenticated shareable audit page
ALTER TABLE topical_audits ADD COLUMN IF NOT EXISTS public_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_topical_audits_public_token
    ON topical_audits(public_token) WHERE public_token IS NOT NULL;


-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE query_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE planned_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['query_pool', 'audit_clusters', 'planned_articles', 'programs']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Users manage own %1$s" ON %1$s', t);
        EXECUTE format(
            'CREATE POLICY "Users manage own %1$s" ON %1$s FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
            t
        );

        EXECUTE format('DROP POLICY IF EXISTS "Service role full access %1$s" ON %1$s', t);
        EXECUTE format(
            'CREATE POLICY "Service role full access %1$s" ON %1$s FOR ALL USING (auth.role() = ''service_role'')',
            t
        );
    END LOOP;
END $$;


-- ----------------------------------------------------------------------------
-- match_query_pool: find pool entries similar to a given embedding.
-- Mirrors match_articles / match_internal_links.
-- Used by the clusterer and by intra-batch dedup.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_query_pool (
    query_embedding vector(768),
    match_threshold float,
    match_count int,
    p_brand_id uuid
)
RETURNS TABLE (
    id uuid,
    query text,
    source_url text,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        query_pool.id,
        query_pool.query,
        query_pool.source_url,
        1 - (query_pool.embedding <=> query_embedding) AS similarity
    FROM query_pool
    WHERE
        query_pool.embedding IS NOT NULL
        AND query_pool.brand_id = p_brand_id
        AND 1 - (query_pool.embedding <=> query_embedding) > match_threshold
    ORDER BY query_pool.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

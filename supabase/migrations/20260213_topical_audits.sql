-- Topical Authority Audit table
-- Stores audit results for brands, tracking topical authority scores,
-- gap analysis, and pillar suggestions.

CREATE TABLE IF NOT EXISTS topical_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brand_details(id) ON DELETE CASCADE,
    
    -- Core audit data (stored as JSONB for flexibility)
    niche_blueprint JSONB NOT NULL DEFAULT '{}',
    user_coverage JSONB NOT NULL DEFAULT '{}',
    competitor_coverages JSONB NOT NULL DEFAULT '[]',
    
    -- Scores
    authority_score INTEGER NOT NULL DEFAULT 0,
    pillar_scores JSONB NOT NULL DEFAULT '[]',
    projected_score INTEGER NOT NULL DEFAULT 0,
    
    -- Gap analysis
    gap_matrix JSONB NOT NULL DEFAULT '[]',
    pillar_suggestions JSONB NOT NULL DEFAULT '[]',
    
    -- Metadata
    competitors_scanned INTEGER NOT NULL DEFAULT 0,
    topics_analyzed INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- One audit per user per brand (upsert support)
    UNIQUE(user_id, brand_id)
);

-- Enable RLS
ALTER TABLE topical_audits ENABLE ROW LEVEL SECURITY;

-- Users can only see their own audits
CREATE POLICY "Users can view own audits"
    ON topical_audits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own audits"
    ON topical_audits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own audits"
    ON topical_audits FOR UPDATE
    USING (auth.uid() = user_id);

-- Service role bypass for API routes
CREATE POLICY "Service role full access"
    ON topical_audits FOR ALL
    USING (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX idx_topical_audits_user_brand 
    ON topical_audits(user_id, brand_id);

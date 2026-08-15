-- SEO Metrics table (Single-Row Architecture)
-- One row per user+domain with both mobile and desktop PageSpeed data
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS seo_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_details(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  
  -- Moz Metrics (shared across devices)
  domain_authority INTEGER,
  page_authority INTEGER,
  linking_root_domains INTEGER,
  external_links INTEGER,
  
  -- Desktop PageSpeed Scores (0-100)
  performance_desktop INTEGER,
  accessibility_desktop INTEGER,
  best_practices_desktop INTEGER,
  seo_desktop INTEGER,
  
  -- Desktop Core Web Vitals
  lcp_desktop NUMERIC,
  cls_desktop NUMERIC,
  tbt_desktop INTEGER,
  fcp_desktop NUMERIC,
  recommendations_desktop JSONB DEFAULT '[]',
  
  -- Mobile PageSpeed Scores (0-100)
  performance_mobile INTEGER,
  accessibility_mobile INTEGER,
  best_practices_mobile INTEGER,
  seo_mobile INTEGER,
  
  -- Mobile Core Web Vitals
  lcp_mobile NUMERIC,
  cls_mobile NUMERIC,
  tbt_mobile INTEGER,
  fcp_mobile NUMERIC,
  recommendations_mobile JSONB DEFAULT '[]',
  
  -- Metadata
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seo_metrics_user ON seo_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_metrics_brand ON seo_metrics(brand_id);
CREATE INDEX IF NOT EXISTS idx_seo_metrics_domain ON seo_metrics(domain);

-- Unique constraint: one row per user+domain
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_metrics_unique 
ON seo_metrics(user_id, domain);

-- RLS Policies
ALTER TABLE seo_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own metrics" ON seo_metrics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own metrics" ON seo_metrics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics" ON seo_metrics
  FOR UPDATE USING (auth.uid() = user_id);

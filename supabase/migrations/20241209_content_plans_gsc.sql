-- Content Plans table
-- Stores the 30-day content plan for each user/brand
CREATE TABLE content_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brand_details(id) ON DELETE SET NULL,
  plan_data JSONB NOT NULL, -- Array of ContentPlanItem
  competitor_seeds JSONB, -- Seeds used to generate plan
  gsc_enhanced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_plans_user ON content_plans(user_id);
CREATE INDEX idx_content_plans_brand ON content_plans(brand_id);

-- GSC Connections table
-- Stores OAuth tokens for Google Search Console (encrypted)
CREATE TABLE gsc_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  site_url TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE content_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE gsc_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for content_plans
CREATE POLICY "Users can view their own content plans"
  ON content_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own content plans"
  ON content_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content plans"
  ON content_plans FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content plans"
  ON content_plans FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for gsc_connections
CREATE POLICY "Users can view their own GSC connections"
  ON gsc_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own GSC connections"
  ON gsc_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own GSC connections"
  ON gsc_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own GSC connections"
  ON gsc_connections FOR DELETE
  USING (auth.uid() = user_id);

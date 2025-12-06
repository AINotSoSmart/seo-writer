-- Webflow CMS Integration Tables
-- Run this migration to add Webflow publishing support

-- 1. Create webflow_connections table
CREATE TABLE IF NOT EXISTS webflow_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  site_name TEXT,                   -- Display name for the site
  api_token TEXT NOT NULL,          -- Webflow API token (store encrypted in production)
  site_id TEXT NOT NULL,            -- Webflow site ID
  collection_id TEXT NOT NULL,      -- CMS collection ID for blog posts
  field_mapping JSONB DEFAULT '{"title": "name", "content": "post-body", "slug": "slug", "excerpt": "post-summary"}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_webflow_connections_user ON webflow_connections(user_id);

-- 2. Add Webflow publishing fields to articles table
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS webflow_item_id TEXT,
ADD COLUMN IF NOT EXISTS webflow_item_url TEXT,
ADD COLUMN IF NOT EXISTS webflow_site_id UUID REFERENCES webflow_connections(id);

-- 3. Enable RLS
ALTER TABLE webflow_connections ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for webflow_connections
DROP POLICY IF EXISTS "Users can view own webflow connections" ON webflow_connections;
CREATE POLICY "Users can view own webflow connections"
  ON webflow_connections FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own webflow connections" ON webflow_connections;
CREATE POLICY "Users can insert own webflow connections"
  ON webflow_connections FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own webflow connections" ON webflow_connections;
CREATE POLICY "Users can update own webflow connections"
  ON webflow_connections FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own webflow connections" ON webflow_connections;
CREATE POLICY "Users can delete own webflow connections"
  ON webflow_connections FOR DELETE USING (auth.uid() = user_id);

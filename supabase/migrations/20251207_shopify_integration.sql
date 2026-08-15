-- Shopify Blog Integration Tables
-- Run this migration to add Shopify blog publishing support

-- 1. Create shopify_connections table
CREATE TABLE IF NOT EXISTS shopify_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_name TEXT NOT NULL,             -- e.g., "My Store"
  store_domain TEXT NOT NULL,           -- e.g., mystore.myshopify.com
  access_token TEXT NOT NULL,           -- Admin API access token
  blog_id TEXT NOT NULL,                -- Selected blog ID
  blog_title TEXT,                      -- Blog title for display
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_shopify_connections_user ON shopify_connections(user_id);

-- 2. Add Shopify publishing fields to articles table
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS shopify_article_id TEXT,
ADD COLUMN IF NOT EXISTS shopify_article_url TEXT,
ADD COLUMN IF NOT EXISTS shopify_connection_id UUID REFERENCES shopify_connections(id);

-- 3. Enable RLS
ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for shopify_connections
DROP POLICY IF EXISTS "Users can view own shopify connections" ON shopify_connections;
CREATE POLICY "Users can view own shopify connections"
  ON shopify_connections FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own shopify connections" ON shopify_connections;
CREATE POLICY "Users can insert own shopify connections"
  ON shopify_connections FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own shopify connections" ON shopify_connections;
CREATE POLICY "Users can update own shopify connections"
  ON shopify_connections FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own shopify connections" ON shopify_connections;
CREATE POLICY "Users can delete own shopify connections"
  ON shopify_connections FOR DELETE USING (auth.uid() = user_id);

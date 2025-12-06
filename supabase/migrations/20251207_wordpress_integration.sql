-- WordPress Integration Tables
-- Run this migration to add wordpress publishing support

-- 1. Create wordpress_connections table
CREATE TABLE IF NOT EXISTS wordpress_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  site_url TEXT NOT NULL,           -- e.g., https://myblog.com
  site_name TEXT,                   -- Friendly name for the site
  username TEXT NOT NULL,           -- WordPress username
  app_password TEXT NOT NULL,       -- Application password (store encrypted in production)
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_wordpress_connections_user ON wordpress_connections(user_id);

-- 2. Add publishing fields to articles table
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS wordpress_post_id TEXT,
ADD COLUMN IF NOT EXISTS wordpress_post_url TEXT,
ADD COLUMN IF NOT EXISTS wordpress_site_id UUID REFERENCES wordpress_connections(id),
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;

-- 3. Enable RLS
ALTER TABLE wordpress_connections ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for wordpress_connections
DROP POLICY IF EXISTS "Users can view own connections" ON wordpress_connections;
CREATE POLICY "Users can view own connections"
  ON wordpress_connections FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own connections" ON wordpress_connections;
CREATE POLICY "Users can insert own connections"
  ON wordpress_connections FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own connections" ON wordpress_connections;
CREATE POLICY "Users can update own connections"
  ON wordpress_connections FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own connections" ON wordpress_connections;
CREATE POLICY "Users can delete own connections"
  ON wordpress_connections FOR DELETE USING (auth.uid() = user_id);

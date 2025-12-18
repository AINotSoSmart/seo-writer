-- Enable the vector extension to work with embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the internal_links table
CREATE TABLE IF NOT EXISTS internal_links (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    embedding vector(768), -- Using 768 for Gemini text-embedding-004
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for similarity search
CREATE INDEX IF NOT EXISTS internal_links_embedding_idx ON internal_links 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable RLS
ALTER TABLE internal_links ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own links" ON internal_links;
CREATE POLICY "Users can view own links" ON internal_links
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own links" ON internal_links;
CREATE POLICY "Users can insert own links" ON internal_links
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own links" ON internal_links;
CREATE POLICY "Users can update own links" ON internal_links
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own links" ON internal_links;
CREATE POLICY "Users can delete own links" ON internal_links
    FOR DELETE USING (auth.uid() = user_id);

-- Function to search for relevant links
CREATE OR REPLACE FUNCTION match_internal_links (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id uuid,
  url text,
  title text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    internal_links.id,
    internal_links.url,
    internal_links.title,
    1 - (internal_links.embedding <=> query_embedding) AS similarity
  FROM internal_links
  WHERE 1 - (internal_links.embedding <=> query_embedding) > match_threshold
    AND internal_links.user_id = p_user_id
  ORDER BY internal_links.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Migration to add brand_id to internal_links and isolate searches by brand

-- 1. Add brand_id column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'internal_links' AND COLUMN_NAME = 'brand_id') THEN
        ALTER TABLE internal_links ADD COLUMN brand_id UUID REFERENCES brand_details(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Update the search function to filter by brand_id
CREATE OR REPLACE FUNCTION match_internal_links (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_brand_id uuid,
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
    AND (p_brand_id IS NULL OR internal_links.brand_id = p_brand_id)
  ORDER BY internal_links.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

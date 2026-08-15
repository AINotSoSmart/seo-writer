-- Migration: Add brand_id filtering to match_articles_topic RPC
-- Fixes cross-brand article matching bug
-- Run this in Supabase SQL Editor

-- Drop old function signatures and create new one with brand_id support
DROP FUNCTION IF EXISTS match_articles_topic(vector, float, int, uuid);
DROP FUNCTION IF EXISTS match_articles_topic(vector, float, int, uuid, uuid);

CREATE OR REPLACE FUNCTION match_articles_topic (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid,
  p_brand_id uuid DEFAULT NULL  -- NEW: Optional brand filter for isolation
)
RETURNS TABLE (
  id uuid,
  keyword text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    articles.id,
    articles.keyword,
    1 - (articles.topic_embedding <=> query_embedding) AS similarity
  FROM articles
  WHERE 1 - (articles.topic_embedding <=> query_embedding) > match_threshold
    AND articles.user_id = p_user_id
    AND (p_brand_id IS NULL OR articles.brand_id = p_brand_id)  -- NEW: Brand isolation
  ORDER BY articles.topic_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

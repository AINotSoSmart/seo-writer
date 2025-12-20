-- Add topic_embedding column to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS topic_embedding vector(768);

-- Create index for similarity search
CREATE INDEX IF NOT EXISTS articles_topic_embedding_idx ON articles
USING ivfflat (topic_embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to check for topic duplication (Semantic Check)
DROP FUNCTION IF EXISTS match_articles_topic(vector, float, int, uuid);
CREATE OR REPLACE FUNCTION match_articles_topic (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_user_id uuid
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
  ORDER BY articles.topic_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

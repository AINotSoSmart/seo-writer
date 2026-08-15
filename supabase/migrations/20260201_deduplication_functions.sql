-- Tactical Deduplication Layer: Semantic Chain Functions
-- These functions enable programmatic link injection during outline generation

-- Function A: Find an already-covered answer
-- Input: heading embedding vector, brand_id
-- Searches answer_coverage for semantic matches
-- Returns: article_id, answer_text, similarity
CREATE OR REPLACE FUNCTION find_covered_answer(
  check_embedding vector(1536),
  brand_uuid uuid,
  match_threshold float
)
RETURNS TABLE (article_id uuid, answer_text text, similarity float)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT first_covered_by, answer_unit, 1 - (answer_embedding <=> check_embedding)
  FROM answer_coverage
  WHERE brand_id = brand_uuid
  AND answer_embedding IS NOT NULL
  AND 1 - (answer_embedding <=> check_embedding) > match_threshold
  ORDER BY 1 - (answer_embedding <=> check_embedding) DESC
  LIMIT 1;
END;
$$;

-- Function B: Bridge from article to live URL
-- Input: article UUID from Function A
-- Gets topic_embedding from articles, matches against internal_links
-- Returns: live_url, live_title, similarity
CREATE OR REPLACE FUNCTION find_live_url_from_article(
  target_article_id uuid,
  brand_uuid uuid,
  match_threshold float
)
RETURNS TABLE (live_url text, live_title text, similarity float)
LANGUAGE plpgsql
AS $$
DECLARE
  source_vector vector(1536);
BEGIN
  -- 1. Get the source vector from the draft article
  SELECT topic_embedding INTO source_vector
  FROM articles
  WHERE id = target_article_id;

  -- 2. Find the matching live link
  RETURN QUERY
  SELECT url, title, 1 - (embedding <=> source_vector)
  FROM internal_links
  WHERE brand_id = brand_uuid
  AND 1 - (embedding <=> source_vector) > match_threshold
  ORDER BY 1 - (embedding <=> source_vector) DESC
  LIMIT 1;
END;
$$;

-- Function to search for similar articles by embedding
-- Mirrors match_internal_links but for the articles table
CREATE OR REPLACE FUNCTION match_articles (
    query_embedding vector(768),
    match_threshold float,
    match_count int,
    p_user_id uuid,
    p_brand_id uuid DEFAULT NULL
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
    WHERE 
        articles.topic_embedding IS NOT NULL
        AND 1 - (articles.topic_embedding <=> query_embedding) > match_threshold
        AND articles.user_id = p_user_id
        AND (p_brand_id IS NULL OR articles.brand_id = p_brand_id)
    ORDER BY articles.topic_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

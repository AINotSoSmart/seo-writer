-- Add SEO fields to articles table (minimal)
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS meta_description TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add index for slug lookup
CREATE INDEX IF NOT EXISTS articles_slug_idx ON articles(slug);

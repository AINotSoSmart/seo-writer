-- Add default_category_id to wordpress_connections
ALTER TABLE wordpress_connections
ADD COLUMN IF NOT EXISTS default_category_id INTEGER NULL;

-- Comment explaining the field
COMMENT ON COLUMN wordpress_connections.default_category_id IS 'Default WordPress category ID for published posts';

-- Add featured image fields
-- 1. Add image_style to brand_details
ALTER TABLE brand_details
ADD COLUMN IF NOT EXISTS image_style TEXT DEFAULT 'stock';

-- 2. Add featured_image_url to articles
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS featured_image_url TEXT;

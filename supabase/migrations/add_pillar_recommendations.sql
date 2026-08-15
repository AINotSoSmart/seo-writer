-- Pillar Pages Feature: Add pillar_recommendations column to brand_details
-- Run this in Supabase SQL Editor

ALTER TABLE brand_details 
ADD COLUMN IF NOT EXISTS pillar_recommendations jsonb DEFAULT NULL;

-- Add a comment describing the schema
COMMENT ON COLUMN brand_details.pillar_recommendations IS 'Array of pillar page recommendations: [{id, title, description, suggested_slug, created_url?, created_at?}]';

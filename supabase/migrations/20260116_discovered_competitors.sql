-- Add discovered_competitors column to brand_details table
-- This stores competitors discovered during plan generation for reuse
-- Nullable to avoid breaking existing brand saves (race condition safe)

ALTER TABLE public.brand_details 
ADD COLUMN IF NOT EXISTS discovered_competitors JSONB DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.brand_details.discovered_competitors IS 
  'Cached competitor brands discovered during plan generation. Format: [{name: string, url?: string}]';

-- Add generation tracking columns to topical_audits table
-- Enables background processing with Trigger.dev + polling from frontend

ALTER TABLE public.topical_audits 
  ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS generation_phase TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS generation_error TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_pages_scanned INTEGER DEFAULT 0;

COMMENT ON COLUMN public.topical_audits.generation_status IS 'pending | running | completed | failed';
COMMENT ON COLUMN public.topical_audits.generation_phase IS 'niche_mapping | user_scanning | competitor_scanning | scoring';
COMMENT ON COLUMN public.topical_audits.generation_error IS 'Error message if generation_status is failed';
COMMENT ON COLUMN public.topical_audits.user_pages_scanned IS 'Number of user pages analyzed during audit';

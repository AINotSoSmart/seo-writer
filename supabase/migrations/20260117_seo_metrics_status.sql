-- Add status tracking columns to seo_metrics table
-- This enables frontend polling for background job completion

ALTER TABLE seo_metrics ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE seo_metrics ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add index for faster status lookups during polling
CREATE INDEX IF NOT EXISTS idx_seo_metrics_status ON seo_metrics(user_id, domain, status);

COMMENT ON COLUMN seo_metrics.status IS 'Job status: pending, running, completed, failed';
COMMENT ON COLUMN seo_metrics.error_message IS 'Error message if status is failed';

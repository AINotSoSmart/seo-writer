-- Add generation_status column to content_plans table
-- Tracks the background plan generation process

ALTER TABLE content_plans 
ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'complete';

-- Add constraint to ensure valid status values
-- Values: 'pending', 'generating', 'complete', 'failed'
ALTER TABLE content_plans 
ADD CONSTRAINT content_plans_generation_status_check 
CHECK (generation_status IN ('pending', 'generating', 'complete', 'failed'));

-- Add generation_phase column to track current phase for UI display
ALTER TABLE content_plans 
ADD COLUMN IF NOT EXISTS generation_phase TEXT;

-- Add generation_error column to store error message if failed
ALTER TABLE content_plans 
ADD COLUMN IF NOT EXISTS generation_error TEXT;

-- Create index for efficient querying of pending plans
CREATE INDEX IF NOT EXISTS idx_content_plans_generation_status 
ON content_plans(generation_status) 
WHERE generation_status IN ('pending', 'generating');

-- Comment on columns
COMMENT ON COLUMN content_plans.generation_status IS 'Background generation status: pending, generating, complete, failed';
COMMENT ON COLUMN content_plans.generation_phase IS 'Current phase: serp, gap, hierarchy, plan';
COMMENT ON COLUMN content_plans.generation_error IS 'Error message if generation failed';

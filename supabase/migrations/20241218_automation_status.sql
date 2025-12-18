-- Add automation_status column to content_plans table
-- Values: 'paused' (default), 'active', 'completed'
ALTER TABLE content_plans 
ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT 'paused' 
CHECK (automation_status IN ('paused', 'active', 'completed'));

-- Index for efficient Watchman queries (find all active plans)
CREATE INDEX IF NOT EXISTS idx_content_plans_automation 
ON content_plans(automation_status) 
WHERE automation_status = 'active';

-- Comment for documentation
COMMENT ON COLUMN content_plans.automation_status IS 'Controls automatic article generation: paused (manual), active (watchman runs), completed (all done)';

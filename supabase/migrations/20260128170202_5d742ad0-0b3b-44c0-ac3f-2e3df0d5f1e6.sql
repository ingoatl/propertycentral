-- Add category, pinned, and estimated_minutes fields to user_tasks
ALTER TABLE user_tasks 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER;

-- Create index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_user_tasks_due_date ON user_tasks(user_id, due_date, status);
CREATE INDEX IF NOT EXISTS idx_user_tasks_pinned ON user_tasks(user_id, is_pinned) WHERE is_pinned = true;
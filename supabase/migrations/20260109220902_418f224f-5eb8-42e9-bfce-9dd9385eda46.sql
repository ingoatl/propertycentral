-- Add assigned_to_user_id column to pending_call_recaps for smart routing
ALTER TABLE pending_call_recaps 
ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES auth.users(id);

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_pending_call_recaps_assigned_to 
ON pending_call_recaps(assigned_to_user_id);
-- Add fields for owner approval tracking
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS owner_approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_approval_reminder_count integer DEFAULT 0;

-- Extend vendor token expiry by updating the default (future tokens will last 1 year)
-- For existing tokens, we'll handle in the edge function

-- Enable realtime for work_orders table
ALTER PUBLICATION supabase_realtime ADD TABLE work_orders;
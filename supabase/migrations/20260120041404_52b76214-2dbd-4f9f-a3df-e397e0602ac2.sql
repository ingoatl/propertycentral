-- Add owner approval token for secure email/SMS approval links
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS owner_approval_token text,
  ADD COLUMN IF NOT EXISTS voice_message_url text,
  ADD COLUMN IF NOT EXISTS voice_message_transcript text,
  ADD COLUMN IF NOT EXISTS video_url text;

-- Create index for token lookup
CREATE INDEX IF NOT EXISTS idx_work_orders_approval_token ON work_orders(owner_approval_token) WHERE owner_approval_token IS NOT NULL;
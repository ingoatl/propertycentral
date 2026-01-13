-- Add reminder tracking fields for enhanced reminder system
ALTER TABLE discovery_calls 
ADD COLUMN IF NOT EXISTS reminder_48h_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_reminder_scheduled_at timestamptz,
ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
ADD COLUMN IF NOT EXISTS rescheduled_from timestamptz,
ADD COLUMN IF NOT EXISTS reschedule_count integer DEFAULT 0;

-- Create index for efficient reminder queries
CREATE INDEX IF NOT EXISTS idx_discovery_calls_reminder_status 
ON discovery_calls (status, scheduled_at, reminder_24h_sent, reminder_1h_sent, reminder_48h_sent)
WHERE status IN ('scheduled', 'confirmed');
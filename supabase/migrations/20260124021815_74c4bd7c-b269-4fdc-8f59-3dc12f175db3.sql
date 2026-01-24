-- Add followup_reminder_sent_at column for automated 1-hour follow-up SMS
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS followup_reminder_sent_at TIMESTAMPTZ;
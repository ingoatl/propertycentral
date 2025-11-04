-- Add total_emails column to email_scan_log table
ALTER TABLE email_scan_log
ADD COLUMN IF NOT EXISTS total_emails INTEGER DEFAULT 0;
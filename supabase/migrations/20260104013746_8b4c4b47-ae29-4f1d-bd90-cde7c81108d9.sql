-- Add columns for original receipt storage and attachment metadata
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS original_receipt_path TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS attachment_metadata JSONB;

-- Add attachments column to email_insights for storing attachment info before download
ALTER TABLE email_insights ADD COLUMN IF NOT EXISTS attachments JSONB;

-- Add index for faster lookup of expenses needing receipt extraction
CREATE INDEX IF NOT EXISTS idx_expenses_email_insight_original_receipt 
ON expenses(email_insight_id) 
WHERE email_insight_id IS NOT NULL AND original_receipt_path IS NULL;
-- Add email_insight_id column to expenses table to link to email_insights
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS email_insight_id UUID REFERENCES email_insights(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_email_insight_id ON expenses(email_insight_id);
-- Add delivery address field to expenses table
ALTER TABLE expenses
ADD COLUMN delivery_address text;

-- Create a unique constraint to prevent duplicate expenses from the same email
-- This prevents creating multiple expenses from the same gmail message
ALTER TABLE email_insights
ADD CONSTRAINT email_insights_gmail_message_id_unique UNIQUE (gmail_message_id);
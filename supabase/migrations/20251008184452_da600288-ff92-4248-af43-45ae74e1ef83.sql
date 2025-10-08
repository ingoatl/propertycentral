-- Add columns to email_insights to track expense information
ALTER TABLE email_insights 
ADD COLUMN sentiment text,
ADD COLUMN suggested_actions text,
ADD COLUMN expense_detected boolean DEFAULT false,
ADD COLUMN expense_amount numeric,
ADD COLUMN expense_description text,
ADD COLUMN expense_created boolean DEFAULT false;
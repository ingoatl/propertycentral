-- Add gmail_message_id column to utility_readings table
ALTER TABLE public.utility_readings 
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;
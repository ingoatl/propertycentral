-- Add ghl_message_id column to sms_log table for GHL SMS tracking
ALTER TABLE public.sms_log 
ADD COLUMN IF NOT EXISTS ghl_message_id TEXT;
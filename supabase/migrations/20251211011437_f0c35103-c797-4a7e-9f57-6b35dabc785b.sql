-- Add twilio_message_sid and error_message columns to sms_log
ALTER TABLE public.sms_log 
ADD COLUMN IF NOT EXISTS twilio_message_sid TEXT,
ADD COLUMN IF NOT EXISTS error_message TEXT;
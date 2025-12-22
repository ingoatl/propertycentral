-- Add delivery status tracking columns to sms_log
ALTER TABLE public.sms_log 
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'queued',
ADD COLUMN IF NOT EXISTS delivery_status_updated_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS error_code integer;
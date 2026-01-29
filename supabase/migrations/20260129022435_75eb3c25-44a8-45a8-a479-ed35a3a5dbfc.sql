-- Add columns for daily payment reminder tracking
ALTER TABLE public.payment_setup_requests 
ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS reminder_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'cohosting';

-- Add comment for documentation
COMMENT ON COLUMN public.payment_setup_requests.last_reminder_sent_at IS 'Timestamp of last daily reminder sent';
COMMENT ON COLUMN public.payment_setup_requests.reminder_count IS 'Count of daily reminders sent (max 6)';
COMMENT ON COLUMN public.payment_setup_requests.service_type IS 'Type: cohosting (we charge) or full_service (we pay)';
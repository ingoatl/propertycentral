-- Add welcome_email_w9 to the lead stage enum
-- First check if it exists
DO $$ 
BEGIN
  -- Try to add the new value to the enum
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'welcome_email_w9' AND enumtypid = 'lead_stage'::regtype) THEN
    ALTER TYPE lead_stage ADD VALUE 'welcome_email_w9' AFTER 'contract_signed';
  END IF;
END $$;

-- Create table for scheduled pipeline emails (for 1-hour delayed payment email)
CREATE TABLE IF NOT EXISTS public.lead_scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'payment_setup', 'welcome', 'w9', etc.
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for cron job to find pending emails
CREATE INDEX IF NOT EXISTS idx_lead_scheduled_emails_pending 
ON public.lead_scheduled_emails(scheduled_for) 
WHERE status = 'pending';

-- Add index on lead_id for lookups
CREATE INDEX IF NOT EXISTS idx_lead_scheduled_emails_lead 
ON public.lead_scheduled_emails(lead_id);

-- Enable RLS
ALTER TABLE public.lead_scheduled_emails ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow authenticated users to manage
CREATE POLICY "Authenticated users can view scheduled emails"
ON public.lead_scheduled_emails FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert scheduled emails"
ON public.lead_scheduled_emails FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update scheduled emails"
ON public.lead_scheduled_emails FOR UPDATE
TO authenticated
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_lead_scheduled_emails_updated_at
BEFORE UPDATE ON public.lead_scheduled_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
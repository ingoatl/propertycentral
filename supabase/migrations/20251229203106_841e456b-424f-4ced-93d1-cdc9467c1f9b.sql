-- Create lead_event_log table for tracking all automated events
CREATE TABLE public.lead_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  stage_changed_to TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_event_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_event_log
CREATE POLICY "Approved users can view lead events"
ON public.lead_event_log
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

CREATE POLICY "Service role can manage lead events"
ON public.lead_event_log
FOR ALL
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_lead_event_log_lead_id ON public.lead_event_log(lead_id);
CREATE INDEX idx_lead_event_log_event_type ON public.lead_event_log(event_type);
CREATE INDEX idx_lead_event_log_created_at ON public.lead_event_log(created_at DESC);

-- Add new columns to leads table for integrations
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS stripe_setup_intent_id TEXT,
ADD COLUMN IF NOT EXISTS onboarding_submission_id UUID,
ADD COLUMN IF NOT EXISTS signwell_document_id TEXT,
ADD COLUMN IF NOT EXISTS last_stage_auto_update_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_stage_reason TEXT;
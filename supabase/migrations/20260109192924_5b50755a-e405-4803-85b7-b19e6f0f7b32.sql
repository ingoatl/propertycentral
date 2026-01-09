-- Create pending_call_recaps table for storing editable recap email drafts
CREATE TABLE public.pending_call_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID REFERENCES public.lead_communications(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.property_owners(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  
  -- Recipient info (resolved from owner or lead)
  recipient_name TEXT NOT NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  recipient_type TEXT NOT NULL DEFAULT 'unknown', -- 'owner', 'lead', 'unknown'
  
  -- Call metadata
  call_date TIMESTAMPTZ NOT NULL,
  call_duration INTEGER, -- seconds
  caller_user_id UUID REFERENCES auth.users(id), -- who on our team was on the call
  
  -- AI-generated content (editable by user)
  subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  key_topics JSONB DEFAULT '[]'::jsonb,
  action_items JSONB DEFAULT '[]'::jsonb,
  transcript_summary TEXT,
  sentiment TEXT, -- positive, neutral, negative
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dismissed')),
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id),
  dismissed_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX idx_pending_call_recaps_status ON public.pending_call_recaps(status);
CREATE INDEX idx_pending_call_recaps_caller ON public.pending_call_recaps(caller_user_id);
CREATE INDEX idx_pending_call_recaps_created ON public.pending_call_recaps(created_at DESC);
CREATE INDEX idx_pending_call_recaps_owner ON public.pending_call_recaps(owner_id);
CREATE INDEX idx_pending_call_recaps_lead ON public.pending_call_recaps(lead_id);

-- Enable RLS
ALTER TABLE public.pending_call_recaps ENABLE ROW LEVEL SECURITY;

-- RLS policies - only authenticated users can access
CREATE POLICY "Authenticated users can view pending recaps"
  ON public.pending_call_recaps
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert pending recaps"
  ON public.pending_call_recaps
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update pending recaps"
  ON public.pending_call_recaps
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete pending recaps"
  ON public.pending_call_recaps
  FOR DELETE
  TO authenticated
  USING (true);

-- Service role can do everything (for edge functions)
CREATE POLICY "Service role full access to pending recaps"
  ON public.pending_call_recaps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_pending_call_recaps_updated_at
  BEFORE UPDATE ON public.pending_call_recaps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add caller_user_id to pending_task_confirmations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pending_task_confirmations' 
    AND column_name = 'caller_user_id'
  ) THEN
    ALTER TABLE public.pending_task_confirmations 
    ADD COLUMN caller_user_id UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Add ghl_call_id to pending_task_confirmations for linking to GHL calls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pending_task_confirmations' 
    AND column_name = 'ghl_call_id'
  ) THEN
    ALTER TABLE public.pending_task_confirmations 
    ADD COLUMN ghl_call_id TEXT;
  END IF;
END $$;
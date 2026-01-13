-- Create ai_draft_replies table to store pre-generated AI drafts for inbound messages
CREATE TABLE public.ai_draft_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  communication_id UUID REFERENCES public.lead_communications(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.property_owners(id) ON DELETE CASCADE,
  contact_phone TEXT,
  contact_email TEXT,
  draft_content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'sms' CHECK (message_type IN ('sms', 'email')),
  confidence_score NUMERIC(3, 2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'edited', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  dismissed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient lookups
CREATE INDEX idx_ai_draft_replies_communication_id ON public.ai_draft_replies(communication_id);
CREATE INDEX idx_ai_draft_replies_lead_id ON public.ai_draft_replies(lead_id);
CREATE INDEX idx_ai_draft_replies_owner_id ON public.ai_draft_replies(owner_id);
CREATE INDEX idx_ai_draft_replies_status ON public.ai_draft_replies(status);
CREATE INDEX idx_ai_draft_replies_contact_phone ON public.ai_draft_replies(contact_phone);
CREATE INDEX idx_ai_draft_replies_created_at ON public.ai_draft_replies(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_draft_replies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - allow authenticated users to manage drafts
CREATE POLICY "Authenticated users can view all AI drafts"
ON public.ai_draft_replies
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create AI drafts"
ON public.ai_draft_replies
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update AI drafts"
ON public.ai_draft_replies
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete AI drafts"
ON public.ai_draft_replies
FOR DELETE
USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_ai_draft_replies_updated_at
BEFORE UPDATE ON public.ai_draft_replies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.ai_draft_replies IS 'Stores pre-generated AI draft replies for inbound communications';
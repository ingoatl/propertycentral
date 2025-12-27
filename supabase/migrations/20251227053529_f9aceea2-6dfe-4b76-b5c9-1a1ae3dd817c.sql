-- Table to store email drafts created by AI or manually
CREATE TABLE public.email_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  property_name TEXT,
  contact_type TEXT,
  contact_context TEXT,
  ai_generated BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'discarded')),
  sent_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

-- Policies for email drafts
CREATE POLICY "Approved users can manage email drafts" ON public.email_drafts
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
  ));

-- Create updated_at trigger
CREATE TRIGGER update_email_drafts_updated_at
  BEFORE UPDATE ON public.email_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
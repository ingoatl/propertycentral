-- Add permit expiration tracking to property_documents
ALTER TABLE public.property_documents 
ADD COLUMN IF NOT EXISTS permit_expiration_date date,
ADD COLUMN IF NOT EXISTS permit_reminder_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_extracted_data jsonb;

-- Create a table to track permit reminders sent
CREATE TABLE IF NOT EXISTS public.permit_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.property_documents(id) ON DELETE CASCADE,
  permit_number text,
  permit_expiration_date date NOT NULL,
  reminder_sent_at timestamp with time zone,
  reminder_email_to text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.permit_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for permit_reminders
CREATE POLICY "Admins can manage permit reminders"
ON public.permit_reminders
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view permit reminders"
ON public.permit_reminders
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_property_documents_permit_expiration 
ON public.property_documents(permit_expiration_date) 
WHERE permit_expiration_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_permit_reminders_expiration 
ON public.permit_reminders(permit_expiration_date, status);
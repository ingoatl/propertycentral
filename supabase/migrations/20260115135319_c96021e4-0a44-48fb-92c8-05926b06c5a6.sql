-- Add purpose column to user_phone_assignments for number classification
ALTER TABLE public.user_phone_assignments 
ADD COLUMN IF NOT EXISTS purpose text DEFAULT 'general_sms';

-- Add received_on_number tracking to lead_communications
ALTER TABLE public.lead_communications 
ADD COLUMN IF NOT EXISTS received_on_number text,
ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES public.profiles(id);

-- Update existing assignments with purpose
UPDATE public.user_phone_assignments SET purpose = 'google_reviews' WHERE phone_number = '+14046090955';
UPDATE public.user_phone_assignments SET purpose = 'main_line' WHERE phone_number = '+14048005932';
UPDATE public.user_phone_assignments SET purpose = 'general_sms' WHERE purpose IS NULL OR purpose = '';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_phone_assignments_phone ON public.user_phone_assignments(phone_number);
CREATE INDEX IF NOT EXISTS idx_lead_comms_assigned_user ON public.lead_communications(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_lead_comms_received_number ON public.lead_communications(received_on_number);
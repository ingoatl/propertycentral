-- Create table to track payment setup requests and reminders
CREATE TABLE public.payment_setup_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.property_owners(id) ON DELETE CASCADE,
  initial_sent_at timestamptz NOT NULL DEFAULT now(),
  reminder_1_sent_at timestamptz,  -- Day 3
  reminder_2_sent_at timestamptz,  -- Day 7  
  final_reminder_sent_at timestamptz,  -- Day 14
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'pending', -- pending, completed, expired
  stripe_session_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_setup_requests ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users (admin access)
CREATE POLICY "Authenticated users can manage payment setup requests"
ON public.payment_setup_requests
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for efficient querying
CREATE INDEX idx_payment_setup_requests_status ON public.payment_setup_requests(status);
CREATE INDEX idx_payment_setup_requests_owner_id ON public.payment_setup_requests(owner_id);

-- Add trigger for updated_at
CREATE TRIGGER update_payment_setup_requests_updated_at
BEFORE UPDATE ON public.payment_setup_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
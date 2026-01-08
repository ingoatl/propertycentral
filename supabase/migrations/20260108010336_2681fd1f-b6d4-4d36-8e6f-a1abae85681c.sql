-- Add new columns to discovery_calls for meeting preferences
ALTER TABLE public.discovery_calls 
ADD COLUMN IF NOT EXISTS meeting_type text DEFAULT 'phone' CHECK (meeting_type IN ('phone', 'video')),
ADD COLUMN IF NOT EXISTS service_interest text CHECK (service_interest IN ('property_management', 'cohosting', 'undecided')),
ADD COLUMN IF NOT EXISTS start_timeline text,
ADD COLUMN IF NOT EXISTS google_meet_link text DEFAULT 'https://meet.google.com/jww-deey-iaa';

-- Create table for discovery call reminders tracking
CREATE TABLE IF NOT EXISTS public.discovery_call_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovery_call_id uuid REFERENCES public.discovery_calls(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('confirmation', '24h', '1h', '15min')),
  channel text NOT NULL CHECK (channel IN ('email', 'sms')),
  sent_at timestamp with time zone,
  status text DEFAULT 'pending',
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.discovery_call_reminders ENABLE ROW LEVEL SECURITY;

-- RLS policies for reminders
CREATE POLICY "Authenticated users can view reminders" 
ON public.discovery_call_reminders 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service can manage reminders" 
ON public.discovery_call_reminders 
FOR ALL 
USING (true) 
WITH CHECK (true);
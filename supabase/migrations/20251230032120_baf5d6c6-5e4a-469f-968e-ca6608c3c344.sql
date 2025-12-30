-- Create table for GHL phone numbers
CREATE TABLE IF NOT EXISTS public.ghl_phone_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ghl_phone_id TEXT UNIQUE NOT NULL,
  phone_number TEXT NOT NULL,
  friendly_name TEXT,
  type TEXT DEFAULT 'local',
  capabilities JSONB DEFAULT '{}',
  location_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ghl_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Admins can manage GHL phone numbers
CREATE POLICY "Admins can manage ghl_phone_numbers" 
ON public.ghl_phone_numbers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Approved users can view GHL phone numbers
CREATE POLICY "Approved users can view ghl_phone_numbers" 
ON public.ghl_phone_numbers 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status));

-- Add GHL-related columns to lead_communications if not exists
ALTER TABLE public.lead_communications 
ADD COLUMN IF NOT EXISTS ghl_call_id TEXT,
ADD COLUMN IF NOT EXISTS call_duration INTEGER,
ADD COLUMN IF NOT EXISTS call_recording_url TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create index for GHL call ID lookups
CREATE INDEX IF NOT EXISTS idx_lead_communications_ghl_call_id ON public.lead_communications(ghl_call_id) WHERE ghl_call_id IS NOT NULL;
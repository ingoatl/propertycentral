-- Create phone_lookups table to cache Twilio Lookup API results
CREATE TABLE public.phone_lookups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  e164_phone TEXT,
  caller_name TEXT,
  carrier TEXT,
  line_type TEXT,
  valid BOOLEAN DEFAULT true,
  raw_response JSONB,
  looked_up_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_phone_lookups_phone ON public.phone_lookups(phone);

-- Enable RLS (but allow service role access)
ALTER TABLE public.phone_lookups ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Authenticated users can view phone lookups" 
ON public.phone_lookups 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access to phone lookups" 
ON public.phone_lookups 
FOR ALL 
USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE public.phone_lookups IS 'Cache for Twilio Lookup API results to avoid repeated API calls';
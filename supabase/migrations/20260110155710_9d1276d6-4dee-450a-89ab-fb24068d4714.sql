-- Allow anonymous users to create leads from website bookings
-- This enables the public discovery call booking form

CREATE POLICY "Public website booking leads" 
ON public.leads 
FOR INSERT 
TO anon
WITH CHECK (
  opportunity_source = 'website_booking' 
  AND stage = 'call_scheduled'::lead_stage
);
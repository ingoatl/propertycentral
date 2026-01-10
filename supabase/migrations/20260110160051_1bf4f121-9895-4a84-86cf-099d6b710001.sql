-- Drop duplicate policies
DROP POLICY IF EXISTS "Public booking can create leads" ON public.leads;
DROP POLICY IF EXISTS "Public website booking leads" ON public.leads;

-- Create a clean policy for anonymous website bookings
CREATE POLICY "Anon website booking leads" 
ON public.leads 
FOR INSERT 
TO anon
WITH CHECK (
  opportunity_source = 'website_booking' 
  AND stage = 'call_scheduled'::lead_stage
);
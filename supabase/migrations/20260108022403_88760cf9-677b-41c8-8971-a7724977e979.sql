-- Drop the existing policy and create a cleaner one
DROP POLICY IF EXISTS "Allow public booking lead creation" ON public.leads;

-- Create a simpler policy for public booking that works for both anon and authenticated
CREATE POLICY "Allow public booking lead creation" 
ON public.leads 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  opportunity_source = 'website_booking' 
  AND stage = 'call_scheduled'::lead_stage
);
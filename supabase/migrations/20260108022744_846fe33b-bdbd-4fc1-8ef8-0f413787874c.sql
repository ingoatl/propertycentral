-- Drop all INSERT policies on leads and create a clean one
DROP POLICY IF EXISTS "Allow public booking lead creation" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;

-- Create a simple policy that allows inserts from public booking page (anon users)
-- This checks that it's a website booking with call_scheduled stage
CREATE POLICY "Public booking can create leads" 
ON public.leads 
FOR INSERT 
TO anon
WITH CHECK (
  opportunity_source = 'website_booking' 
  AND stage = 'call_scheduled'::lead_stage
);

-- Authenticated/approved users can create any leads
CREATE POLICY "Approved users can insert leads" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'::account_status
  )
  OR (
    opportunity_source = 'website_booking' 
    AND stage = 'call_scheduled'::lead_stage
  )
);
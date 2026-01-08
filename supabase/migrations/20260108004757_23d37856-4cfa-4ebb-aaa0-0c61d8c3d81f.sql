-- Fix leads UPDATE policy to include WITH CHECK clause
DROP POLICY IF EXISTS "Approved users can update leads" ON public.leads;
CREATE POLICY "Approved users can update leads" 
ON public.leads 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.status = 'approved'::account_status
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.status = 'approved'::account_status
));

-- Make discovery_calls more permissive for authenticated users
DROP POLICY IF EXISTS "Authenticated users can create discovery calls" ON public.discovery_calls;
CREATE POLICY "Authenticated users can create discovery calls" 
ON public.discovery_calls 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Also fix lead_timeline to have both USING and WITH CHECK
DROP POLICY IF EXISTS "Approved users can insert lead timeline" ON public.lead_timeline;
CREATE POLICY "Approved users can insert lead timeline" 
ON public.lead_timeline 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.status = 'approved'::account_status
));

-- Add update policy for lead_timeline
DROP POLICY IF EXISTS "Approved users can update lead timeline" ON public.lead_timeline;
CREATE POLICY "Approved users can update lead timeline" 
ON public.lead_timeline 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.status = 'approved'::account_status
))
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.status = 'approved'::account_status
));
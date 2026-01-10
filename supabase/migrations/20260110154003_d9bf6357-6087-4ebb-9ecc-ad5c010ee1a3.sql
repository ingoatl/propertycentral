-- Drop the existing authenticated insert policy
DROP POLICY IF EXISTS "Approved users can insert leads" ON public.leads;

-- Create a new insert policy that:
-- 1. Allows approved users to insert any leads
-- 2. Allows any authenticated user to insert website bookings
CREATE POLICY "Users can insert leads" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Approved users can insert any leads
  (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'::account_status
  ))
  OR
  -- Any authenticated user can create a website booking lead
  (opportunity_source = 'website_booking' AND stage = 'call_scheduled'::lead_stage)
);
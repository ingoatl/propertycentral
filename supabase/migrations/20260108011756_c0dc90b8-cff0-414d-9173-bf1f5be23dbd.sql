-- Allow anonymous users to create leads from public booking page
CREATE POLICY "Allow public booking lead creation" ON public.leads
  FOR INSERT
  TO anon
  WITH CHECK (
    opportunity_source = 'website_booking' AND
    stage = 'call_scheduled'
  );

-- Allow authenticated users to insert leads regardless of approval status
-- Drop the restrictive policy if it exists
DROP POLICY IF EXISTS "Approved users can insert leads" ON public.leads;

-- Create a more permissive policy for authenticated users
CREATE POLICY "Authenticated users can insert leads" ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
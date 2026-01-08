-- Drop existing restrictive policies and recreate with proper permissions
DROP POLICY IF EXISTS "Allow public booking lead creation" ON public.leads;
DROP POLICY IF EXISTS "Allow public discovery call booking" ON public.discovery_calls;

-- Allow anonymous users to insert leads from public booking page
CREATE POLICY "Allow public booking lead creation" ON public.leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    opportunity_source = 'website_booking' AND
    stage = 'call_scheduled'
  );

-- Allow anonymous users to insert discovery calls from public booking
CREATE POLICY "Allow public discovery call booking" ON public.discovery_calls
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'scheduled' AND
    lead_id IS NOT NULL
  );
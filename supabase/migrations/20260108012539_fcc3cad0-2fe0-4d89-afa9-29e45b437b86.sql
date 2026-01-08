-- Add policy to allow public booking of discovery calls (for website visitors)
CREATE POLICY "Allow public discovery call booking" 
ON public.discovery_calls 
FOR INSERT 
WITH CHECK (
  status = 'scheduled' 
  AND lead_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.leads l 
    WHERE l.id = lead_id 
    AND l.opportunity_source = 'website_booking'
  )
);

-- Allow public read of availability slots for booking
CREATE POLICY "Public can view availability slots" 
ON public.availability_slots 
FOR SELECT 
USING (is_active = true);

-- Allow public read of blocked dates for booking
CREATE POLICY "Public can view blocked dates" 
ON public.blocked_dates 
FOR SELECT 
USING (true);

-- Allow public read of scheduled discovery calls to check conflicts
CREATE POLICY "Public can view scheduled calls for booking" 
ON public.discovery_calls 
FOR SELECT 
USING (status = 'scheduled');
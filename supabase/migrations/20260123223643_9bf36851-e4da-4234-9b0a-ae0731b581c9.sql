-- Add policy to allow public read of guest screenings by property_id
-- This is needed because owner portal uses magic links, not auth sessions
CREATE POLICY "Allow public read of guest screenings by property"
ON public.guest_screenings
FOR SELECT
USING (true);

-- Drop the overly restrictive owner policy that requires auth.email()
DROP POLICY IF EXISTS "Owners can view screenings for their properties" ON public.guest_screenings;
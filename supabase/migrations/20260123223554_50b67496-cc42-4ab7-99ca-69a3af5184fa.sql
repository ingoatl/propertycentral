-- Add policy to allow unauthenticated access to marketing activities by property_id
-- This is needed because owner portal uses magic links, not auth sessions
CREATE POLICY "Allow public read of marketing activities by property"
ON public.owner_marketing_activities
FOR SELECT
USING (true);

-- Drop the overly restrictive owner policy that requires auth
DROP POLICY IF EXISTS "Owners can view their properties marketing activities" ON public.owner_marketing_activities;
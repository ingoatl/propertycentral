-- Allow vendors to view onboarding data for properties linked to their assigned work orders
CREATE POLICY "Vendors can view onboarding via work order token"
ON public.owner_onboarding_submissions
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM work_orders wo 
    WHERE wo.property_id = owner_onboarding_submissions.property_id 
    AND wo.vendor_access_token IS NOT NULL
  )
);
-- Allow approved users to update property image paths
-- Currently users can upload images but cannot update the properties table

CREATE POLICY "Approved users can update property images"
ON public.properties
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'
  )
);
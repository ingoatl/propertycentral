-- Add RLS policies for all approved users to upload property images
-- Currently only admins can upload, which is blocking regular users like Catherine

-- Allow approved users to upload property images
CREATE POLICY "Approved users can upload property images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-images' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'
  )
);

-- Allow approved users to update property images
CREATE POLICY "Approved users can update property images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-images' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'
  )
)
WITH CHECK (
  bucket_id = 'property-images' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'
  )
);

-- Allow approved users to delete property images
CREATE POLICY "Approved users can delete property images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-images' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'
  )
);

-- Allow public to view property images (bucket is public)
CREATE POLICY "Public can view property images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'property-images');
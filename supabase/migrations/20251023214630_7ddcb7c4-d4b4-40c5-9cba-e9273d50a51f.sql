-- Create RLS policies for task-attachments bucket to allow authenticated users to read files

-- Allow authenticated users to view all task attachments
CREATE POLICY "Authenticated users can view task attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'task-attachments');

-- Allow users to upload their own task attachments
CREATE POLICY "Users can upload task attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND auth.uid() = owner);

-- Allow users to delete their own task attachments
CREATE POLICY "Users can delete their own task attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments' AND auth.uid() = owner);
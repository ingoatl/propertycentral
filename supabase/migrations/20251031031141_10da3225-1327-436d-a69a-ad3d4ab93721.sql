-- Add screenshot support to bug reports
ALTER TABLE bug_reports ADD COLUMN screenshot_path text;

-- Create bug-screenshots storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-screenshots', 'bug-screenshots', false);

-- RLS policies for bug-screenshots bucket
CREATE POLICY "Authenticated users can upload bug screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bug-screenshots');

CREATE POLICY "Authenticated users can view bug screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'bug-screenshots');

CREATE POLICY "Admins can delete bug screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'bug-screenshots' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);
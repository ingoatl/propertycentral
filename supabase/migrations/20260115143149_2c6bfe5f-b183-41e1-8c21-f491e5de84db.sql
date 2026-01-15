-- Create storage bucket for compose attachments (emails and SMS)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments', 
  'message-attachments', 
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

-- Allow authenticated users to read attachments
CREATE POLICY "Authenticated users can read attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'message-attachments');

-- Allow public access to read attachments (for email/SMS delivery)
CREATE POLICY "Public can view message attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'message-attachments');
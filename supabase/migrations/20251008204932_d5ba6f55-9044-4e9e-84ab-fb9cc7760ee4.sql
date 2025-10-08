-- Create storage bucket for onboarding documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('onboarding-documents', 'onboarding-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for onboarding documents bucket
CREATE POLICY "Approved users can upload onboarding documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'onboarding-documents' 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND status = 'approved'::account_status
  )
);

CREATE POLICY "Approved users can view onboarding documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'onboarding-documents'
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND status = 'approved'::account_status
  )
);

CREATE POLICY "Approved users can update onboarding documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'onboarding-documents'
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND status = 'approved'::account_status
  )
);

CREATE POLICY "Approved users can delete onboarding documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'onboarding-documents'
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND status = 'approved'::account_status
  )
);
-- Create storage bucket for statement PDFs (for GREC audit compliance)
INSERT INTO storage.buckets (id, name, public)
VALUES ('statement-pdfs', 'statement-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for statement-pdfs bucket
-- Allow authenticated users to view their own PDFs (via signed URLs)
CREATE POLICY "Admins can access statement PDFs"
ON storage.objects FOR ALL
USING (bucket_id = 'statement-pdfs' AND EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
))
WITH CHECK (bucket_id = 'statement-pdfs' AND EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.uid() 
  AND role = 'admin'
));
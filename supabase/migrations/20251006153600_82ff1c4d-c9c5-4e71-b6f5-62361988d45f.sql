-- Create storage bucket for expense documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-documents', 'expense-documents', true);

-- Add file_path column to expenses table
ALTER TABLE expenses ADD COLUMN file_path TEXT;

-- Create storage policies for expense documents
CREATE POLICY "Anyone can view expense documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'expense-documents');

CREATE POLICY "Anyone can upload expense documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'expense-documents');

CREATE POLICY "Anyone can update expense documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'expense-documents');

CREATE POLICY "Anyone can delete expense documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'expense-documents');
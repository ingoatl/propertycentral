-- Add google_drive_url column to document_templates for linking to source documents
ALTER TABLE public.document_templates 
ADD COLUMN IF NOT EXISTS google_drive_url TEXT;
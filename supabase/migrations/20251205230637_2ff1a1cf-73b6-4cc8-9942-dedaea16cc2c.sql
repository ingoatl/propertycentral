-- Add new columns to booking_documents to make it more generic
ALTER TABLE public.booking_documents 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id),
ADD COLUMN IF NOT EXISTS recipient_name text,
ADD COLUMN IF NOT EXISTS recipient_email text,
ADD COLUMN IF NOT EXISTS document_name text,
ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'rental_agreement',
ADD COLUMN IF NOT EXISTS embedded_edit_url text,
ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS field_configuration jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_booking_documents_property_id ON public.booking_documents(property_id);
CREATE INDEX IF NOT EXISTS idx_booking_documents_status ON public.booking_documents(status);
CREATE INDEX IF NOT EXISTS idx_booking_documents_is_draft ON public.booking_documents(is_draft);

-- Update RLS policies to allow viewing by property
DROP POLICY IF EXISTS "Approved users can view booking documents" ON public.booking_documents;
CREATE POLICY "Approved users can view booking documents" 
ON public.booking_documents 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.status = 'approved'
));

DROP POLICY IF EXISTS "Approved users can insert booking documents" ON public.booking_documents;
CREATE POLICY "Approved users can insert booking documents" 
ON public.booking_documents 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.status = 'approved'
));

DROP POLICY IF EXISTS "Approved users can update booking documents" ON public.booking_documents;
CREATE POLICY "Approved users can update booking documents" 
ON public.booking_documents 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.status = 'approved'
));

DROP POLICY IF EXISTS "Approved users can delete booking documents" ON public.booking_documents;
CREATE POLICY "Approved users can delete booking documents" 
ON public.booking_documents 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.id = auth.uid() 
  AND profiles.status = 'approved'
));
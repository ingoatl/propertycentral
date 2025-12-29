-- Add contract_type to document_templates to distinguish contract types
ALTER TABLE public.document_templates 
ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'rental_agreement';

-- Add constraint for valid contract types
COMMENT ON COLUMN public.document_templates.contract_type IS 'Type of contract: rental_agreement, cohosting_agreement, management_agreement';

-- Add owner_id to booking_documents to link contracts directly to owners (not just bookings)
ALTER TABLE public.booking_documents 
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.property_owners(id);

-- Add contract_type to booking_documents to track what type of contract was signed
ALTER TABLE public.booking_documents 
ADD COLUMN IF NOT EXISTS contract_type text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_booking_documents_owner_id ON public.booking_documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_document_templates_contract_type ON public.document_templates(contract_type);
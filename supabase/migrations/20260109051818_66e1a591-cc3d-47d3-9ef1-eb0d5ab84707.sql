-- Add owner_id column to lead_communications for tracking owner communications
ALTER TABLE public.lead_communications
ADD COLUMN owner_id uuid REFERENCES public.property_owners(id);

-- Create index for owner communications lookup
CREATE INDEX idx_lead_communications_owner_id ON public.lead_communications(owner_id);

-- Allow lead_id to be nullable when owner_id is set (for owner-only communications)
ALTER TABLE public.lead_communications
ALTER COLUMN lead_id DROP NOT NULL;

-- Add check constraint to ensure either lead_id or owner_id is set
ALTER TABLE public.lead_communications
ADD CONSTRAINT chk_lead_or_owner CHECK (lead_id IS NOT NULL OR owner_id IS NOT NULL);
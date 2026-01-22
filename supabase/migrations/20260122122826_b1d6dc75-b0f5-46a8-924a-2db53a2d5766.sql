-- Add tax tracking columns to property_owners
ALTER TABLE public.property_owners 
ADD COLUMN IF NOT EXISTS tax_year_1099_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tax_year_1099_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tax_classification TEXT,
ADD COLUMN IF NOT EXISTS taxpayer_name TEXT,
ADD COLUMN IF NOT EXISTS taxpayer_address TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.property_owners.tax_year_1099_generated IS 'Whether 1099 has been generated for current tax year';
COMMENT ON COLUMN public.property_owners.tax_classification IS 'Tax classification: individual, llc, corporation, partnership';
COMMENT ON COLUMN public.property_owners.taxpayer_name IS 'Name as it appears on W-9 for 1099 filing';
COMMENT ON COLUMN public.property_owners.taxpayer_address IS 'Mailing address for 1099 filing';
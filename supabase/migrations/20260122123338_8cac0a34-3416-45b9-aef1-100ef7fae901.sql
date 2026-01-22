-- Add 1099 tracking columns to vendors table
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS payments_ytd NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS w9_received_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS w9_file_path TEXT,
ADD COLUMN IF NOT EXISTS tax_year_1099_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tax_year_1099_generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS tax_classification TEXT,
ADD COLUMN IF NOT EXISTS taxpayer_name TEXT,
ADD COLUMN IF NOT EXISTS taxpayer_address TEXT,
ADD COLUMN IF NOT EXISTS ein_last4 TEXT;

-- Add comments
COMMENT ON COLUMN public.vendors.payments_ytd IS 'Year-to-date payments made to vendor';
COMMENT ON COLUMN public.vendors.tax_classification IS 'Tax classification: individual, llc, corporation, partnership';
COMMENT ON COLUMN public.vendors.taxpayer_name IS 'Name as it appears on W-9 for 1099 filing';
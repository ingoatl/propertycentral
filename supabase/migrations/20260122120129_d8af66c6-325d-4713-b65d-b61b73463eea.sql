-- Add W-9 tracking columns to property_owners for dual-direction W-9 system
-- our_w9_* = PeachHaus W-9 sent TO co-hosting clients
-- owner_w9_* = Owner's W-9 received FROM full-service clients

ALTER TABLE public.property_owners 
ADD COLUMN IF NOT EXISTS our_w9_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS owner_w9_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS owner_w9_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS owner_w9_file_path text,
ADD COLUMN IF NOT EXISTS owner_tax_name text,
ADD COLUMN IF NOT EXISTS owner_ein_last4 text,
ADD COLUMN IF NOT EXISTS payments_ytd numeric DEFAULT 0;

-- Migrate existing w9_sent_at to our_w9_sent_at for co-hosting clients
UPDATE public.property_owners 
SET our_w9_sent_at = w9_sent_at 
WHERE w9_sent_at IS NOT NULL AND service_type = 'cohosting';

-- Add comment for clarity
COMMENT ON COLUMN public.property_owners.our_w9_sent_at IS 'When PeachHaus W-9 was sent TO co-hosting clients (they issue 1099 to us)';
COMMENT ON COLUMN public.property_owners.owner_w9_requested_at IS 'When we requested W-9 FROM full-service clients (we issue 1099 to them)';
COMMENT ON COLUMN public.property_owners.owner_w9_uploaded_at IS 'When full-service client uploaded their W-9';
COMMENT ON COLUMN public.property_owners.owner_w9_file_path IS 'Storage path to owner W-9 document';
COMMENT ON COLUMN public.property_owners.payments_ytd IS 'Year-to-date payments for 1099 threshold tracking ($600)';
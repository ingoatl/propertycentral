-- Add field_values column to signing_tokens to store each signer's filled values
ALTER TABLE public.signing_tokens 
ADD COLUMN IF NOT EXISTS field_values JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.signing_tokens.field_values IS 'Stores the form field values filled by this signer during the signing process';
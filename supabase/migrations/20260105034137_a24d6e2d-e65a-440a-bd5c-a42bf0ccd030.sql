-- Create signing_tokens table for secure document signing
CREATE TABLE public.signing_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.booking_documents(id) ON DELETE CASCADE,
  signer_email TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_type TEXT NOT NULL CHECK (signer_type IN ('owner', 'manager', 'second_owner')),
  signing_order INT NOT NULL DEFAULT 1,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  signed_at TIMESTAMPTZ,
  signature_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_signing_tokens_document_id ON public.signing_tokens(document_id);
CREATE INDEX idx_signing_tokens_token ON public.signing_tokens(token);
CREATE INDEX idx_signing_tokens_signer_email ON public.signing_tokens(signer_email);

-- Add new columns to booking_documents
ALTER TABLE public.booking_documents 
ADD COLUMN IF NOT EXISTS signed_pdf_path TEXT,
ADD COLUMN IF NOT EXISTS completion_certificate_path TEXT,
ADD COLUMN IF NOT EXISTS all_signed_at TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE public.signing_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies - tokens are accessed via edge functions with service role
CREATE POLICY "Service role can manage signing tokens"
ON public.signing_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Update trigger for signing_tokens
CREATE TRIGGER update_signing_tokens_updated_at
BEFORE UPDATE ON public.signing_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
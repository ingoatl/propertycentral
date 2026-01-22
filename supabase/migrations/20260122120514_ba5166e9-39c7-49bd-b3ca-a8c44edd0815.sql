-- Create table to store W-9 upload tokens
CREATE TABLE IF NOT EXISTS public.owner_w9_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES public.property_owners(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT owner_w9_tokens_owner_id_key UNIQUE (owner_id)
);

-- Enable RLS
ALTER TABLE public.owner_w9_tokens ENABLE ROW LEVEL SECURITY;

-- Allow public access for token validation (tokens are secure random strings)
CREATE POLICY "Allow public token validation"
ON public.owner_w9_tokens
FOR SELECT
USING (true);

-- Only service role can insert/update
CREATE POLICY "Service role can manage tokens"
ON public.owner_w9_tokens
FOR ALL
USING (auth.role() = 'service_role');

-- Add index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_owner_w9_tokens_token ON public.owner_w9_tokens(token);
CREATE INDEX IF NOT EXISTS idx_owner_w9_tokens_owner_id ON public.owner_w9_tokens(owner_id);
-- Create vendor W-9 tokens table for secure upload links
CREATE TABLE IF NOT EXISTS public.vendor_w9_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT vendor_w9_tokens_vendor_id_key UNIQUE (vendor_id)
);

-- Add w9_requested_at column to vendors if not exists
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS w9_requested_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.vendor_w9_tokens ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access on vendor_w9_tokens"
ON public.vendor_w9_tokens
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for token lookup
CREATE INDEX IF NOT EXISTS idx_vendor_w9_tokens_token ON public.vendor_w9_tokens(token);
-- Add user_id association to gmail_oauth_tokens for multi-account support
-- This allows each team member to connect their own Gmail
ALTER TABLE public.gmail_oauth_tokens 
ADD COLUMN IF NOT EXISTS label_name text,
ADD COLUMN IF NOT EXISTS email_address text;

-- Add unique constraint on email_address to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_gmail_tokens_email ON public.gmail_oauth_tokens(email_address) WHERE email_address IS NOT NULL;
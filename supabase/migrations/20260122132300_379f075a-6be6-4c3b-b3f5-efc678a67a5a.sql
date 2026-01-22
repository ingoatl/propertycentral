-- Add used_at column to owner_w9_tokens table to track when token was used
ALTER TABLE public.owner_w9_tokens 
ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
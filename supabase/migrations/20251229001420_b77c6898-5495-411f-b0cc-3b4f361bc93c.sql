-- Add OAuth token columns to gbp_settings for direct Google API integration
ALTER TABLE public.gbp_settings
ADD COLUMN IF NOT EXISTS access_token text,
ADD COLUMN IF NOT EXISTS refresh_token text,
ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone;

-- Add index for quick token lookup
CREATE INDEX IF NOT EXISTS idx_gbp_settings_token_expires ON public.gbp_settings(token_expires_at);
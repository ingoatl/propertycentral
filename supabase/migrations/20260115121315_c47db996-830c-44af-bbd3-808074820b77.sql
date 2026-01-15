-- Create gmail_token_refresh_log table for monitoring
CREATE TABLE IF NOT EXISTS public.gmail_token_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES public.gmail_oauth_tokens(id) ON DELETE CASCADE,
  refresh_type TEXT NOT NULL CHECK (refresh_type IN ('proactive', 'pre-flight', 'on-demand', 'cron')),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  old_expires_at TIMESTAMPTZ,
  new_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent refresh history
CREATE INDEX IF NOT EXISTS idx_gmail_token_refresh_log_created_at 
  ON public.gmail_token_refresh_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gmail_token_refresh_log_token_id 
  ON public.gmail_token_refresh_log(token_id);

-- Enable RLS
ALTER TABLE public.gmail_token_refresh_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for edge functions)
CREATE POLICY "Service role has full access to token refresh logs"
  ON public.gmail_token_refresh_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE public.gmail_token_refresh_log IS 'Tracks all Gmail OAuth token refresh attempts for monitoring and debugging';

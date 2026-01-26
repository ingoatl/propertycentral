-- SMB Multi-Tenant Tables

-- Rate limiting for API protection
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON public.rate_limit_logs(user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON public.rate_limit_logs(ip_address, action, created_at DESC);

-- Enable RLS
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view rate limit logs
CREATE POLICY "Admins can view rate limit logs"
  ON public.rate_limit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- System can insert rate limit logs (service role)
CREATE POLICY "Service role can insert rate limit logs"
  ON public.rate_limit_logs FOR INSERT
  WITH CHECK (true);

-- Tenant API Credentials for multi-tenant support
CREATE TABLE IF NOT EXISTS public.tenant_api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('ghl', 'twilio', 'telnyx', 'resend', 'stripe')),
  credentials JSONB NOT NULL DEFAULT '{}',
  phone_numbers JSONB DEFAULT '[]',
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_tenant_credentials_lookup ON public.tenant_api_credentials(tenant_id, provider, is_active);

-- Enable RLS
ALTER TABLE public.tenant_api_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only view their own credentials
CREATE POLICY "Users can view own credentials"
  ON public.tenant_api_credentials FOR SELECT
  USING (tenant_id = auth.uid());

-- Users can manage their own credentials
CREATE POLICY "Users can manage own credentials"
  ON public.tenant_api_credentials FOR ALL
  USING (tenant_id = auth.uid());

-- Admins can view all credentials
CREATE POLICY "Admins can view all credentials"
  ON public.tenant_api_credentials FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Team Channel Templates for pre-configured channels
CREATE TABLE IF NOT EXISTS public.team_channel_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  channel_type TEXT DEFAULT 'public' CHECK (channel_type IN ('public', 'private')),
  auto_join_roles TEXT[] DEFAULT ARRAY['user', 'admin'],
  icon_emoji TEXT,
  is_system BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_channel_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view templates
CREATE POLICY "Authenticated users can view channel templates"
  ON public.team_channel_templates FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage templates
CREATE POLICY "Admins can manage channel templates"
  ON public.team_channel_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default channel templates
INSERT INTO public.team_channel_templates (name, display_name, description, icon_emoji, is_system, sort_order) VALUES
  ('general', 'General', 'Company-wide announcements and updates', '📢', true, 1),
  ('maintenance-alerts', 'Maintenance Alerts', 'Automated alerts from work orders and maintenance tickets', '🔧', true, 2),
  ('owner-updates', 'Owner Updates', 'Activity notifications from the owner portal', '🏠', true, 3),
  ('urgent', 'Urgent', 'High-priority items requiring immediate attention', '🚨', true, 4),
  ('daily-standup', 'Daily Standup', 'AI-generated daily summaries and team check-ins', '☀️', true, 5)
ON CONFLICT DO NOTHING;

-- Daily Digest storage for AI-generated summaries
CREATE TABLE IF NOT EXISTS public.team_daily_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.team_channels(id) ON DELETE CASCADE,
  digest_date DATE NOT NULL,
  summary TEXT NOT NULL,
  highlights JSONB DEFAULT '[]',
  tasks_due INTEGER DEFAULT 0,
  visits_scheduled INTEGER DEFAULT 0,
  calls_scheduled INTEGER DEFAULT 0,
  urgent_items JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, digest_date)
);

-- Enable RLS
ALTER TABLE public.team_daily_digests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view digests
CREATE POLICY "Authenticated users can view digests"
  ON public.team_daily_digests FOR SELECT
  TO authenticated
  USING (true);

-- Update timestamp trigger
CREATE TRIGGER update_tenant_credentials_updated_at
  BEFORE UPDATE ON public.tenant_api_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
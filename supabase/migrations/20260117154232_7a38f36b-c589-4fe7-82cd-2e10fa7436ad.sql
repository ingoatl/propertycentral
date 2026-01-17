-- Create slack_channel_config table
CREATE TABLE public.slack_channel_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  allowed_roles TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create slack_messages table for logging
CREATE TABLE public.slack_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_by UUID REFERENCES auth.users(id),
  sender_name TEXT,
  property_id UUID REFERENCES public.properties(id),
  lead_id UUID REFERENCES public.leads(id),
  owner_id UUID REFERENCES public.property_owners(id),
  template_used TEXT,
  slack_message_id TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.slack_channel_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slack_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for slack_channel_config (read for all authenticated, write for admin)
CREATE POLICY "Authenticated users can view active channels"
ON public.slack_channel_config
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage channel config"
ON public.slack_channel_config
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for slack_messages
CREATE POLICY "Authenticated users can view slack messages"
ON public.slack_messages
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can send slack messages"
ON public.slack_messages
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Insert default channel configurations
INSERT INTO public.slack_channel_config (channel_name, display_name, description, allowed_roles) VALUES
  ('#ops-onboarding', 'Ops Onboarding', 'Operations team onboarding updates', ARRAY['admin', 'ops_manager', 'coordinator']),
  ('#finance-onboarding', 'Finance Onboarding', 'Finance team updates', ARRAY['admin', 'bookkeeper']),
  ('#sales-pipeline', 'Sales Pipeline', 'Sales updates and lead progress', ARRAY['admin', 'sales']),
  ('#sales-wins', 'Sales Wins', 'Celebrate closed deals', ARRAY['admin', 'sales', 'ops_manager']),
  ('#team-wins', 'Team Wins', 'Team celebrations and achievements', ARRAY['admin', 'ops_manager', 'coordinator', 'bookkeeper', 'sales']),
  ('#ops-escalation', 'Ops Escalation', 'Escalated issues and blockers', ARRAY['admin', 'ops_manager']),
  ('#owner-urgent', 'Owner Urgent', 'Urgent owner requests', ARRAY['admin', 'ops_manager', 'coordinator']),
  ('#marketing-va', 'Marketing VA', 'Marketing team updates', ARRAY['admin', 'marketing']);

-- Create trigger for updated_at
CREATE TRIGGER update_slack_channel_config_updated_at
  BEFORE UPDATE ON public.slack_channel_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
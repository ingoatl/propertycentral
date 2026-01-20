-- Add workflow channels (from Slack config)
INSERT INTO team_channels (name, display_name, description, channel_type) VALUES
  ('general', 'General', 'General team discussions', 'public'),
  ('maintenance', 'Maintenance', 'Maintenance and work order updates', 'public'),
  ('finance-onboarding', 'Finance Onboarding', 'Finance team updates', 'private'),
  ('marketing-va', 'Marketing VA', 'Marketing team updates', 'private'),
  ('ops-escalation', 'Ops Escalation', 'Escalated issues and blockers', 'private'),
  ('ops-onboarding', 'Ops Onboarding', 'Operations onboarding updates', 'private'),
  ('owner-urgent', 'Owner Urgent', 'Urgent owner requests', 'private'),
  ('sales-pipeline', 'Sales Pipeline', 'Sales updates and lead progress', 'private'),
  ('sales-wins', 'Sales Wins', 'Celebrate closed deals', 'private')
ON CONFLICT (name) DO NOTHING;

-- Add allowed_roles column for role-based channel access
ALTER TABLE team_channels ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] DEFAULT '{}';

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS team_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_enabled BOOLEAN DEFAULT true,
  push_all_messages BOOLEAN DEFAULT false,
  push_mentions_only BOOLEAN DEFAULT true,
  push_dms_only BOOLEAN DEFAULT true,
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  muted_channels UUID[] DEFAULT '{}',
  show_desktop_notifications BOOLEAN DEFAULT true,
  notification_sound BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notification preferences
ALTER TABLE team_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification preferences
CREATE POLICY "Users can view own notification preferences"
ON team_notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
ON team_notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
ON team_notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create team hub invites table
CREATE TABLE IF NOT EXISTS team_hub_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID REFERENCES auth.users(id),
  invitee_email TEXT NOT NULL,
  invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '7 days',
  accepted_at TIMESTAMPTZ
);

-- Enable RLS on invites
ALTER TABLE team_hub_invites ENABLE ROW LEVEL SECURITY;

-- RLS policies for invites (admins can manage, invited users can accept)
CREATE POLICY "Authenticated users can view invites"
ON team_hub_invites FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create invites"
ON team_hub_invites FOR INSERT
WITH CHECK (auth.uid() = inviter_id);

CREATE POLICY "Authenticated users can update invites"
ON team_hub_invites FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at on notification preferences
CREATE OR REPLACE FUNCTION update_team_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_team_notification_preferences_timestamp ON team_notification_preferences;
CREATE TRIGGER update_team_notification_preferences_timestamp
  BEFORE UPDATE ON team_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_team_notification_preferences_updated_at();

-- Add all authenticated users to public channels (general, maintenance)
INSERT INTO team_channel_members (channel_id, user_id)
SELECT tc.id, p.id 
FROM team_channels tc
CROSS JOIN profiles p
WHERE tc.channel_type = 'public'
ON CONFLICT DO NOTHING;
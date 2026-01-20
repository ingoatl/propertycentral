-- ============================================
-- TEAM HUB: Internal Communication System
-- ============================================

-- 1. Team Channels (like Slack channels but internal)
CREATE TABLE IF NOT EXISTS public.team_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  channel_type TEXT DEFAULT 'public' CHECK (channel_type IN ('public', 'private', 'dm')),
  created_by UUID REFERENCES auth.users(id),
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Team Messages (the core message table)
CREATE TABLE IF NOT EXISTS public.team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.team_channels(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  parent_message_id UUID REFERENCES public.team_messages(id),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'file', 'system')),
  file_url TEXT,
  file_name TEXT,
  reactions JSONB DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  property_id UUID REFERENCES public.properties(id),
  lead_id UUID REFERENCES public.leads(id),
  work_order_id UUID REFERENCES public.work_orders(id),
  owner_id UUID REFERENCES public.property_owners(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Channel Membership
CREATE TABLE IF NOT EXISTS public.team_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.team_channels(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  notifications_muted BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- 4. User Presence and Focus Status
CREATE TABLE IF NOT EXISTS public.team_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'away', 'dnd', 'offline')),
  status_text TEXT,
  status_emoji TEXT,
  focus_mode_until TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  current_channel_id UUID REFERENCES public.team_channels(id)
);

-- 5. Push Notification Subscriptions (for web push)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to existing team_notifications if they don't exist
ALTER TABLE public.team_notifications 
  ADD COLUMN IF NOT EXISTS message_id UUID,
  ADD COLUMN IF NOT EXISTS channel_id UUID;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_messages_channel ON public.team_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_sender ON public.team_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_parent ON public.team_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_team_messages_created ON public.team_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_channel_members_user ON public.team_channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

-- Enable RLS
ALTER TABLE public.team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_channels
DROP POLICY IF EXISTS "Users can view public channels and channels they are members of" ON public.team_channels;
CREATE POLICY "Users can view public channels and channels they are members of"
  ON public.team_channels FOR SELECT
  USING (
    channel_type = 'public' 
    OR EXISTS (
      SELECT 1 FROM public.team_channel_members 
      WHERE channel_id = team_channels.id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create channels" ON public.team_channels;
CREATE POLICY "Authenticated users can create channels"
  ON public.team_channels FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Channel admins can update channels" ON public.team_channels;
CREATE POLICY "Channel admins can update channels"
  ON public.team_channels FOR UPDATE
  USING (
    created_by = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.team_channel_members 
      WHERE channel_id = team_channels.id AND user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for team_messages
DROP POLICY IF EXISTS "Users can view messages in channels they have access to" ON public.team_messages;
CREATE POLICY "Users can view messages in channels they have access to"
  ON public.team_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_channels tc
      WHERE tc.id = team_messages.channel_id
      AND (
        tc.channel_type = 'public'
        OR EXISTS (
          SELECT 1 FROM public.team_channel_members 
          WHERE channel_id = tc.id AND user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can send messages to channels they have access to" ON public.team_messages;
CREATE POLICY "Users can send messages to channels they have access to"
  ON public.team_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_channels tc
      WHERE tc.id = team_messages.channel_id
      AND (
        tc.channel_type = 'public'
        OR EXISTS (
          SELECT 1 FROM public.team_channel_members 
          WHERE channel_id = tc.id AND user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can edit their own messages" ON public.team_messages;
CREATE POLICY "Users can edit their own messages"
  ON public.team_messages FOR UPDATE
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own messages" ON public.team_messages;
CREATE POLICY "Users can delete their own messages"
  ON public.team_messages FOR DELETE
  USING (sender_id = auth.uid());

-- RLS Policies for team_channel_members
DROP POLICY IF EXISTS "Users can view channel memberships" ON public.team_channel_members;
CREATE POLICY "Users can view channel memberships"
  ON public.team_channel_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can join public channels" ON public.team_channel_members;
CREATE POLICY "Users can join public channels"
  ON public.team_channel_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_channels 
      WHERE id = channel_id AND channel_type = 'public'
    )
  );

DROP POLICY IF EXISTS "Users can leave channels" ON public.team_channel_members;
CREATE POLICY "Users can leave channels"
  ON public.team_channel_members FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their membership settings" ON public.team_channel_members;
CREATE POLICY "Users can update their membership settings"
  ON public.team_channel_members FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for team_presence
DROP POLICY IF EXISTS "Users can view all presence" ON public.team_presence;
CREATE POLICY "Users can view all presence"
  ON public.team_presence FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert their own presence" ON public.team_presence;
CREATE POLICY "Users can insert their own presence"
  ON public.team_presence FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own presence status" ON public.team_presence;
CREATE POLICY "Users can update their own presence status"
  ON public.team_presence FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for push_subscriptions
DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- Enable realtime for messages and presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_presence;

-- Insert default channels
INSERT INTO public.team_channels (name, display_name, description, channel_type) VALUES
  ('general', 'General', 'Company-wide announcements and discussions', 'public'),
  ('random', 'Random', 'Non-work related chats and fun', 'public'),
  ('maintenance', 'Maintenance', 'Work order discussions and coordination', 'public'),
  ('leasing', 'Leasing', 'Lead and tour coordination', 'public'),
  ('owner-updates', 'Owner Updates', 'Owner communication coordination', 'public'),
  ('wins', 'Wins', 'Celebrate achievements', 'public'),
  ('daily-updates', 'Daily Updates', 'Daily standup and updates', 'public')
ON CONFLICT (name) DO NOTHING;

-- Create trigger for updated_at on team_channels
DROP TRIGGER IF EXISTS update_team_channels_updated_at ON public.team_channels;
CREATE TRIGGER update_team_channels_updated_at
  BEFORE UPDATE ON public.team_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
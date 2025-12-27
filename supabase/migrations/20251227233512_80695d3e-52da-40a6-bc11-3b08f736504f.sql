-- Create user phone assignments table
CREATE TABLE public.user_phone_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  phone_type TEXT NOT NULL DEFAULT 'personal' CHECK (phone_type IN ('personal', 'company')),
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  telnyx_connection_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user phone messages table for per-user SMS inbox
CREATE TABLE public.user_phone_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_assignment_id UUID REFERENCES public.user_phone_assignments(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'received',
  external_id TEXT,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user phone calls table for call logs
CREATE TABLE public.user_phone_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_assignment_id UUID REFERENCES public.user_phone_assignments(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  status TEXT DEFAULT 'initiated',
  duration_seconds INTEGER,
  recording_url TEXT,
  transcription TEXT,
  external_id TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add phone_number to profiles for quick lookup
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_phone_number TEXT;

-- Enable RLS
ALTER TABLE public.user_phone_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_phone_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_phone_calls ENABLE ROW LEVEL SECURITY;

-- RLS for user_phone_assignments - users see their own, admins see all
CREATE POLICY "Users can view their own phone assignments"
  ON public.user_phone_assignments FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage phone assignments"
  ON public.user_phone_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS for user_phone_messages - users see only their own messages
CREATE POLICY "Users can view their own messages"
  ON public.user_phone_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages"
  ON public.user_phone_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages"
  ON public.user_phone_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all messages"
  ON public.user_phone_messages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for user_phone_calls - users see only their own calls
CREATE POLICY "Users can view their own calls"
  ON public.user_phone_calls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calls"
  ON public.user_phone_calls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all calls"
  ON public.user_phone_calls FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_user_phone_messages_user_id ON public.user_phone_messages(user_id);
CREATE INDEX idx_user_phone_messages_created_at ON public.user_phone_messages(created_at DESC);
CREATE INDEX idx_user_phone_calls_user_id ON public.user_phone_calls(user_id);
CREATE INDEX idx_user_phone_calls_started_at ON public.user_phone_calls(started_at DESC);
CREATE INDEX idx_user_phone_assignments_phone ON public.user_phone_assignments(phone_number);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_phone_messages;
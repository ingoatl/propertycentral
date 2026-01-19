-- Create voicemail_messages table for voice message SMS system
CREATE TABLE public.voicemail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES public.property_owners(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  recipient_name TEXT,
  sender_user_id UUID,
  sender_name TEXT,
  message_text TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  audio_source TEXT NOT NULL DEFAULT 'ai_generated' CHECK (audio_source IN ('recording', 'ai_generated')),
  voice_id TEXT DEFAULT 'nPczCjzI2devNBz1zQrb',
  duration_seconds INTEGER,
  sms_sent_at TIMESTAMPTZ,
  sms_message_sid TEXT,
  opened_at TIMESTAMPTZ,
  played_at TIMESTAMPTZ,
  play_count INTEGER DEFAULT 0,
  total_listen_time INTEGER DEFAULT 0,
  callback_clicked BOOLEAN DEFAULT false,
  reply_clicked BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'played', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voicemail_messages ENABLE ROW LEVEL SECURITY;

-- Public read access for voicemail playback (by token)
CREATE POLICY "Public can read voicemails by token" ON public.voicemail_messages
  FOR SELECT USING (true);

-- Authenticated users can create voicemails
CREATE POLICY "Authenticated users can create voicemails" ON public.voicemail_messages
  FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can update their own voicemails
CREATE POLICY "Users can update voicemails" ON public.voicemail_messages
  FOR UPDATE USING (true);

-- Create index for token lookups
CREATE INDEX idx_voicemail_messages_token ON public.voicemail_messages(token);

-- Create index for lead/owner lookups
CREATE INDEX idx_voicemail_messages_lead_id ON public.voicemail_messages(lead_id);
CREATE INDEX idx_voicemail_messages_owner_id ON public.voicemail_messages(owner_id);

-- Create trigger for updated_at
CREATE TRIGGER update_voicemail_messages_updated_at
  BEFORE UPDATE ON public.voicemail_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Create gmail_email_status table for Done/Snooze functionality on emails
CREATE TABLE public.gmail_email_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'done', 'snoozed', 'awaiting')),
  snoozed_until TIMESTAMPTZ,
  priority TEXT CHECK (priority IN ('urgent', 'high', 'normal', 'low', NULL)),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(gmail_message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.gmail_email_status ENABLE ROW LEVEL SECURITY;

-- Users can manage their own email status
CREATE POLICY "Users can view own email status" ON public.gmail_email_status
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email status" ON public.gmail_email_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email status" ON public.gmail_email_status
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email status" ON public.gmail_email_status
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_gmail_email_status_updated_at
BEFORE UPDATE ON public.gmail_email_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
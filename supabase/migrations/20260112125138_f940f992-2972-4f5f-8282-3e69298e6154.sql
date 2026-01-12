-- Create conversation_status table to track inbox zero workflow
CREATE TABLE IF NOT EXISTS public.conversation_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_phone TEXT,
  contact_email TEXT,
  contact_id TEXT,
  contact_type TEXT NOT NULL DEFAULT 'external',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'snoozed', 'done', 'archived')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'important', 'normal', 'low')),
  snoozed_until TIMESTAMP WITH TIME ZONE,
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_inbound_at TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER DEFAULT 0,
  ai_summary TEXT,
  ai_sentiment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id),
  UNIQUE(contact_phone, user_id),
  UNIQUE(contact_email, user_id)
);

-- Create index for efficient lookups
CREATE INDEX idx_conversation_status_contact_phone ON public.conversation_status(contact_phone);
CREATE INDEX idx_conversation_status_contact_email ON public.conversation_status(contact_email);
CREATE INDEX idx_conversation_status_status ON public.conversation_status(status);
CREATE INDEX idx_conversation_status_priority ON public.conversation_status(priority);
CREATE INDEX idx_conversation_status_user ON public.conversation_status(user_id);

-- Enable RLS
ALTER TABLE public.conversation_status ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can manage their own conversation statuses
CREATE POLICY "Users can view their own conversation statuses"
ON public.conversation_status FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversation statuses"
ON public.conversation_status FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversation statuses"
ON public.conversation_status FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversation statuses"
ON public.conversation_status FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_conversation_status_updated_at
BEFORE UPDATE ON public.conversation_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
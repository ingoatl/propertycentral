-- Create table to track incoming call notifications for browser-based answering
CREATE TABLE IF NOT EXISTS public.incoming_call_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_sid TEXT NOT NULL UNIQUE,
  to_user_id UUID REFERENCES auth.users(id),
  from_number TEXT NOT NULL,
  from_name TEXT,
  to_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ringing', -- ringing, answered, missed, declined, forwarded
  ring_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  answered_at TIMESTAMP WITH TIME ZONE,
  expired_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.incoming_call_notifications ENABLE ROW LEVEL SECURITY;

-- Users can see calls routed to them
CREATE POLICY "Users can view their incoming calls"
  ON public.incoming_call_notifications
  FOR SELECT
  USING (to_user_id = auth.uid() OR to_user_id IS NULL);

-- Service role can manage all
CREATE POLICY "Service role can manage all incoming calls"
  ON public.incoming_call_notifications
  FOR ALL
  USING (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.incoming_call_notifications;

-- Index for fast lookups
CREATE INDEX idx_incoming_calls_user_status ON public.incoming_call_notifications(to_user_id, status);
CREATE INDEX idx_incoming_calls_call_sid ON public.incoming_call_notifications(call_sid);
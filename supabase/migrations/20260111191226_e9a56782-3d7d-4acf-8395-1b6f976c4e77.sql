-- Create meeting_recordings table for Recall.ai integration
CREATE TABLE public.meeting_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recall_bot_id TEXT,
  recall_meeting_id TEXT,
  platform TEXT CHECK (platform IN ('zoom', 'google_meet', 'teams', 'webex')),
  meeting_url TEXT,
  meeting_title TEXT,
  host_user_id UUID REFERENCES auth.users(id),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  discovery_call_id UUID REFERENCES public.discovery_calls(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_meeting', 'recording', 'processing', 'completed', 'failed')),
  recording_url TEXT,
  transcript TEXT,
  transcript_summary TEXT,
  duration_seconds INTEGER,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_recordings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view recordings they own or are associated with their leads
CREATE POLICY "Users can view their own recordings"
  ON public.meeting_recordings
  FOR SELECT
  USING (auth.uid() = host_user_id);

CREATE POLICY "Users can insert recordings"
  ON public.meeting_recordings
  FOR INSERT
  WITH CHECK (auth.uid() = host_user_id OR host_user_id IS NULL);

CREATE POLICY "Users can update their own recordings"
  ON public.meeting_recordings
  FOR UPDATE
  USING (auth.uid() = host_user_id);

-- Allow service role to do anything (for webhooks)
CREATE POLICY "Service role full access"
  ON public.meeting_recordings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create index for faster lookups
CREATE INDEX idx_meeting_recordings_recall_bot ON public.meeting_recordings(recall_bot_id);
CREATE INDEX idx_meeting_recordings_lead ON public.meeting_recordings(lead_id);
CREATE INDEX idx_meeting_recordings_discovery_call ON public.meeting_recordings(discovery_call_id);

-- Create trigger for updated_at
CREATE TRIGGER update_meeting_recordings_updated_at
  BEFORE UPDATE ON public.meeting_recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add realtime for meeting recordings
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_recordings;
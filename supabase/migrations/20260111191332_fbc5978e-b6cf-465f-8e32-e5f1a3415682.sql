-- Add missing columns to meeting_recordings for webhook handling
ALTER TABLE public.meeting_recordings
  ADD COLUMN IF NOT EXISTS transcript_segments JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS communication_id UUID REFERENCES public.lead_communications(id),
  ADD COLUMN IF NOT EXISTS matched_owner_id UUID REFERENCES public.property_owners(id),
  ADD COLUMN IF NOT EXISTS matched_lead_id UUID REFERENCES public.leads(id),
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id),
  ADD COLUMN IF NOT EXISTS analyzed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_communication ON public.meeting_recordings(communication_id);
CREATE INDEX IF NOT EXISTS idx_meeting_recordings_analyzed ON public.meeting_recordings(analyzed) WHERE analyzed = false;
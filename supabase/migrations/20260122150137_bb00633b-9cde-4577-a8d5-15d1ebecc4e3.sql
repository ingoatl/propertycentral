-- Create owner_calls table for owner meeting scheduling
CREATE TABLE public.owner_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.property_owners(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  topic TEXT,
  topic_details TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  meeting_notes TEXT,
  google_calendar_event_id TEXT,
  google_meet_link TEXT,
  confirmation_sent BOOLEAN DEFAULT false,
  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_1h_sent BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  rescheduled_at TIMESTAMPTZ,
  reschedule_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add calendar_type to availability_slots to distinguish between discovery and owner calendars
ALTER TABLE public.availability_slots 
ADD COLUMN IF NOT EXISTS calendar_type TEXT NOT NULL DEFAULT 'discovery';

-- Create index for efficient querying
CREATE INDEX idx_owner_calls_scheduled_at ON public.owner_calls(scheduled_at);
CREATE INDEX idx_owner_calls_owner_id ON public.owner_calls(owner_id);
CREATE INDEX idx_owner_calls_status ON public.owner_calls(status);
CREATE INDEX idx_owner_calls_email ON public.owner_calls(contact_email);
CREATE INDEX idx_availability_slots_calendar_type ON public.availability_slots(calendar_type);

-- Enable RLS
ALTER TABLE public.owner_calls ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view and manage owner calls
CREATE POLICY "Authenticated users can view owner calls"
ON public.owner_calls FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert owner calls"
ON public.owner_calls FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update owner calls"
ON public.owner_calls FOR UPDATE
TO authenticated
USING (true);

-- Allow public to insert (for booking page)
CREATE POLICY "Public can book owner calls"
ON public.owner_calls FOR INSERT
TO anon
WITH CHECK (true);

-- Insert default owner call availability slots (Mon-Fri 11am-5pm EST)
-- These will be used specifically for owner calendars
INSERT INTO public.availability_slots (day_of_week, start_time, end_time, is_active, calendar_type)
VALUES 
  (1, '11:00', '17:00', true, 'owner'),
  (2, '11:00', '17:00', true, 'owner'),
  (3, '11:00', '17:00', true, 'owner'),
  (4, '11:00', '17:00', true, 'owner'),
  (5, '11:00', '17:00', true, 'owner');

-- Create trigger for updated_at
CREATE TRIGGER update_owner_calls_updated_at
BEFORE UPDATE ON public.owner_calls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
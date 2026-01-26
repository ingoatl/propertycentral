-- Create team_appointments table for manually scheduled appointments
CREATE TABLE public.team_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  -- Type & Details
  appointment_type TEXT NOT NULL DEFAULT 'on_site',
  title TEXT NOT NULL,
  description TEXT,
  -- Location
  property_id UUID REFERENCES properties(id),
  location_address TEXT,
  -- Contact (optional)
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  lead_id UUID REFERENCES leads(id),
  owner_id UUID REFERENCES property_owners(id),
  -- Status
  status TEXT NOT NULL DEFAULT 'scheduled',
  -- Integration
  google_calendar_event_id TEXT,
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_appointments ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated users can view all appointments
CREATE POLICY "Authenticated users can view appointments"
  ON public.team_appointments FOR SELECT TO authenticated USING (true);

-- RLS: Admins can create appointments
CREATE POLICY "Admins can create appointments"
  ON public.team_appointments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS: Admins can update any appointment
CREATE POLICY "Admins can update appointments"
  ON public.team_appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Admins can delete appointments
CREATE POLICY "Admins can delete appointments"
  ON public.team_appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: Users can update their assigned appointments (mark complete, add notes)
CREATE POLICY "Users can update assigned appointments"
  ON public.team_appointments FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid());

-- Index for calendar queries
CREATE INDEX idx_team_appointments_scheduled 
  ON team_appointments(scheduled_at, assigned_to);

CREATE INDEX idx_team_appointments_property
  ON team_appointments(property_id);

-- Updated at trigger
CREATE TRIGGER update_team_appointments_updated_at
  BEFORE UPDATE ON public.team_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_appointments;
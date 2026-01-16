-- Create appointment reschedule audit log table
CREATE TABLE public.appointment_reschedule_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL,
  appointment_type TEXT NOT NULL CHECK (appointment_type IN ('discovery_call', 'inspection', 'visit')),
  previous_scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  new_scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT,
  reschedule_notes TEXT,
  rescheduled_by UUID REFERENCES auth.users(id),
  rescheduled_by_name TEXT,
  rescheduled_by_type TEXT NOT NULL DEFAULT 'admin' CHECK (rescheduled_by_type IN ('admin', 'client', 'system')),
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  google_calendar_updated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for fast lookups
CREATE INDEX idx_appointment_reschedule_logs_appointment ON appointment_reschedule_logs(appointment_id);
CREATE INDEX idx_appointment_reschedule_logs_created ON appointment_reschedule_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.appointment_reschedule_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage logs
CREATE POLICY "Admins can manage reschedule logs"
ON public.appointment_reschedule_logs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Add comment
COMMENT ON TABLE public.appointment_reschedule_logs IS 'Audit trail for all appointment reschedules including who made the change and reason';
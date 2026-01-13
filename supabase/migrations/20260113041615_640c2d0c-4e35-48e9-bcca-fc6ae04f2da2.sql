
-- Create user_calendar_settings table to store per-user Google Calendar settings
CREATE TABLE public.user_calendar_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    google_calendar_connected BOOLEAN DEFAULT false,
    pipedream_external_id TEXT,
    default_calendar_id TEXT DEFAULT 'primary',
    calendar_email TEXT,
    receives_discovery_calls BOOLEAN DEFAULT false,
    receives_inspections BOOLEAN DEFAULT false,
    receives_team_meetings BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_calendar_settings ENABLE ROW LEVEL SECURITY;

-- Users can view and update their own settings
CREATE POLICY "Users can view their own calendar settings"
ON public.user_calendar_settings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar settings"
ON public.user_calendar_settings FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar settings"
ON public.user_calendar_settings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view and manage all settings
CREATE POLICY "Admins can view all calendar settings"
ON public.user_calendar_settings FOR SELECT
USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
));

CREATE POLICY "Admins can update all calendar settings"
ON public.user_calendar_settings FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
));

-- Create index for faster lookups
CREATE INDEX idx_user_calendar_settings_user_id ON public.user_calendar_settings(user_id);
CREATE INDEX idx_user_calendar_settings_receives_inspections ON public.user_calendar_settings(receives_inspections) WHERE receives_inspections = true;

-- Update trigger for updated_at
CREATE TRIGGER update_user_calendar_settings_updated_at
BEFORE UPDATE ON public.user_calendar_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add inspection_assigned_to column to leads table to track who handles the inspection
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS inspection_assigned_to UUID REFERENCES profiles(id);

-- Insert initial settings for Ingo (should receive inspections)
INSERT INTO public.user_calendar_settings (user_id, receives_inspections, receives_discovery_calls)
SELECT id, true, true FROM profiles WHERE email = 'ingo@peachhausgroup.com'
ON CONFLICT (user_id) DO UPDATE SET receives_inspections = true, receives_discovery_calls = true;

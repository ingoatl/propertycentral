-- Team Routing table for IVR operator
CREATE TABLE IF NOT EXISTS public.team_routing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  display_name TEXT NOT NULL,
  ghl_number TEXT NOT NULL,
  forward_to_number TEXT,
  forward_to_browser BOOLEAN DEFAULT false,
  voicemail_enabled BOOLEAN DEFAULT true,
  dtmf_digit TEXT, -- e.g., "1" for "Press 1 for Alex"
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_routing ENABLE ROW LEVEL SECURITY;

-- Policies for team routing
CREATE POLICY "Team routing is viewable by authenticated users"
ON public.team_routing FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage team routing"
ON public.team_routing FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_team_routing_updated_at
BEFORE UPDATE ON public.team_routing
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial team routing data
INSERT INTO public.team_routing (display_name, ghl_number, forward_to_number, dtmf_digit, is_active) VALUES
('Alex', '+14043415202', '+14043415202', '1', true),
('Anja', '+14708638087', '+14708638087', '2', true),
('Ingo', '+16784987376', '+16784987376', '3', true)
ON CONFLICT DO NOTHING;
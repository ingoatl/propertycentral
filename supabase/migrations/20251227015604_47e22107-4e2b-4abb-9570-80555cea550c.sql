-- Create table for discovery call availability slots
CREATE TABLE public.availability_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for scheduled discovery calls
CREATE TABLE public.discovery_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  scheduled_by UUID REFERENCES auth.users(id),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 15,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  meeting_notes TEXT,
  reminder_sent BOOLEAN DEFAULT false,
  confirmation_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovery_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies for availability_slots
CREATE POLICY "Users can view all availability slots"
ON public.availability_slots FOR SELECT
USING (true);

CREATE POLICY "Users can manage their own availability"
ON public.availability_slots FOR ALL
USING (auth.uid() = user_id);

-- RLS policies for discovery_calls
CREATE POLICY "Authenticated users can view discovery calls"
ON public.discovery_calls FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create discovery calls"
ON public.discovery_calls FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update discovery calls"
ON public.discovery_calls FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Indexes for performance
CREATE INDEX idx_discovery_calls_lead_id ON public.discovery_calls(lead_id);
CREATE INDEX idx_discovery_calls_scheduled_at ON public.discovery_calls(scheduled_at);
CREATE INDEX idx_availability_slots_day ON public.availability_slots(day_of_week);

-- Update trigger for timestamps
CREATE TRIGGER update_availability_slots_updated_at
BEFORE UPDATE ON public.availability_slots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_discovery_calls_updated_at
BEFORE UPDATE ON public.discovery_calls
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
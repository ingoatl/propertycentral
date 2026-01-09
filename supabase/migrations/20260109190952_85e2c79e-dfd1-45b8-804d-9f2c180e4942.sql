-- Create positive_events table to track good things happening at properties
CREATE TABLE public.positive_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.property_owners(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- booking_confirmed, great_review, issue_resolved, monthly_summary
  event_title TEXT NOT NULL,
  event_description TEXT,
  event_data JSONB,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create owner_notifications table to track what we've told owners
CREATE TABLE public.owner_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.property_owners(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  positive_event_id UUID REFERENCES public.positive_events(id) ON DELETE SET NULL,
  notification_type TEXT NOT NULL, -- sms, email
  notification_channel TEXT NOT NULL DEFAULT 'sms',
  message TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.positive_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for positive_events - admin only
CREATE POLICY "Admins can view positive_events" ON public.positive_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert positive_events" ON public.positive_events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update positive_events" ON public.positive_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- RLS policies for owner_notifications - admin only
CREATE POLICY "Admins can view owner_notifications" ON public.owner_notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert owner_notifications" ON public.owner_notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update owner_notifications" ON public.owner_notifications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Create indexes for better performance
CREATE INDEX idx_positive_events_owner_id ON public.positive_events(owner_id);
CREATE INDEX idx_positive_events_property_id ON public.positive_events(property_id);
CREATE INDEX idx_positive_events_occurred_at ON public.positive_events(occurred_at DESC);
CREATE INDEX idx_owner_notifications_owner_id ON public.owner_notifications(owner_id);
CREATE INDEX idx_owner_notifications_status ON public.owner_notifications(status);
CREATE INDEX idx_owner_notifications_created_at ON public.owner_notifications(created_at DESC);
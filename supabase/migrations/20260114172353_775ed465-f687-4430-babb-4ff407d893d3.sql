-- Add assigned_to column to lead_communications for team assignment tracking
ALTER TABLE public.lead_communications 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES auth.users(id);

-- Create team_notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS public.team_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'assignment',
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  communication_id UUID REFERENCES public.lead_communications(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on team_notifications
ALTER TABLE public.team_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.team_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
ON public.team_notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Authenticated users can create notifications for others
CREATE POLICY "Authenticated users can create notifications"
ON public.team_notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for faster notification queries
CREATE INDEX IF NOT EXISTS idx_team_notifications_user_id ON public.team_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_team_notifications_unread ON public.team_notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_lead_communications_assigned_to ON public.lead_communications(assigned_to);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_notifications;
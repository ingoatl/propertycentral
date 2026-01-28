-- Add assigned_to column for task delegation
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id);
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id);
ALTER TABLE public.user_tasks ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;

-- Create task notifications table for real-time alerts
CREATE TABLE IF NOT EXISTS public.task_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.user_tasks(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'assignment', -- assignment, reminder, mention
  title text NOT NULL,
  message text,
  is_read boolean DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on task_notifications
ALTER TABLE public.task_notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications"
  ON public.task_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications"
  ON public.task_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Any authenticated user can create notifications (for task assignment)
CREATE POLICY "Authenticated users can create notifications"
  ON public.task_notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_notifications;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_task_notifications_user_unread 
  ON public.task_notifications(user_id, is_read) 
  WHERE is_read = false;

-- Update user_tasks RLS to allow assigned users to view their tasks
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.user_tasks;
CREATE POLICY "Users can view own or assigned tasks"
  ON public.user_tasks FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = assigned_to);

DROP POLICY IF EXISTS "Users can update their own tasks" ON public.user_tasks;
CREATE POLICY "Users can update own or assigned tasks"
  ON public.user_tasks FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = assigned_to);
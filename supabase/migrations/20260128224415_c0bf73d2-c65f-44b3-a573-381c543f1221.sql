-- Create task_comments table for collaboration on tasks
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.user_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Create policies - users can see comments on tasks they own or are assigned to
CREATE POLICY "Users can view comments on their tasks"
ON public.task_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_tasks t 
    WHERE t.id = task_id 
    AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR t.assigned_by = auth.uid())
  )
);

-- Users can create comments on tasks they're involved with
CREATE POLICY "Users can create comments on their tasks"
ON public.task_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.user_tasks t 
    WHERE t.id = task_id 
    AND (t.user_id = auth.uid() OR t.assigned_to = auth.uid() OR t.assigned_by = auth.uid())
  )
);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
ON public.task_comments
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete their own comments"
ON public.task_comments
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_task_comments_updated_at
BEFORE UPDATE ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for efficient queries
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_comments_user_id ON public.task_comments(user_id);

-- Add reminder fields to user_tasks for assignees
ALTER TABLE public.user_tasks 
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMP WITH TIME ZONE;
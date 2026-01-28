-- Create user_tasks table for personal task management
CREATE TABLE public.user_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  source_type TEXT, -- 'meeting', 'call', 'email', 'manual', 'ai_suggested'
  source_id UUID, -- Reference to meeting_recordings, lead_communications, etc.
  related_contact_type TEXT, -- 'lead', 'owner', 'vendor'
  related_contact_id UUID,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tasks
CREATE POLICY "Users see own tasks" ON public.user_tasks
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create tasks for themselves
CREATE POLICY "Users create own tasks" ON public.user_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own tasks
CREATE POLICY "Users update own tasks" ON public.user_tasks
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own tasks
CREATE POLICY "Users delete own tasks" ON public.user_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_user_tasks_user_id ON public.user_tasks(user_id);
CREATE INDEX idx_user_tasks_status ON public.user_tasks(status);
CREATE INDEX idx_user_tasks_due_date ON public.user_tasks(due_date);
CREATE INDEX idx_user_tasks_priority ON public.user_tasks(priority);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_user_tasks_updated_at
  BEFORE UPDATE ON public.user_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
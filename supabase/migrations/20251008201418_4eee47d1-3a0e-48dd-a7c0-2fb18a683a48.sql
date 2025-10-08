-- Create onboarding projects table
CREATE TABLE IF NOT EXISTS public.onboarding_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL,
  property_address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed')),
  progress NUMERIC DEFAULT 0,
  webhook_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create onboarding tasks table
CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  phase_number INTEGER NOT NULL CHECK (phase_number >= 1 AND phase_number <= 9),
  phase_title TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  field_type TEXT NOT NULL DEFAULT 'text' CHECK (field_type IN ('text', 'textarea', 'checkbox', 'date', 'file', 'currency', 'phone', 'radio', 'multiselect')),
  assigned_to TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'overdue')),
  due_date DATE,
  completed_date TIMESTAMPTZ,
  notes TEXT,
  field_value TEXT,
  file_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create onboarding comments table
CREATE TABLE IF NOT EXISTS public.onboarding_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for onboarding_projects
CREATE POLICY "Approved users can view all onboarding projects"
  ON public.onboarding_projects FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can insert onboarding projects"
  ON public.onboarding_projects FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can update onboarding projects"
  ON public.onboarding_projects FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can delete onboarding projects"
  ON public.onboarding_projects FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  ));

-- RLS Policies for onboarding_tasks
CREATE POLICY "Approved users can view all onboarding tasks"
  ON public.onboarding_tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can insert onboarding tasks"
  ON public.onboarding_tasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can update onboarding tasks"
  ON public.onboarding_tasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can delete onboarding tasks"
  ON public.onboarding_tasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  ));

-- RLS Policies for onboarding_comments
CREATE POLICY "Approved users can view all onboarding comments"
  ON public.onboarding_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  ));

CREATE POLICY "Approved users can insert onboarding comments"
  ON public.onboarding_comments FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'
  ));

-- Create indexes for better performance
CREATE INDEX idx_onboarding_tasks_project_id ON public.onboarding_tasks(project_id);
CREATE INDEX idx_onboarding_tasks_phase_number ON public.onboarding_tasks(phase_number);
CREATE INDEX idx_onboarding_comments_task_id ON public.onboarding_comments(task_id);
CREATE INDEX idx_onboarding_projects_property_id ON public.onboarding_projects(property_id);
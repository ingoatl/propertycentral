-- ============================================
-- PHASE 1: TEAM MATRIX FOUNDATION - DATABASE SCHEMA
-- ============================================

-- 1. Create team roles table
CREATE TABLE public.team_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on team_roles
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_roles
CREATE POLICY "Approved users can view team roles"
ON public.team_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can insert team roles"
ON public.team_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update team roles"
ON public.team_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete team roles"
ON public.team_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Create user team roles table (links users to their roles)
CREATE TABLE public.user_team_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.team_roles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- Enable RLS on user_team_roles
ALTER TABLE public.user_team_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_team_roles
CREATE POLICY "Approved users can view team role assignments"
ON public.user_team_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can insert team role assignments"
ON public.user_team_roles FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update team role assignments"
ON public.user_team_roles FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete team role assignments"
ON public.user_team_roles FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Create phase role assignments table (The Team Matrix)
CREATE TABLE public.phase_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_number INTEGER NOT NULL CHECK (phase_number >= 1 AND phase_number <= 9),
  phase_title TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES public.team_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(phase_number)
);

-- Enable RLS on phase_role_assignments
ALTER TABLE public.phase_role_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for phase_role_assignments
CREATE POLICY "Approved users can view phase assignments"
ON public.phase_role_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can insert phase assignments"
ON public.phase_role_assignments FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update phase assignments"
ON public.phase_role_assignments FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete phase assignments"
ON public.phase_role_assignments FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Create task templates table (task-level assignment overrides)
CREATE TABLE public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_number INTEGER NOT NULL CHECK (phase_number >= 1 AND phase_number <= 9),
  task_title TEXT NOT NULL,
  default_role_id UUID REFERENCES public.team_roles(id) ON DELETE SET NULL,
  field_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(phase_number, task_title)
);

-- Enable RLS on task_templates
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for task_templates
CREATE POLICY "Approved users can view task templates"
ON public.task_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can insert task templates"
ON public.task_templates FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update task templates"
ON public.task_templates FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete task templates"
ON public.task_templates FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Modify profiles table to add first_name
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;

-- 6. Modify onboarding_tasks table
-- Add new columns for team assignment
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS assigned_to_uuid UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS assigned_role_id UUID REFERENCES public.team_roles(id) ON DELETE SET NULL;
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS requires_proof BOOLEAN DEFAULT true;
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS max_reschedule_weeks INTEGER DEFAULT 4;
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS original_due_date DATE;

-- 7. Seed default team roles
INSERT INTO public.team_roles (role_name, description) VALUES
  ('Bookkeeper', 'Handles financial documentation, insurance, and permits'),
  ('Ops Manager', 'Manages operations, utilities, and services'),
  ('Marketing VA', 'Handles listings, photos, and marketing materials'),
  ('Access Manager', 'Manages property access, keys, and codes'),
  ('Cleaner Coordinator', 'Coordinates cleaning and maintenance schedules')
ON CONFLICT (role_name) DO NOTHING;

-- 8. Extract first names from existing user emails
UPDATE public.profiles 
SET first_name = SPLIT_PART(email, '@', 1)
WHERE first_name IS NULL;

-- 9. Update handle_new_user function to extract first_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _is_admin_email BOOLEAN;
  _first_name TEXT;
BEGIN
  -- Check if this is an admin email
  _is_admin_email := NEW.email IN ('admin@peachhausgroup.com', 'anja@peachhausgroup.com');
  
  -- Extract first name from email (text before @)
  _first_name := SPLIT_PART(NEW.email, '@', 1);
  
  -- Insert profile with approved status for admin emails, pending for others
  INSERT INTO public.profiles (id, email, first_name, status, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    _first_name,
    CASE WHEN _is_admin_email THEN 'approved'::account_status ELSE 'pending'::account_status END,
    false
  );
  
  -- Grant admin role to admin emails
  IF _is_admin_email THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Grant user role to regular users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- 10. Set default due dates for existing tasks (1 week out)
UPDATE public.onboarding_tasks
SET 
  due_date = COALESCE(due_date, created_at::date + INTERVAL '7 days'),
  original_due_date = COALESCE(original_due_date, created_at::date + INTERVAL '7 days')
WHERE status != 'completed';
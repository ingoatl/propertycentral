-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents recursive RLS issues)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.user_roles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update profiles RLS policies to use has_role function
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update profiles"
  ON public.profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user function to auto-grant admin role and approve specific emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin_email BOOLEAN;
BEGIN
  -- Check if this is an admin email
  _is_admin_email := NEW.email IN ('ingo@peachhausgroup.com', 'anja@peachhausgroup.com');
  
  -- Insert profile with approved status for admin emails, pending for others
  INSERT INTO public.profiles (id, email, status, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN _is_admin_email THEN 'approved'::account_status ELSE 'pending'::account_status END,
    false  -- Keep this for backward compatibility but use user_roles table instead
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

-- Set up existing admin account (ingo@peachhausgroup.com)
-- Update their status to approved and grant admin role
DO $$
DECLARE
  ingo_user_id UUID;
  anja_user_id UUID;
BEGIN
  -- Get ingo's user ID
  SELECT id INTO ingo_user_id
  FROM auth.users
  WHERE email = 'ingo@peachhausgroup.com';
  
  -- If ingo exists, approve and grant admin
  IF ingo_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET status = 'approved'
    WHERE id = ingo_user_id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (ingo_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- Get anja's user ID (if account exists)
  SELECT id INTO anja_user_id
  FROM auth.users
  WHERE email = 'anja@peachhausgroup.com';
  
  -- If anja exists, approve and grant admin
  IF anja_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET status = 'approved'
    WHERE id = anja_user_id;
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (anja_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;
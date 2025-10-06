-- Create enum for account status
CREATE TYPE public.account_status AS ENUM ('pending', 'approved', 'rejected');

-- Create profiles table to track user approval status
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status account_status NOT NULL DEFAULT 'pending',
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Allow admins to update profiles (for approval)
CREATE POLICY "Admins can update profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, status, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    'pending',
    false
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_timestamp
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_updated_at();

-- Update existing tables to only allow approved users
DROP POLICY IF EXISTS "Users can view all properties" ON properties;
DROP POLICY IF EXISTS "Users can insert their own properties" ON properties;
DROP POLICY IF EXISTS "Users can update their own properties" ON properties;
DROP POLICY IF EXISTS "Users can delete their own properties" ON properties;

CREATE POLICY "Approved users can view all properties"
ON properties FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can insert their own properties"
ON properties FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can update their own properties"
ON properties FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can delete their own properties"
ON properties FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

-- Update visits policies
DROP POLICY IF EXISTS "Users can view all visits" ON visits;
DROP POLICY IF EXISTS "Users can insert their own visits" ON visits;
DROP POLICY IF EXISTS "Users can update their own visits" ON visits;
DROP POLICY IF EXISTS "Users can delete their own visits" ON visits;

CREATE POLICY "Approved users can view all visits"
ON visits FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can insert their own visits"
ON visits FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can update their own visits"
ON visits FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can delete their own visits"
ON visits FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

-- Update expenses policies
DROP POLICY IF EXISTS "Users can view all expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete their own expenses" ON expenses;

CREATE POLICY "Approved users can view all expenses"
ON expenses FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can insert their own expenses"
ON expenses FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can update their own expenses"
ON expenses FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can delete their own expenses"
ON expenses FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

-- Update storage policies for approved users
DROP POLICY IF EXISTS "Authenticated users can view expense documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload expense documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update expense documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete expense documents" ON storage.objects;

CREATE POLICY "Approved users can view expense documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can upload expense documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can update expense documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'expense-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);

CREATE POLICY "Approved users can delete expense documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'expense-documents' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status = 'approved'
  )
);
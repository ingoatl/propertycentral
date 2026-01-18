-- Allow admins to view ALL tone profiles
CREATE POLICY "Admins can view all tone profiles" 
ON public.user_tone_profiles 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update tone profiles (for re-analysis)
CREATE POLICY "Admins can update tone profiles" 
ON public.user_tone_profiles 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert tone profiles for any user
CREATE POLICY "Admins can insert tone profiles" 
ON public.user_tone_profiles 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));
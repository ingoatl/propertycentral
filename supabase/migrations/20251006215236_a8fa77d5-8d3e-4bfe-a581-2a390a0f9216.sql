-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Approved users can update their own properties" ON public.properties;
DROP POLICY IF EXISTS "Approved users can insert their own properties" ON public.properties;
DROP POLICY IF EXISTS "Approved users can delete their own properties" ON public.properties;

-- Create new policies that allow admins to manage all properties
-- and regular users to manage their own

CREATE POLICY "Admins can update all properties"
ON public.properties
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can update their own properties"
ON public.properties
FOR UPDATE
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can insert properties"
ON public.properties
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can insert their own properties"
ON public.properties
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can delete all properties"
ON public.properties
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Users can delete their own properties"
ON public.properties
FOR DELETE
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);
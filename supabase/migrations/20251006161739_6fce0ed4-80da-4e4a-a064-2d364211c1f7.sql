-- Enable auto-confirm for email signups (for easier testing)
-- This will be configured via Supabase settings

-- Make expense-documents storage bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'expense-documents';

-- Drop all existing "Anyone can..." policies that allow public access
DROP POLICY IF EXISTS "Anyone can delete properties" ON properties;
DROP POLICY IF EXISTS "Anyone can insert properties" ON properties;
DROP POLICY IF EXISTS "Anyone can update properties" ON properties;
DROP POLICY IF EXISTS "Anyone can view properties" ON properties;

DROP POLICY IF EXISTS "Anyone can delete visits" ON visits;
DROP POLICY IF EXISTS "Anyone can insert visits" ON visits;
DROP POLICY IF EXISTS "Anyone can update visits" ON visits;
DROP POLICY IF EXISTS "Anyone can view visits" ON visits;

DROP POLICY IF EXISTS "Anyone can delete expenses" ON expenses;
DROP POLICY IF EXISTS "Anyone can insert expenses" ON expenses;
DROP POLICY IF EXISTS "Anyone can update expenses" ON expenses;
DROP POLICY IF EXISTS "Anyone can view expenses" ON expenses;

-- Add user_id columns to track ownership (nullable for now to preserve existing data)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create authenticated user policies for properties
CREATE POLICY "Users can view all properties"
ON properties FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own properties"
ON properties FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own properties"
ON properties FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own properties"
ON properties FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create authenticated user policies for visits
CREATE POLICY "Users can view all visits"
ON visits FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own visits"
ON visits FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own visits"
ON visits FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own visits"
ON visits FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create authenticated user policies for expenses
CREATE POLICY "Users can view all expenses"
ON expenses FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own expenses"
ON expenses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
ON expenses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own expenses"
ON expenses FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Secure storage bucket with authenticated access
DROP POLICY IF EXISTS "Anyone can view expense documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload expense documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update expense documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete expense documents" ON storage.objects;

CREATE POLICY "Authenticated users can view expense documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'expense-documents');

CREATE POLICY "Authenticated users can upload expense documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'expense-documents');

CREATE POLICY "Authenticated users can update expense documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'expense-documents');

CREATE POLICY "Authenticated users can delete expense documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'expense-documents');

-- Add database constraints for data validation
ALTER TABLE properties
ADD CONSTRAINT check_name_length CHECK (char_length(name) <= 200),
ADD CONSTRAINT check_address_length CHECK (char_length(address) <= 500),
ADD CONSTRAINT check_visit_price_positive CHECK (visit_price >= 0 AND visit_price <= 10000);

ALTER TABLE expenses
ADD CONSTRAINT check_amount_positive CHECK (amount > 0 AND amount <= 1000000),
ADD CONSTRAINT check_purpose_length CHECK (char_length(purpose) <= 2000);

ALTER TABLE visits
ADD CONSTRAINT check_price_positive CHECK (price > 0 AND price <= 10000),
ADD CONSTRAINT check_notes_length CHECK (char_length(notes) <= 2000);
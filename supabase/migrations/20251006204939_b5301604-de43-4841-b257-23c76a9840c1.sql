-- Add phone number field to property_owners table
ALTER TABLE public.property_owners
ADD COLUMN phone TEXT;
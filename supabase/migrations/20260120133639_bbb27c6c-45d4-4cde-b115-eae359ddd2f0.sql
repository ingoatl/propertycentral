-- Add vendor_access_code to property_maintenance_book table
ALTER TABLE public.property_maintenance_book
ADD COLUMN IF NOT EXISTS vendor_access_code TEXT;
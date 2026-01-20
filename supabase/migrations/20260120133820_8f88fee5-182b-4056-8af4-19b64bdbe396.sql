-- Add vendor_access_code to work_orders table
ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS vendor_access_code TEXT;
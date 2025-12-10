-- Add service_address column to utility_readings table
ALTER TABLE public.utility_readings 
ADD COLUMN IF NOT EXISTS service_address TEXT;
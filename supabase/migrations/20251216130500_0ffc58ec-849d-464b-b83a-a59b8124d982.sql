-- Add offboarding columns to properties table
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS offboarded_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS offboarding_reason TEXT NULL,
ADD COLUMN IF NOT EXISTS offboarding_notes TEXT NULL;
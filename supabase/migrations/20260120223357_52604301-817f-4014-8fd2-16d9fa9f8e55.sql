-- Add has_payment_method column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_payment_method boolean DEFAULT false;
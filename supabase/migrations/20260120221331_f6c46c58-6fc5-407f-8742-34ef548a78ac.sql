-- Add stripe_customer_id column to leads table for storing Stripe customer ID after authorization
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Add payment_method column to track what payment method was authorized (card/ach)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS payment_method text;
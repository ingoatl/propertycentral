-- Add has_payment_method boolean to track actual payment method presence in Stripe
ALTER TABLE public.property_owners 
ADD COLUMN IF NOT EXISTS has_payment_method boolean DEFAULT false;

-- Update existing owners based on known actual payment method status from Stripe sync
-- These 4 owners have actual payment methods attached in Stripe
UPDATE public.property_owners SET has_payment_method = true 
WHERE id IN (
  '6b3a601c-e574-4a33-92fa-cb37e9d81f71',  -- Ingo Schaer
  'f539f8fa-ecbe-4355-9f11-4d01715c4f6d',  -- Marc Sikora
  '1165d79a-d2f5-4fb7-901e-bcb8c39f7ef5',  -- John Hackney
  '5748d32b-bf31-4073-bd4e-3640bb992860'   -- Eric Ha
);

-- Set all others to false (they have customer IDs but no payment methods)
UPDATE public.property_owners SET has_payment_method = false 
WHERE has_payment_method IS NULL OR id NOT IN (
  '6b3a601c-e574-4a33-92fa-cb37e9d81f71',
  'f539f8fa-ecbe-4355-9f11-4d01715c4f6d',
  '1165d79a-d2f5-4fb7-901e-bcb8c39f7ef5',
  '5748d32b-bf31-4073-bd4e-3640bb992860'
);
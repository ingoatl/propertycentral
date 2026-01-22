-- Drop the existing check constraint
ALTER TABLE property_owners DROP CONSTRAINT IF EXISTS property_owners_payment_method_check;

-- Add an updated check constraint that allows 'pending' and 'none' for new owners
ALTER TABLE property_owners ADD CONSTRAINT property_owners_payment_method_check 
CHECK (payment_method = ANY (ARRAY['card'::text, 'ach'::text, 'pending'::text, 'none'::text]));

-- Make payment_method nullable so new owners can be created without it
ALTER TABLE property_owners ALTER COLUMN payment_method DROP NOT NULL;

-- Set a default for future inserts
ALTER TABLE property_owners ALTER COLUMN payment_method SET DEFAULT 'pending';
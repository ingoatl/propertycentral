-- Update rental_type constraint and existing data
ALTER TABLE public.properties
DROP CONSTRAINT IF EXISTS properties_rental_type_check;

-- Update existing short_term to hybrid
UPDATE public.properties
SET rental_type = 'hybrid'
WHERE rental_type = 'short_term';

-- Add new constraint with hybrid instead of short_term
ALTER TABLE public.properties
ADD CONSTRAINT properties_rental_type_check 
CHECK (rental_type IN ('hybrid', 'mid_term', 'long_term'));
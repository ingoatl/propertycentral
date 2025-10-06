-- Add rental_type column to properties table
ALTER TABLE public.properties
ADD COLUMN rental_type TEXT CHECK (rental_type IN ('short_term', 'mid_term'));

-- Set default value for existing properties
UPDATE public.properties
SET rental_type = 'short_term'
WHERE rental_type IS NULL;
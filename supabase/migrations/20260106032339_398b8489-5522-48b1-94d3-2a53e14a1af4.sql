-- Drop the old constraint and add a new one that includes 'mid_term'
ALTER TABLE property_owners DROP CONSTRAINT IF EXISTS property_owners_service_type_check;

ALTER TABLE property_owners ADD CONSTRAINT property_owners_service_type_check 
CHECK (service_type = ANY (ARRAY['cohosting'::text, 'full_service'::text, 'mid_term'::text]));
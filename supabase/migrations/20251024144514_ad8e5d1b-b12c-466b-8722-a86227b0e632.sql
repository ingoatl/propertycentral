-- Add property_type column to properties table
CREATE TYPE property_type AS ENUM ('Client-Managed', 'Company-Owned', 'Inactive');

ALTER TABLE properties 
ADD COLUMN property_type property_type DEFAULT 'Client-Managed';

-- Update existing managed properties to Client-Managed (muirfield, timberlake)
UPDATE properties 
SET property_type = 'Client-Managed' 
WHERE LOWER(name) IN ('muirfield', 'timberlake');

-- Update other existing properties to Company-Owned by default
UPDATE properties 
SET property_type = 'Company-Owned' 
WHERE LOWER(name) NOT IN ('muirfield', 'timberlake');
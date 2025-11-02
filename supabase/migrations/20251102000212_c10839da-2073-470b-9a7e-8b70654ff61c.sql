-- Add management_fee_percentage column to properties table
ALTER TABLE properties 
ADD COLUMN management_fee_percentage DECIMAL(5,2) DEFAULT 15.00 NOT NULL;

COMMENT ON COLUMN properties.management_fee_percentage IS 'Management fee percentage for this property (e.g., 15.00 for 15%)';
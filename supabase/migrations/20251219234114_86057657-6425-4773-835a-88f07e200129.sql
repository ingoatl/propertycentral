-- Add unique constraint to prevent duplicate documents per property
-- Based on property_id and file_path combination
CREATE UNIQUE INDEX IF NOT EXISTS unique_property_document 
ON property_documents(property_id, file_path);

-- Also add a unique index on file_name per property as a secondary check
CREATE UNIQUE INDEX IF NOT EXISTS unique_property_document_name 
ON property_documents(property_id, file_name);
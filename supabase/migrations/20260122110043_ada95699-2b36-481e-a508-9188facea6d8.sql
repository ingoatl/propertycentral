-- Track W9 status on property owners
ALTER TABLE property_owners
ADD COLUMN IF NOT EXISTS w9_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS w9_uploaded_at timestamptz,
ADD COLUMN IF NOT EXISTS w9_file_path text;

-- Index for automation queries (find co-hosting owners needing W9)
CREATE INDEX IF NOT EXISTS idx_property_owners_w9_status 
ON property_owners(service_type, w9_sent_at) 
WHERE service_type = 'cohosting';
-- Add media_urls column to lead_communications to store MMS images
ALTER TABLE lead_communications ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN lead_communications.media_urls IS 'Array of media URLs for MMS messages (images, videos, etc.)';
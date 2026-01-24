-- Add guidebook_url to property_contact_info table
ALTER TABLE public.property_contact_info
ADD COLUMN IF NOT EXISTS guidebook_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.property_contact_info.guidebook_url IS 'URL to the guest guidebook for this property';
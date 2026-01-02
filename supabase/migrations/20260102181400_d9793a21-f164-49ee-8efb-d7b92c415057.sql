-- Add Zillow pricing columns to partner_properties
ALTER TABLE partner_properties 
ADD COLUMN IF NOT EXISTS zillow_rent_zestimate numeric,
ADD COLUMN IF NOT EXISTS calculated_listing_price numeric,
ADD COLUMN IF NOT EXISTS zillow_last_fetched timestamp with time zone;
-- Create partner_properties table for receiving MidTermNation data
CREATE TABLE IF NOT EXISTS partner_properties (
  -- Primary key
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source tracking (critical for sync)
  source_id uuid NOT NULL,
  source_system text NOT NULL DEFAULT 'midtermnation',
  category text NOT NULL DEFAULT 'Partner Inventory',
  
  -- Property basics
  property_title text,
  address text,
  city text,
  state text,
  zip_code text,
  property_type text,
  property_description text,
  
  -- Specs
  bedrooms integer,
  bathrooms numeric,
  square_footage integer,
  max_guests integer,
  stories integer,
  parking_spaces integer,
  parking_type text,
  year_built integer,
  
  -- Images (stored as URLs referencing MidTermNation storage)
  featured_image_url text,
  gallery_images text[],
  
  -- Amenities & Features
  amenities jsonb DEFAULT '[]'::jsonb,
  appliances_included text[],
  services_included text[],
  utilities_included text[],
  
  -- Pricing
  monthly_price numeric,
  security_deposit numeric,
  cleaning_fee numeric,
  
  -- Contact info
  contact_name text,
  contact_email text,
  contact_phone text,
  
  -- Additional
  pet_policy text,
  pet_policy_details text,
  ical_url text,
  existing_listing_url text,
  virtual_tour_url text,
  slug text,
  
  -- Status
  status text DEFAULT 'active',
  is_public boolean DEFAULT true,
  
  -- Timestamps
  synced_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Prevent duplicate imports
  UNIQUE(source_id, source_system)
);

-- Enable RLS
ALTER TABLE partner_properties ENABLE ROW LEVEL SECURITY;

-- Public read access for active properties (for display)
CREATE POLICY "Approved users can view partner properties"
ON partner_properties FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.status = 'approved'::account_status
));

-- Admins can manage partner properties
CREATE POLICY "Admins can manage partner properties"
ON partner_properties FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_partner_properties_source ON partner_properties(source_id, source_system);
CREATE INDEX idx_partner_properties_category ON partner_properties(category);
CREATE INDEX idx_partner_properties_status ON partner_properties(status);
CREATE INDEX idx_partner_properties_city ON partner_properties(city);
CREATE INDEX idx_partner_properties_state ON partner_properties(state);
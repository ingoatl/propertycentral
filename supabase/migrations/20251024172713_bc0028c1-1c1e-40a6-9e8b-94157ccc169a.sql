-- Step 1: Create property_details table for physical specifications
CREATE TABLE IF NOT EXISTS public.property_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Physical specifications
  property_type_detail TEXT, -- SFH, Townhouse, Townhome, etc
  stories TEXT,
  sqft INTEGER,
  bedrooms INTEGER,
  bathrooms NUMERIC(3,1),
  
  -- Parking & Access
  parking_type TEXT,
  parking_spaces TEXT,
  basement BOOLEAN DEFAULT false,
  fenced_yard TEXT, -- YES, NO, partially fenced in
  ada_compliant BOOLEAN DEFAULT false,
  
  -- Branding
  brand_name TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(property_id)
);

-- Enable RLS
ALTER TABLE public.property_details ENABLE ROW LEVEL SECURITY;

-- RLS Policies for property_details
CREATE POLICY "Approved users can view property details"
ON public.property_details FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can insert property details"
ON public.property_details FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update property details"
ON public.property_details FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete property details"
ON public.property_details FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 2: Create property_pricing_history table for financial terms with history
CREATE TABLE IF NOT EXISTS public.property_pricing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Pricing
  monthly_rent NUMERIC(10,2),
  nightly_rate NUMERIC(10,2),
  
  -- Deposits & Fees (one-time)
  security_deposit NUMERIC(10,2),
  utility_cap NUMERIC(10,2),
  cleaning_fee NUMERIC(10,2),
  admin_fee NUMERIC(10,2),
  pet_fee NUMERIC(10,2),
  
  -- Recurring fees
  monthly_pet_rent NUMERIC(10,2),
  monthly_cleaning_fee NUMERIC(10,2),
  
  -- Effective date for this pricing
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.property_pricing_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pricing history
CREATE POLICY "Approved users can view pricing history"
ON public.property_pricing_history FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can insert pricing history"
ON public.property_pricing_history FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update pricing history"
ON public.property_pricing_history FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete pricing history"
ON public.property_pricing_history FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for fast current pricing lookups
CREATE INDEX idx_pricing_current ON public.property_pricing_history(property_id, is_current) WHERE is_current = true;
CREATE INDEX idx_pricing_effective_date ON public.property_pricing_history(property_id, effective_date DESC);

-- Step 3: Create property_policies table for pet & lease policies
CREATE TABLE IF NOT EXISTS public.property_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Pet policies
  pets_allowed BOOLEAN DEFAULT false,
  pet_rules TEXT,
  max_pets INTEGER,
  max_pet_weight INTEGER,
  
  -- Lease terms
  lease_term TEXT, -- "month to month", "2 months min.", etc
  notice_to_vacate TEXT, -- "30 days", "60 days", etc
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(property_id)
);

-- Enable RLS
ALTER TABLE public.property_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Approved users can view property policies"
ON public.property_policies FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can insert property policies"
ON public.property_policies FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update property policies"
ON public.property_policies FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete property policies"
ON public.property_policies FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 4: Create property_schools table for school district information
CREATE TABLE IF NOT EXISTS public.property_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- School information
  school_district TEXT,
  elementary_school TEXT,
  middle_school TEXT,
  high_school TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(property_id)
);

-- Enable RLS
ALTER TABLE public.property_schools ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Approved users can view property schools"
ON public.property_schools FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can insert property schools"
ON public.property_schools FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update property schools"
ON public.property_schools FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete property schools"
ON public.property_schools FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 5: Create platform_listings table for tracking which platforms property is listed on
CREATE TABLE IF NOT EXISTS public.platform_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Platform information
  platform_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,
  listing_url TEXT,
  
  -- Status tracking
  last_updated TIMESTAMPTZ,
  updated_by UUID REFERENCES auth.users(id),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(property_id, platform_name)
);

-- Enable RLS
ALTER TABLE public.platform_listings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Approved users can view platform listings"
ON public.platform_listings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can insert platform listings"
ON public.platform_listings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update platform listings"
ON public.platform_listings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete platform listings"
ON public.platform_listings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 6: Create listing_templates table for platform-specific export templates
CREATE TABLE IF NOT EXISTS public.listing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template information
  platform_name TEXT NOT NULL UNIQUE,
  template_content TEXT NOT NULL,
  
  -- Template variables documentation
  available_variables TEXT[], -- ["property_name", "bedrooms", "bathrooms", etc]
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.listing_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Approved users can view listing templates"
ON public.listing_templates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can manage listing templates"
ON public.listing_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Step 7: Create property_contact_info table for email/phone/website
CREATE TABLE IF NOT EXISTS public.property_contact_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  
  -- Contact details
  contact_email TEXT,
  contact_phone TEXT,
  website_url TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(property_id)
);

-- Enable RLS
ALTER TABLE public.property_contact_info ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Approved users can view property contact info"
ON public.property_contact_info FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.status = 'approved'::account_status
  )
);

CREATE POLICY "Admins can manage property contact info"
ON public.property_contact_info FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger to auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_property_details_updated_at BEFORE UPDATE ON public.property_details
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_policies_updated_at BEFORE UPDATE ON public.property_policies
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_schools_updated_at BEFORE UPDATE ON public.property_schools
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listing_templates_updated_at BEFORE UPDATE ON public.listing_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_property_contact_info_updated_at BEFORE UPDATE ON public.property_contact_info
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
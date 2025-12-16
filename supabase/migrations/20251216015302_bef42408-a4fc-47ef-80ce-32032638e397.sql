-- Create owner_onboarding_submissions table to store raw form data
CREATE TABLE public.owner_onboarding_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  
  -- Step 1: Owner Info
  owner_name TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  owner_phone TEXT,
  property_address TEXT NOT NULL,
  
  -- Step 2: Access Details
  wifi_ssid TEXT,
  wifi_password TEXT,
  smart_lock_brand TEXT,
  smart_lock_code TEXT,
  lockbox_code TEXT,
  backup_key_location TEXT,
  maids_closet_code TEXT,
  trash_pickup_day TEXT,
  trash_bin_location TEXT,
  gate_code TEXT,
  garage_code TEXT,
  
  -- Step 3: Utilities
  wastewater_system TEXT,
  septic_last_pumped DATE,
  septic_company TEXT,
  utilities JSONB DEFAULT '[]'::jsonb,
  
  -- Step 4: Operations
  primary_cleaner TEXT,
  backup_cleaner TEXT,
  cleaner_satisfaction TEXT,
  cleaner_payment TEXT,
  cleaner_quality TEXT,
  supply_closet_location TEXT,
  laundry_notes TEXT,
  guest_avatar TEXT,
  unique_selling_points TEXT,
  existing_photos_link TEXT,
  airbnb_link TEXT,
  vrbo_link TEXT,
  other_listing_links TEXT,
  pets_allowed BOOLEAN DEFAULT false,
  pet_deposit NUMERIC,
  pet_size_restrictions TEXT,
  pool_hot_tub_info TEXT,
  has_thermostat BOOLEAN DEFAULT false,
  thermostat_login TEXT,
  house_quirks TEXT,
  sensitive_neighbor_notes TEXT,
  max_vehicles INTEGER,
  parking_instructions TEXT,
  recent_renovations TEXT,
  known_maintenance_issues TEXT,
  
  -- Step 5: Vendors
  lawncare_provider TEXT,
  pest_control_provider TEXT,
  hvac_service TEXT,
  maintenance_contact TEXT,
  emergency_contact_24_7 TEXT,
  insurance_corporate_contacts TEXT,
  
  -- Step 6: Safety & Security
  has_security_system BOOLEAN DEFAULT false,
  security_brand TEXT,
  alarm_code TEXT,
  has_cameras BOOLEAN DEFAULT false,
  camera_locations TEXT,
  camera_login_website TEXT,
  camera_login_credentials TEXT,
  fire_extinguisher_locations TEXT,
  smoke_co_detector_status TEXT,
  water_shutoff_location TEXT,
  breaker_panel_location TEXT,
  gas_shutoff_location TEXT,
  
  -- Step 7: Documents & Compliance
  government_id_url TEXT,
  property_deed_url TEXT,
  property_tax_statement_url TEXT,
  mortgage_statement_url TEXT,
  entity_ownership TEXT,
  entity_documents_url TEXT,
  has_hoa BOOLEAN DEFAULT false,
  hoa_contact_name TEXT,
  hoa_contact_phone TEXT,
  hoa_rules_url TEXT,
  str_permit_status TEXT,
  permit_number TEXT,
  insurance_provider TEXT,
  insurance_policy_number TEXT,
  guide_book_url TEXT,
  house_manual_url TEXT,
  parking_map_url TEXT,
  
  -- Step 8: Financial Performance
  last_year_revenue NUMERIC,
  airbnb_revenue_export_url TEXT,
  vrbo_revenue_export_url TEXT,
  ownerrez_revenue_export_url TEXT,
  average_daily_rate NUMERIC,
  occupancy_rate NUMERIC,
  average_booking_window INTEGER,
  average_monthly_revenue NUMERIC,
  peak_season TEXT,
  peak_season_adr NUMERIC,
  revenue_statement_url TEXT,
  expense_report_url TEXT,
  competitor_insights TEXT,
  pricing_revenue_goals TEXT,
  
  -- Processing
  property_id UUID REFERENCES public.properties(id),
  owner_id UUID REFERENCES public.property_owners(id),
  project_id UUID REFERENCES public.onboarding_projects(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  file_urls JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.owner_onboarding_submissions ENABLE ROW LEVEL SECURITY;

-- Policy for public insert (no auth required for form submission)
CREATE POLICY "Anyone can submit onboarding form"
ON public.owner_onboarding_submissions
FOR INSERT
WITH CHECK (true);

-- Policy for admins to manage submissions
CREATE POLICY "Admins can manage submissions"
ON public.owner_onboarding_submissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Policy for approved users to view submissions
CREATE POLICY "Approved users can view submissions"
ON public.owner_onboarding_submissions
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid()
  AND profiles.status = 'approved'::account_status
));

-- Create index for status lookups
CREATE INDEX idx_owner_onboarding_submissions_status ON public.owner_onboarding_submissions(status);
CREATE INDEX idx_owner_onboarding_submissions_created_at ON public.owner_onboarding_submissions(created_at DESC);
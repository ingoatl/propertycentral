// Extended property data types for comprehensive property management

export interface PropertyDetails {
  id: string;
  property_id: string;
  
  // Physical specifications
  property_type_detail?: string;
  stories?: string;
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  
  // Parking & Access
  parking_type?: string;
  parking_spaces?: string;
  basement?: boolean;
  fenced_yard?: string;
  ada_compliant?: boolean;
  
  // Branding
  brand_name?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface PropertyPricing {
  id: string;
  property_id: string;
  
  // Pricing
  monthly_rent?: number;
  nightly_rate?: number;
  
  // Deposits & Fees (one-time)
  security_deposit?: number;
  utility_cap?: number;
  cleaning_fee?: number;
  admin_fee?: number;
  pet_fee?: number;
  
  // Recurring fees
  monthly_pet_rent?: number;
  monthly_cleaning_fee?: number;
  
  // Effective date
  effective_date: string;
  end_date?: string;
  is_current: boolean;
  
  created_at: string;
  updated_by?: string;
}

export interface PropertyPolicies {
  id: string;
  property_id: string;
  
  // Pet policies
  pets_allowed?: boolean;
  pet_rules?: string;
  max_pets?: number;
  max_pet_weight?: number;
  
  // Lease terms
  lease_term?: string;
  notice_to_vacate?: string;
  
  created_at: string;
  updated_at: string;
}

export interface PropertySchools {
  id: string;
  property_id: string;
  
  school_district?: string;
  elementary_school?: string;
  middle_school?: string;
  high_school?: string;
  
  created_at: string;
  updated_at: string;
}

export interface PropertyContactInfo {
  id: string;
  property_id: string;
  
  contact_email?: string;
  contact_phone?: string;
  website_url?: string;
  
  created_at: string;
  updated_at: string;
}

export interface PlatformListing {
  id: string;
  property_id: string;
  
  platform_name: string;
  is_active: boolean;
  listing_url?: string;
  
  last_updated?: string;
  updated_by?: string;
  created_at: string;
}

export interface ListingTemplate {
  id: string;
  
  platform_name: string;
  template_content: string;
  available_variables?: string[];
  
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// Comprehensive property data combining all tables
export interface ComprehensivePropertyData {
  // Basic property info
  id: string;
  name: string;
  address: string;
  rental_type?: string;
  property_type?: string;
  
  // Extended details
  details?: PropertyDetails;
  pricing?: PropertyPricing;
  policies?: PropertyPolicies;
  schools?: PropertySchools;
  contact?: PropertyContactInfo;
  platforms?: PlatformListing[];
}

// CSV Import Types
export interface CSVPropertyRow {
  good_to_go?: string;
  properties: string;
  brand_name?: string;
  str_mtr?: string;
  house?: string;
  stories?: string;
  parking?: string;
  school_district?: string;
  ada_compliant?: string;
  basement?: string;
  fenced_in?: string;
  bedrooms?: string;
  bathrooms?: string;
  sqft?: string;
  pets?: string;
  pet_rule?: string;
  monthly?: string;
  nightly?: string;
  deposit?: string;
  utility_cap?: string;
  cleaning_fee?: string;
  admin_fee?: string;
  pet_fee?: string;
  monthly_pet_rent?: string;
  monthly_cleaning?: string;
  lease_term?: string;
  notice_to_vacate?: string;
  email_entered?: string;
  direct_booking_website?: string;
  
  // Platform statuses (TRUE/FALSE)
  mobile?: string;
  homelink?: string;
  crs_updated?: string;
  ale?: string;
  nch?: string;
  cru_homes?: string;
  sedgwick?: string;
  homads?: string;
  uch?: string;
  midtermrentals?: string;
  alacrity?: string;
}

// Import match result
export interface PropertyMatchResult {
  csv_row: CSVPropertyRow;
  matched_property?: {
    id: string;
    name: string;
    address: string;
  };
  confidence_score: number; // 0-100
  status: 'high_confidence' | 'low_confidence' | 'no_match' | 'multiple_matches';
  suggested_action: 'auto_import' | 'manual_review' | 'create_new';
}

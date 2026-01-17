export interface BedroomConfiguration {
  bedroom_number: number;
  bed_type: string;
  bed_count: number;
  is_primary: boolean;
}

export interface OwnerOnboardingFormData {
  // Contract Type & Platform Info
  contract_type: 'full_service' | 'cohosting' | '';
  has_airbnb_host_account: boolean;
  airbnb_account_status: string;
  airbnb_payment_method_setup: boolean;
  has_vrbo_account: boolean;
  vrbo_account_status: string;
  preferred_checkin_time: string;
  preferred_checkout_time: string;
  bedroom_configurations: BedroomConfiguration[];

  // Step 1: Owner Info & Property Specifications
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  property_address: string;
  how_did_you_find_us: string;
  was_referred: boolean;
  referred_by: string;
  
  // Property Specifications (Step 1)
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  year_built: number | null;
  num_stories: string;
  max_occupancy: number | null;
  has_basement: boolean;
  fenced_yard: boolean;
  ada_compliant: boolean;
  pool_type: string;
  
  // Nearby Schools (Step 1)
  elementary_school: string;
  middle_school: string;
  high_school: string;
  
  // Step 2: Access Details
  wifi_ssid: string;
  wifi_password: string;
  smart_lock_brand: string;
  smart_lock_code: string;
  lockbox_code: string;
  backup_key_location: string;
  maids_closet_code: string;
  trash_pickup_day: string;
  trash_bin_location: string;
  gate_code: string;
  garage_code: string;

  // Step 3: Utilities
  wastewater_system: string;
  septic_last_pumped: string;
  septic_company: string;
  utilities: UtilityInfo[];

  // Step 4: Operations
  primary_cleaner: string;
  backup_cleaner: string;
  cleaner_satisfaction: string;
  cleaner_payment: string;
  cleaner_quality: string;
  supply_closet_location: string;
  laundry_notes: string;
  guest_avatar: string;
  unique_selling_points: string;
  existing_photos_link: string;
  airbnb_link: string;
  vrbo_link: string;
  furnished_finder_link: string;
  booking_com_link: string;
  other_listing_links: string;
  current_nightly_rate: number | null;
  current_cleaning_fee: number | null;
  pets_allowed: boolean;
  pet_deposit: string;
  pet_size_restrictions: string;
  pool_hot_tub_info: string;
  has_thermostat: boolean;
  thermostat_login: string;
  house_quirks: string;
  sensitive_neighbor_notes: string;
  max_vehicles: string;
  parking_instructions: string;
  recent_renovations: string;
  known_maintenance_issues: string;

  // Step 5: Vendors
  lawncare_provider: string;
  pest_control_provider: string;
  hvac_service: string;
  maintenance_contact: string;
  emergency_contact_24_7: string;
  insurance_corporate_contacts: string;

  // Step 6: Safety & Security
  has_security_system: boolean;
  security_brand: string;
  alarm_code: string;
  has_cameras: boolean;
  camera_locations: string;
  camera_login_website: string;
  camera_login_credentials: string;
  fire_extinguisher_locations: string;
  smoke_co_detector_status: string;
  water_shutoff_location: string;
  breaker_panel_location: string;
  gas_shutoff_location: string;

  // Step 7: Documents & Compliance
  government_id_file: File | null;
  property_deed_file: File | null;
  property_tax_statement_file: File | null;
  mortgage_statement_file: File | null;
  entity_ownership: string;
  entity_documents_file: File | null;
  has_hoa: boolean;
  hoa_contact_name: string;
  hoa_contact_phone: string;
  hoa_rules_file: File | null;
  str_permit_status: string;
  permit_number: string;
  insurance_provider: string;
  insurance_policy_number: string;
  guide_book_file: File | null;
  house_manual_file: File | null;
  parking_map_file: File | null;

  // Step 8: Financial Performance
  last_year_revenue: string;
  airbnb_revenue_export_file: File | null;
  vrbo_revenue_export_file: File | null;
  ownerrez_revenue_export_file: File | null;
  average_daily_rate: string;
  occupancy_rate: string;
  average_booking_window: string;
  average_monthly_revenue: string;
  peak_season: string;
  peak_season_adr: string;
  revenue_statement_file: File | null;
  expense_report_file: File | null;
  competitor_insights: string;
  pricing_revenue_goals: string;
}

export interface UtilityInfo {
  type: string;
  provider: string;
  account_number: string;
}

export const CHECKIN_TIME_OPTIONS = [
  '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'
];

export const CHECKOUT_TIME_OPTIONS = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM'
];

export const BED_TYPE_OPTIONS = [
  'King', 'Queen', 'Full', 'Twin', 'Twin XL', 'Bunk Bed', 'Sofa Bed', 'Air Mattress', 'Floor Mattress'
];

export const initialFormData: OwnerOnboardingFormData = {
  // Contract Type & Platform Info
  contract_type: '',
  has_airbnb_host_account: false,
  airbnb_account_status: '',
  airbnb_payment_method_setup: false,
  has_vrbo_account: false,
  vrbo_account_status: '',
  preferred_checkin_time: '3:00 PM',
  preferred_checkout_time: '11:00 AM',
  bedroom_configurations: [],

  // Step 1 - Owner Info
  owner_name: '',
  owner_email: '',
  owner_phone: '',
  property_address: '',
  how_did_you_find_us: '',
  was_referred: false,
  referred_by: '',
  
  // Step 1 - Property Specifications
  property_type: '',
  bedrooms: null,
  bathrooms: null,
  square_footage: null,
  year_built: null,
  num_stories: '',
  max_occupancy: null,
  has_basement: false,
  fenced_yard: false,
  ada_compliant: false,
  pool_type: '',
  
  // Nearby Schools
  elementary_school: '',
  middle_school: '',
  high_school: '',

  // Step 2
  wifi_ssid: '',
  wifi_password: '',
  smart_lock_brand: '',
  smart_lock_code: '',
  lockbox_code: '',
  backup_key_location: '',
  maids_closet_code: '',
  trash_pickup_day: '',
  trash_bin_location: '',
  gate_code: '',
  garage_code: '',

  // Step 3
  wastewater_system: '',
  septic_last_pumped: '',
  septic_company: '',
  utilities: [
    { type: 'Water', provider: '', account_number: '' },
    { type: 'Power', provider: '', account_number: '' },
    { type: 'Gas', provider: '', account_number: '' },
    { type: 'Internet', provider: '', account_number: '' },
    { type: 'Trash', provider: '', account_number: '' },
  ],

  // Step 4
  primary_cleaner: '',
  backup_cleaner: '',
  cleaner_satisfaction: '',
  cleaner_payment: '',
  cleaner_quality: '',
  supply_closet_location: '',
  laundry_notes: '',
  guest_avatar: '',
  unique_selling_points: '',
  existing_photos_link: '',
  airbnb_link: '',
  vrbo_link: '',
  furnished_finder_link: '',
  booking_com_link: '',
  other_listing_links: '',
  current_nightly_rate: null,
  current_cleaning_fee: null,
  pets_allowed: false,
  pet_deposit: '',
  pet_size_restrictions: '',
  pool_hot_tub_info: '',
  has_thermostat: false,
  thermostat_login: '',
  house_quirks: '',
  sensitive_neighbor_notes: '',
  max_vehicles: '',
  parking_instructions: '',
  recent_renovations: '',
  known_maintenance_issues: '',

  // Step 5
  lawncare_provider: '',
  pest_control_provider: '',
  hvac_service: '',
  maintenance_contact: '',
  emergency_contact_24_7: '',
  insurance_corporate_contacts: '',

  // Step 6
  has_security_system: false,
  security_brand: '',
  alarm_code: '',
  has_cameras: false,
  camera_locations: '',
  camera_login_website: '',
  camera_login_credentials: '',
  fire_extinguisher_locations: '',
  smoke_co_detector_status: '',
  water_shutoff_location: '',
  breaker_panel_location: '',
  gas_shutoff_location: '',

  // Step 7
  government_id_file: null,
  property_deed_file: null,
  property_tax_statement_file: null,
  mortgage_statement_file: null,
  entity_ownership: '',
  entity_documents_file: null,
  has_hoa: false,
  hoa_contact_name: '',
  hoa_contact_phone: '',
  hoa_rules_file: null,
  str_permit_status: '',
  permit_number: '',
  insurance_provider: '',
  insurance_policy_number: '',
  guide_book_file: null,
  house_manual_file: null,
  parking_map_file: null,

  // Step 8
  last_year_revenue: '',
  airbnb_revenue_export_file: null,
  vrbo_revenue_export_file: null,
  ownerrez_revenue_export_file: null,
  average_daily_rate: '',
  occupancy_rate: '',
  average_booking_window: '',
  average_monthly_revenue: '',
  peak_season: '',
  peak_season_adr: '',
  revenue_statement_file: null,
  expense_report_file: null,
  competitor_insights: '',
  pricing_revenue_goals: '',
};

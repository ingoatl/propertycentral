/**
 * Field Label Mapping Utility
 * 
 * This utility provides human-readable labels and helpful descriptions
 * for document template fields that often have confusing auto-generated names.
 * 
 * Labels are designed to be realtor-friendly and explain what to enter.
 */

export interface FieldLabelInfo {
  label: string;
  placeholder: string;
  description?: string;
  /** Detailed help text explaining exactly what to enter */
  helpText?: string;
}

// Common patterns found in lease/rental agreement field names
// IMPORTANT: Patterns are ordered from most specific to least specific
const FIELD_PATTERNS: Array<{
  patterns: string[];
  exactMatch?: string[]; // These must match exactly (case insensitive)
  info: FieldLabelInfo;
}> = [
  // === LANDLORD/MANAGEMENT (First priority - these fields identify who is renting out the property) ===
  {
    exactMatch: ['landlord_name', 'lessor_name', 'owner_name', 'management_company', 'property_manager_name', 'innkeeper', 'brand_name'],
    patterns: ['landlord name', 'lessor name', 'owner name', 'management company', 'landlord means', 'innkeeper means', 'as used in this lease landlord'],
    info: {
      label: 'Landlord/Property Manager Name',
      placeholder: 'e.g., PeachHaus Group LLC',
      description: 'Enter the full legal name of the property owner or management company that is renting out the property',
      helpText: 'This should be the official business name that will appear on the lease as the "Landlord" or "Lessor"',
    },
  },
  {
    exactMatch: ['landlord_address', 'lessor_address', 'owner_address', 'payment_address', 'management_address'],
    patterns: ['landlord address', 'payment address', 'management address', 'lessor address', 'mail rent to'],
    info: {
      label: 'Landlord Mailing Address',
      placeholder: 'e.g., 123 Office Park Dr, Suite 100, Atlanta, GA 30301',
      description: 'Address where rent payments and correspondence should be sent',
      helpText: 'Use the business address for the property management company or landlord',
    },
  },
  {
    exactMatch: ['landlord_phone', 'lessor_phone', 'management_phone', 'office_phone', 'owner_phone'],
    patterns: ['landlord phone', 'office phone', 'management phone', 'lessor phone', 'contact number for landlord'],
    info: {
      label: 'Landlord/Office Phone',
      placeholder: 'e.g., (404) 555-1234',
      description: 'Main phone number for the landlord or property management office',
    },
  },
  {
    exactMatch: ['landlord_email', 'lessor_email', 'management_email', 'office_email', 'owner_email'],
    patterns: ['landlord email', 'office email', 'management email', 'lessor email'],
    info: {
      label: 'Landlord/Office Email',
      placeholder: 'e.g., leasing@peachhausgroup.com',
      description: 'Email address for the landlord or property management office',
    },
  },

  // === IDENTIFICATION (Tenant fills these) ===
  {
    exactMatch: ['ssn', 'social_security', 'tax_id', 'taxpayer_id'],
    patterns: ['social security', 'tax identification'],
    info: {
      label: 'Social Security Number (Tenant)',
      placeholder: 'XXX-XX-XXXX',
      description: 'Tenant enters their SSN for credit/background check purposes',
      helpText: 'Tenant will fill this field when signing - leave blank for admin',
    },
  },
  {
    exactMatch: ['drivers_license', 'driver_license', 'dl_number', 'id_number', 'license_number'],
    patterns: ['driver license', 'license number', 'id number'],
    info: {
      label: "Driver's License Number (Tenant)",
      placeholder: 'e.g., GA123456789',
      description: 'Tenant enters their state-issued ID number',
      helpText: 'Tenant will fill this field when signing',
    },
  },
  {
    exactMatch: ['dob', 'date_of_birth', 'birth_date', 'birthdate'],
    patterns: ['date of birth', 'birth date'],
    info: {
      label: 'Date of Birth (Tenant)',
      placeholder: 'MM/DD/YYYY',
      description: 'Tenant enters their date of birth',
    },
  },

  // === SPECIFIC FEES (Admin fills - set by lease terms) ===
  {
    exactMatch: ['returned_check_fee', 'nsf_fee', 'bounced_check_fee', 'dishonored_check_fee'],
    patterns: ['returned check', 'nsf fee', 'bounced check', 'dishonored check'],
    info: {
      label: 'Returned Check Fee',
      placeholder: 'e.g., $35',
      description: 'Fee charged when a rent check bounces or is returned by the bank',
      helpText: 'Standard fees range from $25-$50. Enter the dollar amount (e.g., "$35" or "35")',
    },
  },
  {
    exactMatch: ['late_fee', 'late_fee_amount', 'late_charge', 'late_penalty'],
    patterns: ['late fee', 'late charge', 'late penalty'],
    info: {
      label: 'Late Fee Amount',
      placeholder: 'e.g., $75 or 5%',
      description: 'Penalty charged when rent is paid after the grace period',
      helpText: 'Can be a flat fee (e.g., "$75") or percentage (e.g., "5% of monthly rent")',
    },
  },
  {
    exactMatch: ['grace_period', 'grace_period_days', 'grace_days'],
    patterns: ['grace period'],
    info: {
      label: 'Grace Period',
      placeholder: 'e.g., 5 days',
      description: 'Number of days after rent due date before late fees apply',
      helpText: 'Standard is 3-5 days. Enter just the number (e.g., "5") or "5 days"',
    },
  },
  {
    exactMatch: ['interest_rate', 'late_interest', 'annual_rate'],
    patterns: ['interest rate', 'per annum'],
    info: {
      label: 'Interest Rate on Late Payments',
      placeholder: 'e.g., 18% per annum',
      description: 'Annual interest rate charged on overdue balances',
      helpText: 'Typically 12-18% annually. Enter as percentage (e.g., "18%" or "18% per annum")',
    },
  },
  {
    exactMatch: ['pet_deposit', 'pet_fee', 'animal_deposit', 'animal_fee'],
    patterns: ['pet deposit', 'pet fee', 'animal deposit'],
    info: {
      label: 'Pet Deposit/Fee',
      placeholder: 'e.g., $250',
      description: 'One-time pet deposit or non-refundable pet fee',
      helpText: 'Enter the amount, or "N/A" or "$0" if no pets allowed',
    },
  },
  {
    exactMatch: ['pet_rent', 'monthly_pet_rent', 'pet_monthly'],
    patterns: ['pet rent', 'monthly pet'],
    info: {
      label: 'Monthly Pet Rent',
      placeholder: 'e.g., $25/month',
      description: 'Additional monthly rent charged for pets',
      helpText: 'Per-pet monthly fee. Enter "$0" or "N/A" if not applicable',
    },
  },
  {
    exactMatch: ['cleaning_fee', 'cleaning_deposit', 'cleaning_charge'],
    patterns: ['cleaning fee', 'cleaning deposit'],
    info: {
      label: 'Cleaning Fee',
      placeholder: 'e.g., $150',
      description: 'Non-refundable cleaning fee',
    },
  },
  {
    exactMatch: ['application_fee', 'app_fee'],
    patterns: ['application fee'],
    info: {
      label: 'Application Fee',
      placeholder: 'e.g., $50',
      description: 'Non-refundable application fee',
    },
  },
  {
    exactMatch: ['admin_fee', 'administration_fee', 'processing_fee'],
    patterns: ['admin fee', 'administration fee', 'processing fee'],
    info: {
      label: 'Admin/Processing Fee',
      placeholder: 'e.g., $100',
      description: 'One-time administrative fee',
    },
  },
  {
    exactMatch: ['garage_rent', 'parking_fee', 'garage_fee', 'parking_rent'],
    patterns: ['garage rent', 'parking fee', 'garage fee'],
    info: {
      label: 'Parking/Garage Fee',
      placeholder: 'e.g., $100/month',
      description: 'Monthly parking or garage rental fee',
    },
  },
  {
    exactMatch: ['parking_spaces', 'garage_spaces', 'num_parking'],
    patterns: ['parking spaces', 'garage spaces'],
    info: {
      label: 'Number of Parking Spaces',
      placeholder: 'e.g., 2',
      description: 'How many parking spots are included',
    },
  },
  {
    exactMatch: ['early_termination_fee', 'break_lease_fee', 'termination_fee'],
    patterns: ['early termination', 'break lease fee'],
    info: {
      label: 'Early Termination Fee',
      placeholder: 'e.g., 2 months rent',
      description: 'Penalty for breaking lease early',
    },
  },

  // === MAIN FINANCIAL TERMS (Admin fills) ===
  {
    exactMatch: ['monthly_rent', 'rent_amount', 'base_rent', 'monthly_rental'],
    patterns: ['monthly rent', 'rent amount', 'base rent', 'monthly installment', 'rent for the premises shall be paid in monthly installments of'],
    info: {
      label: 'Monthly Rent Amount',
      placeholder: 'e.g., $1,500',
      description: 'The monthly rent amount the tenant will pay',
      helpText: 'Enter the full dollar amount (e.g., "$1,500" or "1500"). This is the base rent before any additional fees.',
    },
  },
  {
    exactMatch: ['additional_rent', 'extra_rent', 'additional_charges'],
    patterns: ['additional rent', 'extra rent', 'additional charges'],
    info: {
      label: 'Additional Monthly Charges',
      placeholder: 'e.g., $50 for utilities',
      description: 'Any recurring monthly charges beyond base rent',
      helpText: 'Enter additional fees like utility surcharges, HOA pass-throughs, etc. Enter "$0" if none.',
    },
  },
  {
    exactMatch: ['security_deposit', 'deposit_amount', 'damage_deposit'],
    patterns: ['security deposit', 'damage deposit'],
    info: {
      label: 'Security Deposit Amount',
      placeholder: 'e.g., $1,500',
      description: 'Refundable deposit held for potential damages',
      helpText: 'Typically equal to one month rent. This is returned at lease end minus any damages.',
    },
  },
  {
    exactMatch: ['total_amount', 'total_due', 'move_in_total', 'total_rent', 'amount_due'],
    patterns: ['total amount', 'total due', 'move in total'],
    info: {
      label: 'Total Move-In Amount Due',
      placeholder: 'e.g., $3,250',
      description: 'Total of all amounts due at lease signing',
      helpText: 'Sum of first month rent + security deposit + any fees due at signing',
    },
  },
  {
    exactMatch: ['prorated_rent', 'proration', 'partial_rent'],
    patterns: ['prorated rent', 'partial rent'],
    info: {
      label: 'Prorated Rent',
      placeholder: 'e.g., $500',
      description: 'Partial month rent amount',
    },
  },
  {
    exactMatch: ['payment_method', 'payment_methods', 'accepted_payments'],
    patterns: ['payment method', 'accepted payment', 'forms of payment'],
    info: {
      label: 'Accepted Payment Methods',
      placeholder: 'e.g., Check, Money Order, ACH',
      description: 'How rent can be paid',
    },
  },

  // === PROPERTY DETAILS ===
  {
    exactMatch: ['property_address', 'rental_address', 'premises_address', 'address'],
    patterns: ['property address', 'rental address', 'premises address', 'located at', 'situated at'],
    info: {
      label: 'Property Address',
      placeholder: 'e.g., 123 Main Street, Atlanta, GA 30301',
      description: 'Full street address of the rental property',
    },
  },
  {
    exactMatch: ['property_name', 'listing_name', 'unit_name'],
    patterns: ['property name', 'listing name'],
    info: {
      label: 'Property Name',
      placeholder: 'e.g., Sunset Villa Unit 2B',
      description: 'Name or nickname of the property',
    },
  },
  {
    exactMatch: ['unit', 'apt', 'apartment', 'suite', 'unit_number'],
    patterns: ['unit number', 'apt number', 'apartment number'],
    info: {
      label: 'Unit/Apt Number',
      placeholder: 'e.g., Apt 4B, Unit 201',
      description: 'Apartment or unit number if applicable',
    },
  },
  {
    exactMatch: ['city', 'property_city'],
    patterns: [],
    info: {
      label: 'City',
      placeholder: 'e.g., Atlanta',
      description: 'City where the property is located',
    },
  },
  {
    exactMatch: ['county', 'property_county'],
    patterns: [],
    info: {
      label: 'County',
      placeholder: 'e.g., Fulton County',
      description: 'County where the property is located',
    },
  },
  {
    exactMatch: ['state', 'property_state'],
    patterns: [],
    info: {
      label: 'State',
      placeholder: 'e.g., Georgia or GA',
      description: 'State where the property is located',
    },
  },
  {
    exactMatch: ['zip', 'zip_code', 'postal', 'postal_code'],
    patterns: ['zip code', 'postal code'],
    info: {
      label: 'ZIP Code',
      placeholder: 'e.g., 30301',
      description: '5-digit ZIP code',
    },
  },
  {
    exactMatch: ['bedrooms', 'beds', 'num_bedrooms'],
    patterns: ['number of bedrooms'],
    info: {
      label: 'Number of Bedrooms',
      placeholder: 'e.g., 2',
      description: 'Total bedrooms in the property',
    },
  },
  {
    exactMatch: ['bathrooms', 'baths', 'num_bathrooms'],
    patterns: ['number of bathrooms'],
    info: {
      label: 'Number of Bathrooms',
      placeholder: 'e.g., 1.5',
      description: 'Total bathrooms (use .5 for half bath)',
    },
  },
  {
    exactMatch: ['square_feet', 'sqft', 'sq_ft', 'square_footage'],
    patterns: ['square feet', 'square footage'],
    info: {
      label: 'Square Footage',
      placeholder: 'e.g., 1200',
      description: 'Total square feet of living space',
    },
  },

  // === DATES ===
  {
    exactMatch: ['lease_start', 'start_date', 'lease_start_date', 'commencement_date', 'begin_date'],
    patterns: ['lease start', 'start date', 'commencement'],
    info: {
      label: 'Lease Start Date',
      placeholder: 'Select start date',
      description: 'First day of the lease term',
    },
  },
  {
    exactMatch: ['lease_end', 'end_date', 'lease_end_date', 'termination_date', 'expiration_date'],
    patterns: ['lease end', 'end date', 'termination date', 'expiration'],
    info: {
      label: 'Lease End Date',
      placeholder: 'Select end date',
      description: 'Last day of the lease term',
    },
  },
  {
    exactMatch: ['effective_date', 'agreement_effective_date'],
    patterns: ['effective date'],
    info: {
      label: 'Effective Date',
      placeholder: 'Select effective date',
      description: 'Date when agreement takes effect',
    },
  },
  {
    exactMatch: ['move_in_date', 'occupancy_date'],
    patterns: ['move in date', 'occupancy date'],
    info: {
      label: 'Move-In Date',
      placeholder: 'Select move-in date',
      description: 'Date tenant can move in',
    },
  },
  {
    exactMatch: ['signing_date', 'execution_date', 'agreement_date', 'document_date'],
    patterns: ['signing date', 'execution date', 'agreement date'],
    info: {
      label: 'Signing Date',
      placeholder: 'Date document is signed',
      description: 'Date the agreement is executed',
    },
  },
  {
    exactMatch: ['rent_due_day', 'rent_due', 'due_date', 'payment_due'],
    patterns: ['rent due', 'payment due'],
    info: {
      label: 'Rent Due Day',
      placeholder: 'e.g., 1st of each month',
      description: 'Day of month rent is due',
    },
  },

  // === LANDLORD/MANAGEMENT ===
  {
    exactMatch: ['landlord_name', 'lessor_name', 'owner_name', 'management_company', 'property_manager_name'],
    patterns: ['landlord name', 'lessor name', 'owner name', 'management company'],
    info: {
      label: 'Landlord/Owner Name',
      placeholder: 'e.g., ABC Property Management LLC',
      description: 'Legal name of landlord or management company',
    },
  },
  {
    exactMatch: ['landlord_address', 'lessor_address', 'owner_address', 'payment_address', 'management_address'],
    patterns: ['landlord address', 'payment address'],
    info: {
      label: 'Landlord Address',
      placeholder: 'Address to mail rent payments',
      description: 'Where to send rent and correspondence',
    },
  },
  {
    exactMatch: ['landlord_phone', 'lessor_phone', 'management_phone', 'office_phone', 'owner_phone'],
    patterns: ['landlord phone', 'office phone'],
    info: {
      label: 'Landlord Phone',
      placeholder: 'e.g., (404) 555-1234',
      description: 'Phone number for landlord or office',
    },
  },
  {
    exactMatch: ['landlord_email', 'lessor_email', 'management_email', 'office_email', 'owner_email'],
    patterns: ['landlord email', 'office email'],
    info: {
      label: 'Landlord Email',
      placeholder: 'e.g., office@propertymanagement.com',
      description: 'Email for landlord or office',
    },
  },
  {
    exactMatch: ['agent_name', 'property_manager', 'manager_name'],
    patterns: ['agent name', 'property manager'],
    info: {
      label: 'Property Manager Name',
      placeholder: 'e.g., John Smith',
      description: 'Name of property manager or agent',
    },
  },

  // === TENANT INFO ===
  {
    exactMatch: ['tenant_name', 'lessee_name', 'renter_name', 'guest_name', 'occupant_name'],
    patterns: ['tenant name', 'lessee name', 'renter name', 'guest name'],
    info: {
      label: 'Tenant Full Name',
      placeholder: 'e.g., Jane Doe',
      description: 'Legal name of tenant',
    },
  },
  {
    exactMatch: ['tenant_email', 'lessee_email', 'renter_email', 'guest_email'],
    patterns: ['tenant email', 'renter email'],
    info: {
      label: 'Tenant Email',
      placeholder: 'e.g., tenant@email.com',
      description: 'Tenant email address',
    },
  },
  {
    exactMatch: ['tenant_phone', 'lessee_phone', 'renter_phone', 'guest_phone'],
    patterns: ['tenant phone', 'renter phone'],
    info: {
      label: 'Tenant Phone',
      placeholder: 'e.g., (404) 555-5678',
      description: 'Tenant phone number',
    },
  },
  {
    exactMatch: ['tenant_address', 'current_address', 'previous_address'],
    patterns: ['tenant address', 'current address', 'previous address'],
    info: {
      label: 'Tenant Current Address',
      placeholder: 'Current address before moving',
      description: 'Tenant address prior to move-in',
    },
  },
  {
    exactMatch: ['co_tenant', 'additional_tenant', 'co_signer', 'other_occupant', 'co_tenant_name'],
    patterns: ['co tenant', 'additional tenant', 'co signer'],
    info: {
      label: 'Co-Tenant/Additional Occupant',
      placeholder: 'e.g., John Doe (spouse)',
      description: 'Other adults on the lease',
    },
  },
  {
    exactMatch: ['num_occupants', 'occupants_allowed', 'max_occupants', 'number_of_occupants'],
    patterns: ['number of occupants', 'max occupants'],
    info: {
      label: 'Maximum Occupants',
      placeholder: 'e.g., 4',
      description: 'Maximum number of people allowed to live in unit',
    },
  },

  // === VEHICLE INFO ===
  {
    exactMatch: ['vehicle_make', 'car_make'],
    patterns: ['vehicle make'],
    info: {
      label: 'Vehicle Make',
      placeholder: 'e.g., Toyota',
      description: 'Manufacturer of the vehicle',
    },
  },
  {
    exactMatch: ['vehicle_model', 'car_model'],
    patterns: ['vehicle model'],
    info: {
      label: 'Vehicle Model',
      placeholder: 'e.g., Camry',
      description: 'Model of the vehicle',
    },
  },
  {
    exactMatch: ['vehicle_year', 'car_year'],
    patterns: ['vehicle year'],
    info: {
      label: 'Vehicle Year',
      placeholder: 'e.g., 2020',
      description: 'Year the vehicle was made',
    },
  },
  {
    exactMatch: ['vehicle_color', 'car_color'],
    patterns: ['vehicle color'],
    info: {
      label: 'Vehicle Color',
      placeholder: 'e.g., Silver',
      description: 'Color of the vehicle',
    },
  },
  {
    exactMatch: ['license_plate', 'tag_number', 'plate_number'],
    patterns: ['license plate', 'tag number'],
    info: {
      label: 'License Plate Number',
      placeholder: 'e.g., ABC1234',
      description: 'Vehicle license plate number',
    },
  },

  // === EMERGENCY CONTACT ===
  {
    exactMatch: ['emergency_name', 'emergency_contact', 'emergency_contact_name'],
    patterns: ['emergency contact name'],
    info: {
      label: 'Emergency Contact Name',
      placeholder: 'e.g., Mary Doe',
      description: 'Person to contact in emergency',
    },
  },
  {
    exactMatch: ['emergency_phone', 'emergency_number', 'emergency_contact_phone'],
    patterns: ['emergency phone', 'emergency number'],
    info: {
      label: 'Emergency Contact Phone',
      placeholder: 'e.g., (404) 555-9999',
      description: 'Phone number for emergency contact',
    },
  },
  {
    exactMatch: ['emergency_relationship', 'emergency_relation'],
    patterns: ['emergency relationship'],
    info: {
      label: 'Emergency Contact Relationship',
      placeholder: 'e.g., Mother, Brother, Friend',
      description: 'Relationship to tenant',
    },
  },

  // === UTILITIES & AMENITIES ===
  {
    exactMatch: ['utilities_included', 'included_utilities'],
    patterns: ['utilities included'],
    info: {
      label: 'Utilities Included',
      placeholder: 'e.g., Water, Trash, Gas',
      description: 'List utilities included in rent',
    },
  },
  {
    exactMatch: ['utilities_tenant', 'tenant_utilities', 'tenant_pays'],
    patterns: ['tenant pays', 'tenant utilities'],
    info: {
      label: 'Tenant Pays Utilities',
      placeholder: 'e.g., Electric, Internet',
      description: 'Utilities tenant is responsible for',
    },
  },
  {
    exactMatch: ['appliances', 'supplied_appliances', 'included_appliances'],
    patterns: ['appliances included', 'supplied appliances'],
    info: {
      label: 'Appliances Included',
      placeholder: 'e.g., Refrigerator, Stove, Dishwasher',
      description: 'List of appliances provided with unit',
    },
  },

  // === POLICIES ===
  {
    exactMatch: ['pet_policy', 'pet_allowed', 'pet_type', 'pets_allowed'],
    patterns: ['pet policy', 'pets allowed'],
    info: {
      label: 'Pet Policy',
      placeholder: 'e.g., No pets, or Cats only',
      description: 'Rules regarding pets',
    },
  },
  {
    exactMatch: ['smoking_policy', 'smoking_allowed'],
    patterns: ['smoking policy'],
    info: {
      label: 'Smoking Policy',
      placeholder: 'e.g., No smoking on premises',
      description: 'Rules regarding smoking',
    },
  },
  {
    exactMatch: ['notice_period', 'notice_days', 'termination_notice'],
    patterns: ['notice period', 'termination notice'],
    info: {
      label: 'Notice Period',
      placeholder: 'e.g., 30 days, 60 days',
      description: 'Required notice to terminate lease',
    },
  },
  {
    exactMatch: ['quiet_hours', 'noise_policy'],
    patterns: ['quiet hours'],
    info: {
      label: 'Quiet Hours',
      placeholder: 'e.g., 10 PM - 8 AM',
      description: 'Hours when noise should be minimized',
    },
  },

  // === LEASE TERMS ===
  {
    exactMatch: ['lease_term', 'term_length', 'lease_duration'],
    patterns: ['lease term', 'term length'],
    info: {
      label: 'Lease Term Length',
      placeholder: 'e.g., 12 months',
      description: 'How long the lease lasts',
    },
  },
  {
    exactMatch: ['renewal_terms', 'auto_renew'],
    patterns: ['renewal terms', 'auto renew'],
    info: {
      label: 'Renewal Terms',
      placeholder: 'e.g., Month-to-month after initial term',
      description: 'What happens when lease expires',
    },
  },
];
// Date field patterns that need special handling
const DATE_FIELD_PATTERNS = [
  { pattern: 'date_0', label: 'Document Date', placeholder: 'Date of this document' },
  { pattern: 'date_1', label: 'Start Date', placeholder: 'Beginning date' },
  { pattern: 'date_2', label: 'End Date', placeholder: 'Ending date' },
  { pattern: 'date_3', label: 'Signing Date', placeholder: 'Date of signing' },
  { pattern: 'date.0', label: 'Document Date', placeholder: 'Date of this document' },
  { pattern: 'date.1', label: 'Secondary Date', placeholder: 'Additional date field' },
  { pattern: 'date.1.0', label: 'Effective Date', placeholder: 'When this takes effect' },
  { pattern: 'date_field', label: 'Date', placeholder: 'Enter date' },
];

/**
 * Get a clean, human-readable label and placeholder for a field
 */
export function getFieldLabelInfo(apiId: string, originalLabel: string): FieldLabelInfo {
  const apiIdLower = apiId.toLowerCase();
  const apiIdNormalized = apiIdLower.replace(/[_\-\.]/g, '');
  const labelLower = originalLabel.toLowerCase();

  // Check for date patterns first
  for (const datePattern of DATE_FIELD_PATTERNS) {
    if (apiIdLower === datePattern.pattern.toLowerCase() ||
        apiIdNormalized === datePattern.pattern.replace(/[_\.]/g, '')) {
      return {
        label: datePattern.label,
        placeholder: datePattern.placeholder,
      };
    }
  }

  // Check against our pattern mappings - EXACT MATCHES FIRST
  for (const patternDef of FIELD_PATTERNS) {
    // Check exact matches first (highest priority)
    if (patternDef.exactMatch) {
      for (const exact of patternDef.exactMatch) {
        if (apiIdLower === exact.toLowerCase() || 
            apiIdNormalized === exact.replace(/[_\-]/g, '').toLowerCase()) {
          return patternDef.info;
        }
      }
    }
  }

  // Then check pattern matches (lower priority)
  for (const patternDef of FIELD_PATTERNS) {
    if (patternDef.patterns.length > 0) {
      for (const pattern of patternDef.patterns) {
        const patternNormalized = pattern.toLowerCase().replace(/\s+/g, '');
        // Check if the api_id or label contains the full pattern phrase
        if (apiIdNormalized.includes(patternNormalized) || 
            labelLower.replace(/\s+/g, '').includes(patternNormalized)) {
          return patternDef.info;
        }
      }
    }
  }

  // If no match found, try to clean up the original label
  return createFallbackLabel(apiId, originalLabel);
}

/**
 * Create a cleaned-up fallback label when no pattern matches
 */
function createFallbackLabel(apiId: string, originalLabel: string): FieldLabelInfo {
  // If the label is very long (likely a sentence from the document), use the apiId instead
  let cleanLabel = originalLabel;
  
  if (originalLabel.length > 50 || originalLabel.split(' ').length > 8) {
    // Use apiId as base - convert to title case
    cleanLabel = apiId
      .replace(/[_\-\.]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  } else {
    // Clean up the original label - remove common document text patterns
    cleanLabel = originalLabel
      .replace(/shall be|will be|may be|is the|at the|for the|of the|in the/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // If still too long or empty, use simplified version
    if (cleanLabel.length > 40 || cleanLabel.length < 2) {
      cleanLabel = apiId
        .replace(/[_\-\.]/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
  }

  // Create a reasonable placeholder
  const placeholder = createPlaceholder(cleanLabel);

  return {
    label: cleanLabel,
    placeholder,
  };
}

/**
 * Create a helpful placeholder based on the field label
 */
function createPlaceholder(label: string): string {
  const labelLower = label.toLowerCase();

  if (labelLower.includes('date')) return 'Select a date';
  if (labelLower.includes('phone')) return 'e.g., (404) 555-1234';
  if (labelLower.includes('email')) return 'e.g., email@example.com';
  if (labelLower.includes('address')) return 'Enter full address';
  if (labelLower.includes('name')) return 'Enter full name';
  if (labelLower.includes('amount') || labelLower.includes('fee') || labelLower.includes('rent') || labelLower.includes('deposit')) {
    return 'e.g., $1,000';
  }
  if (labelLower.includes('number') || labelLower.includes('count')) return 'Enter a number';
  if (labelLower.includes('year')) return 'e.g., 2024';
  
  return `Enter ${label.toLowerCase()}`;
}

/**
 * Get category-specific help text
 */
export function getCategoryHelpText(category: string): string {
  const helpTexts: Record<string, string> = {
    property: 'Details about the rental property',
    financial: 'Rent amounts, deposits, and fees',
    dates: 'Important dates for the lease',
    contact: 'Phone numbers and email addresses',
    identification: 'ID numbers and personal identifiers',
    occupancy: 'Who can live in the property and house rules',
    vehicle: 'Information about parked vehicles',
    emergency: 'Who to contact in case of emergency',
    acknowledgment: 'Confirmations and agreements',
    signature: 'Signature fields',
    other: 'Additional information',
  };
  return helpTexts[category] || 'Additional fields';
}

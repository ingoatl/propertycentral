/**
 * Field Label Mapping Utility
 * 
 * This utility provides human-readable labels and helpful descriptions
 * for document template fields that often have confusing auto-generated names.
 */

export interface FieldLabelInfo {
  label: string;
  placeholder: string;
  description?: string;
}

// Common patterns found in lease/rental agreement field names
const FIELD_PATTERNS: Array<{
  patterns: string[];
  info: FieldLabelInfo;
}> = [
  // === PROPERTY DETAILS ===
  {
    patterns: ['premises', 'property_address', 'rental_address', 'located', 'situated', 'residence'],
    info: {
      label: 'Property Address',
      placeholder: 'e.g., 123 Main Street, Atlanta, GA 30301',
      description: 'Full street address of the rental property',
    },
  },
  {
    patterns: ['property_name', 'listing_name', 'unit_name'],
    info: {
      label: 'Property Name',
      placeholder: 'e.g., Sunset Villa Unit 2B',
      description: 'Name or nickname of the property',
    },
  },
  {
    patterns: ['unit', 'apt', 'apartment', 'suite'],
    info: {
      label: 'Unit/Apt Number',
      placeholder: 'e.g., Apt 4B, Unit 201',
      description: 'Apartment or unit number if applicable',
    },
  },
  {
    patterns: ['city'],
    info: {
      label: 'City',
      placeholder: 'e.g., Atlanta',
      description: 'City where the property is located',
    },
  },
  {
    patterns: ['county'],
    info: {
      label: 'County',
      placeholder: 'e.g., Fulton County',
      description: 'County where the property is located',
    },
  },
  {
    patterns: ['state'],
    info: {
      label: 'State',
      placeholder: 'e.g., Georgia or GA',
      description: 'State where the property is located',
    },
  },
  {
    patterns: ['zip', 'postal'],
    info: {
      label: 'ZIP Code',
      placeholder: 'e.g., 30301',
      description: '5-digit ZIP code',
    },
  },
  {
    patterns: ['bedrooms', 'beds'],
    info: {
      label: 'Number of Bedrooms',
      placeholder: 'e.g., 2',
      description: 'Total bedrooms in the property',
    },
  },
  {
    patterns: ['bathrooms', 'baths'],
    info: {
      label: 'Number of Bathrooms',
      placeholder: 'e.g., 1.5',
      description: 'Total bathrooms (use .5 for half bath)',
    },
  },
  {
    patterns: ['square_feet', 'sqft', 'sq_ft'],
    info: {
      label: 'Square Footage',
      placeholder: 'e.g., 1200',
      description: 'Total square feet of living space',
    },
  },

  // === FINANCIAL TERMS ===
  {
    patterns: ['monthly_rent', 'rent_amount', 'installments', 'monthly_rental', 'tenancy_at_a_monthly_rental'],
    info: {
      label: 'Monthly Rent',
      placeholder: 'e.g., $1,500',
      description: 'Amount due each month',
    },
  },
  {
    patterns: ['additional_rent', 'extra_rent', 'additional_fee'],
    info: {
      label: 'Additional Rent/Fees',
      placeholder: 'e.g., $50 for utilities',
      description: 'Any extra monthly charges beyond base rent',
    },
  },
  {
    patterns: ['security_deposit', 'deposit_amount', 'security_for_the_return'],
    info: {
      label: 'Security Deposit',
      placeholder: 'e.g., $1,500',
      description: 'Refundable deposit held for damages',
    },
  },
  {
    patterns: ['late_fee', 'late_penalty', 'first_day_rent_is_late', 'late_charge'],
    info: {
      label: 'Late Fee Amount',
      placeholder: 'e.g., $75',
      description: 'Penalty charged when rent is paid late',
    },
  },
  {
    patterns: ['late_day', 'deemed_late', 'grace_period', 'day_of_any_calendar_month'],
    info: {
      label: 'Grace Period (Days)',
      placeholder: 'e.g., 5',
      description: 'Number of days before rent is considered late',
    },
  },
  {
    patterns: ['interest_rate', 'per_annum', 'annual_rate', 'late_payments_under'],
    info: {
      label: 'Late Payment Interest Rate',
      placeholder: 'e.g., 18%',
      description: 'Annual interest rate charged on late payments',
    },
  },
  {
    patterns: ['dishonored_check', 'nsf_fee', 'bounced_check', 'returned_check'],
    info: {
      label: 'Returned Check Fee',
      placeholder: 'e.g., $35',
      description: 'Fee charged for bounced or returned checks',
    },
  },
  {
    patterns: ['pet_deposit', 'pet_fee', 'animal_deposit'],
    info: {
      label: 'Pet Deposit/Fee',
      placeholder: 'e.g., $250',
      description: 'One-time or monthly pet fee',
    },
  },
  {
    patterns: ['pet_rent', 'monthly_pet'],
    info: {
      label: 'Monthly Pet Rent',
      placeholder: 'e.g., $25/month',
      description: 'Additional monthly rent for pets',
    },
  },
  {
    patterns: ['cleaning_fee', 'cleaning_deposit'],
    info: {
      label: 'Cleaning Fee',
      placeholder: 'e.g., $150',
      description: 'Non-refundable cleaning fee',
    },
  },
  {
    patterns: ['application_fee', 'app_fee'],
    info: {
      label: 'Application Fee',
      placeholder: 'e.g., $50',
      description: 'Non-refundable application fee',
    },
  },
  {
    patterns: ['admin_fee', 'processing_fee', 'administration_fee'],
    info: {
      label: 'Admin/Processing Fee',
      placeholder: 'e.g., $100',
      description: 'One-time administrative fee',
    },
  },
  {
    patterns: ['total_amount', 'total_due', 'move_in_total', 'total_rent'],
    info: {
      label: 'Total Amount Due',
      placeholder: 'e.g., $3,250',
      description: 'Total of all amounts due at signing',
    },
  },
  {
    patterns: ['prorated_rent', 'proration'],
    info: {
      label: 'Prorated Rent',
      placeholder: 'e.g., $500',
      description: 'Partial month rent amount',
    },
  },
  {
    patterns: ['garage_rent', 'parking_fee', 'garage_at_a_rental_rate'],
    info: {
      label: 'Parking/Garage Fee',
      placeholder: 'e.g., $100/month',
      description: 'Monthly parking or garage rental fee',
    },
  },
  {
    patterns: ['parking_spaces', 'garage_spaces', 'spaces_in_the_garage'],
    info: {
      label: 'Number of Parking Spaces',
      placeholder: 'e.g., 2',
      description: 'How many parking spots are included',
    },
  },
  {
    patterns: ['payment_method', 'forms_of_payment', 'accepted_by_landlord'],
    info: {
      label: 'Accepted Payment Methods',
      placeholder: 'e.g., Check, Money Order, ACH',
      description: 'How rent can be paid',
    },
  },

  // === DATES ===
  {
    patterns: ['lease_start', 'start_date', 'commencement', 'begin_date', 'effective_date'],
    info: {
      label: 'Lease Start Date',
      placeholder: 'Select start date',
      description: 'First day of the lease term',
    },
  },
  {
    patterns: ['lease_end', 'end_date', 'termination', 'expiration', 'expire_date'],
    info: {
      label: 'Lease End Date',
      placeholder: 'Select end date',
      description: 'Last day of the lease term',
    },
  },
  {
    patterns: ['move_in_date', 'occupancy_date'],
    info: {
      label: 'Move-In Date',
      placeholder: 'Select move-in date',
      description: 'Date tenant can move in',
    },
  },
  {
    patterns: ['signing_date', 'execution_date', 'agreement_date'],
    info: {
      label: 'Signing Date',
      placeholder: 'Date document is signed',
      description: 'Date the agreement is executed',
    },
  },
  {
    patterns: ['rent_due', 'due_date', 'payment_due'],
    info: {
      label: 'Rent Due Day',
      placeholder: 'e.g., 1st of each month',
      description: 'Day of month rent is due',
    },
  },

  // === LANDLORD/MANAGEMENT ===
  {
    patterns: ['landlord_name', 'lessor', 'owner_name', 'management_company', 'landlord_means'],
    info: {
      label: 'Landlord/Owner Name',
      placeholder: 'e.g., ABC Property Management LLC',
      description: 'Legal name of landlord or management company',
    },
  },
  {
    patterns: ['landlord_address', 'lessor_address', 'owner_address', 'payment_address'],
    info: {
      label: 'Landlord Address',
      placeholder: 'Address to mail rent payments',
      description: 'Where to send rent and correspondence',
    },
  },
  {
    patterns: ['landlord_phone', 'lessor_phone', 'management_phone', 'office_phone'],
    info: {
      label: 'Landlord Phone',
      placeholder: 'e.g., (404) 555-1234',
      description: 'Phone number for landlord or office',
    },
  },
  {
    patterns: ['landlord_email', 'lessor_email', 'management_email', 'office_email'],
    info: {
      label: 'Landlord Email',
      placeholder: 'e.g., office@propertymanagement.com',
      description: 'Email for landlord or office',
    },
  },
  {
    patterns: ['agent_name', 'property_manager', 'manager_name'],
    info: {
      label: 'Property Manager Name',
      placeholder: 'e.g., John Smith',
      description: 'Name of property manager or agent',
    },
  },

  // === TENANT INFO ===
  {
    patterns: ['tenant_name', 'lessee', 'renter_name', 'occupant_name'],
    info: {
      label: 'Tenant Full Name',
      placeholder: 'e.g., Jane Doe',
      description: 'Legal name of tenant',
    },
  },
  {
    patterns: ['tenant_email', 'lessee_email', 'renter_email'],
    info: {
      label: 'Tenant Email',
      placeholder: 'e.g., tenant@email.com',
      description: 'Tenant email address',
    },
  },
  {
    patterns: ['tenant_phone', 'lessee_phone', 'renter_phone'],
    info: {
      label: 'Tenant Phone',
      placeholder: 'e.g., (404) 555-5678',
      description: 'Tenant phone number',
    },
  },
  {
    patterns: ['tenant_address', 'current_address', 'previous_address'],
    info: {
      label: 'Tenant Current Address',
      placeholder: 'Current address before moving',
      description: 'Tenant address prior to move-in',
    },
  },
  {
    patterns: ['co_tenant', 'additional_tenant', 'co_signer', 'other_occupant'],
    info: {
      label: 'Co-Tenant/Additional Occupant',
      placeholder: 'e.g., John Doe (spouse)',
      description: 'Other adults on the lease',
    },
  },
  {
    patterns: ['num_occupants', 'occupants_allowed', 'max_occupants', 'number_of_occupants'],
    info: {
      label: 'Maximum Occupants',
      placeholder: 'e.g., 4',
      description: 'Maximum number of people allowed to live in unit',
    },
  },

  // === VEHICLE INFO ===
  {
    patterns: ['vehicle_make', 'car_make'],
    info: {
      label: 'Vehicle Make',
      placeholder: 'e.g., Toyota',
      description: 'Manufacturer of the vehicle',
    },
  },
  {
    patterns: ['vehicle_model', 'car_model'],
    info: {
      label: 'Vehicle Model',
      placeholder: 'e.g., Camry',
      description: 'Model of the vehicle',
    },
  },
  {
    patterns: ['vehicle_year', 'car_year'],
    info: {
      label: 'Vehicle Year',
      placeholder: 'e.g., 2020',
      description: 'Year the vehicle was made',
    },
  },
  {
    patterns: ['vehicle_color', 'car_color'],
    info: {
      label: 'Vehicle Color',
      placeholder: 'e.g., Silver',
      description: 'Color of the vehicle',
    },
  },
  {
    patterns: ['license_plate', 'tag_number', 'plate_number'],
    info: {
      label: 'License Plate Number',
      placeholder: 'e.g., ABC1234',
      description: 'Vehicle license plate number',
    },
  },

  // === EMERGENCY CONTACT ===
  {
    patterns: ['emergency_name', 'emergency_contact'],
    info: {
      label: 'Emergency Contact Name',
      placeholder: 'e.g., Mary Doe',
      description: 'Person to contact in emergency',
    },
  },
  {
    patterns: ['emergency_phone', 'emergency_number'],
    info: {
      label: 'Emergency Contact Phone',
      placeholder: 'e.g., (404) 555-9999',
      description: 'Phone number for emergency contact',
    },
  },
  {
    patterns: ['emergency_relationship', 'emergency_relation'],
    info: {
      label: 'Emergency Contact Relationship',
      placeholder: 'e.g., Mother, Brother, Friend',
      description: 'Relationship to tenant',
    },
  },

  // === UTILITIES & AMENITIES ===
  {
    patterns: ['utilities_included', 'included_utilities'],
    info: {
      label: 'Utilities Included',
      placeholder: 'e.g., Water, Trash, Gas',
      description: 'List utilities included in rent',
    },
  },
  {
    patterns: ['utilities_tenant', 'tenant_utilities', 'tenant_pays'],
    info: {
      label: 'Tenant Pays Utilities',
      placeholder: 'e.g., Electric, Internet',
      description: 'Utilities tenant is responsible for',
    },
  },
  {
    patterns: ['appliances', 'supplied_appliances', 'included_appliances', 'may_not_be_removed'],
    info: {
      label: 'Appliances Included',
      placeholder: 'e.g., Refrigerator, Stove, Dishwasher',
      description: 'List of appliances provided with unit',
    },
  },

  // === POLICIES ===
  {
    patterns: ['pet_policy', 'pet_allowed', 'pet_type'],
    info: {
      label: 'Pet Policy',
      placeholder: 'e.g., No pets, or Cats only',
      description: 'Rules regarding pets',
    },
  },
  {
    patterns: ['smoking_policy', 'smoking_allowed'],
    info: {
      label: 'Smoking Policy',
      placeholder: 'e.g., No smoking on premises',
      description: 'Rules regarding smoking',
    },
  },
  {
    patterns: ['notice_period', 'notice_days', 'termination_notice'],
    info: {
      label: 'Notice Period',
      placeholder: 'e.g., 30 days, 60 days',
      description: 'Required notice to terminate lease',
    },
  },
  {
    patterns: ['quiet_hours', 'noise_policy'],
    info: {
      label: 'Quiet Hours',
      placeholder: 'e.g., 10 PM - 8 AM',
      description: 'Hours when noise should be minimized',
    },
  },

  // === IDENTIFICATION ===
  {
    patterns: ['ssn', 'social_security', 'tax_id'],
    info: {
      label: 'SSN / Tax ID',
      placeholder: 'XXX-XX-XXXX',
      description: 'Social Security or Tax ID number',
    },
  },
  {
    patterns: ['drivers_license', 'driver_license', 'dl_number', 'id_number'],
    info: {
      label: "Driver's License / ID Number",
      placeholder: 'e.g., GA123456789',
      description: 'State-issued ID or license number',
    },
  },
  {
    patterns: ['dob', 'date_of_birth', 'birth_date'],
    info: {
      label: 'Date of Birth',
      placeholder: 'MM/DD/YYYY',
      description: 'Date of birth',
    },
  },

  // === LEASE TERMS ===
  {
    patterns: ['lease_term', 'term_length', 'lease_duration'],
    info: {
      label: 'Lease Term Length',
      placeholder: 'e.g., 12 months',
      description: 'How long the lease lasts',
    },
  },
  {
    patterns: ['renewal_terms', 'auto_renew'],
    info: {
      label: 'Renewal Terms',
      placeholder: 'e.g., Month-to-month after initial term',
      description: 'What happens when lease expires',
    },
  },
  {
    patterns: ['early_termination', 'break_lease'],
    info: {
      label: 'Early Termination Fee',
      placeholder: 'e.g., 2 months rent',
      description: 'Penalty for breaking lease early',
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
  const apiIdLower = apiId.toLowerCase().replace(/[_\-\.]/g, ' ');
  const labelLower = originalLabel.toLowerCase();

  // Check for date patterns first
  for (const datePattern of DATE_FIELD_PATTERNS) {
    if (apiId.toLowerCase() === datePattern.pattern.toLowerCase() ||
        apiId.toLowerCase().replace(/[_\.]/g, '') === datePattern.pattern.replace(/[_\.]/g, '')) {
      return {
        label: datePattern.label,
        placeholder: datePattern.placeholder,
      };
    }
  }

  // Check against our pattern mappings
  for (const { patterns, info } of FIELD_PATTERNS) {
    for (const pattern of patterns) {
      const patternWords = pattern.replace(/_/g, ' ').split(' ');
      const matches = patternWords.every(word => 
        apiIdLower.includes(word) || labelLower.includes(word)
      );
      if (matches) {
        return info;
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

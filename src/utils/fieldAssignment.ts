/**
 * Field Assignment Utility
 * 
 * Determines who should fill each field based on standard real estate practice:
 * - ADMIN: Property manager/landlord fills before sending
 * - TENANT: Tenant/guest fills when signing
 */

export type FieldFilledBy = 'admin' | 'guest' | 'tenant';

export interface FieldAssignmentRule {
  patterns: string[];
  exactMatch?: string[];
  filledBy: FieldFilledBy;
  reason: string;
}

/**
 * Field assignment rules based on standard real estate practice
 * Order matters - first match wins
 */
export const FIELD_ASSIGNMENT_RULES: FieldAssignmentRule[] = [
  // ===== ADMIN (Property Manager/Landlord) fills these =====
  
  // Property Information
  {
    exactMatch: ['property_address', 'rental_address', 'premises_address', 'address', 'property_name', 'listing_name'],
    patterns: ['property address', 'rental address', 'premises', 'located at', 'situated at', 'property name', 'listing'],
    filledBy: 'admin',
    reason: 'Property details are known by the landlord/manager',
  },
  {
    exactMatch: ['city', 'property_city', 'state', 'property_state', 'county', 'property_county', 'zip', 'zip_code'],
    patterns: ['city', 'state', 'county', 'zip code', 'postal'],
    filledBy: 'admin',
    reason: 'Property location is known by the landlord/manager',
  },
  
  // Landlord/Management Info
  {
    exactMatch: ['landlord_name', 'lessor_name', 'owner_name', 'management_company', 'property_manager_name', 'innkeeper', 'agent_name'],
    patterns: ['landlord', 'lessor', 'innkeeper', 'property manager', 'management company', 'owner name', 'agent name', 'brand name'],
    filledBy: 'admin',
    reason: 'Landlord/manager fills their own information',
  },
  {
    exactMatch: ['landlord_address', 'lessor_address', 'owner_address', 'payment_address', 'management_address'],
    patterns: ['landlord address', 'payment address', 'management address', 'lessor address'],
    filledBy: 'admin',
    reason: 'Landlord/manager fills their own address',
  },
  {
    exactMatch: ['landlord_phone', 'lessor_phone', 'management_phone', 'office_phone', 'owner_phone'],
    patterns: ['landlord phone', 'office phone', 'management phone', 'lessor phone'],
    filledBy: 'admin',
    reason: 'Landlord/manager fills their own contact info',
  },
  {
    exactMatch: ['landlord_email', 'lessor_email', 'management_email', 'office_email', 'owner_email'],
    patterns: ['landlord email', 'office email', 'management email', 'lessor email'],
    filledBy: 'admin',
    reason: 'Landlord/manager fills their own email',
  },
  
  // Financial Terms - Set by Admin
  {
    exactMatch: ['monthly_rent', 'rent_amount', 'base_rent', 'monthly_rental', 'rental_amount'],
    patterns: ['monthly rent', 'rent amount', 'base rent', 'rental rate', 'monthly installment'],
    filledBy: 'admin',
    reason: 'Rent amount is set by the landlord',
  },
  {
    exactMatch: ['security_deposit', 'deposit_amount', 'damage_deposit'],
    patterns: ['security deposit', 'damage deposit', 'deposit amount'],
    filledBy: 'admin',
    reason: 'Deposit amount is set by the landlord',
  },
  {
    exactMatch: ['additional_rent', 'extra_rent', 'additional_charges', 'prorated_rent'],
    patterns: ['additional rent', 'extra rent', 'prorated rent', 'additional charges'],
    filledBy: 'admin',
    reason: 'Additional fees are set by the landlord',
  },
  {
    exactMatch: ['total_amount', 'total_due', 'move_in_total', 'total_rent', 'amount_due'],
    patterns: ['total amount', 'total due', 'move in total', 'amount due'],
    filledBy: 'admin',
    reason: 'Total amounts are calculated by the landlord',
  },
  
  // Fees & Penalties - Set by Admin
  {
    exactMatch: ['returned_check_fee', 'nsf_fee', 'bounced_check_fee', 'dishonored_check_fee'],
    patterns: ['returned check', 'nsf fee', 'bounced check', 'dishonored check'],
    filledBy: 'admin',
    reason: 'Returned check fee is set in lease terms',
  },
  {
    exactMatch: ['late_fee', 'late_fee_amount', 'late_charge', 'late_penalty'],
    patterns: ['late fee', 'late charge', 'late penalty'],
    filledBy: 'admin',
    reason: 'Late fee is set in lease terms',
  },
  {
    exactMatch: ['grace_period', 'grace_period_days', 'grace_days'],
    patterns: ['grace period'],
    filledBy: 'admin',
    reason: 'Grace period is set in lease terms',
  },
  {
    exactMatch: ['interest_rate', 'late_interest', 'annual_rate'],
    patterns: ['interest rate', 'per annum', 'annual rate'],
    filledBy: 'admin',
    reason: 'Interest rate is set in lease terms',
  },
  {
    exactMatch: ['pet_deposit', 'pet_fee', 'animal_deposit', 'pet_rent', 'monthly_pet_rent'],
    patterns: ['pet deposit', 'pet fee', 'pet rent', 'animal deposit'],
    filledBy: 'admin',
    reason: 'Pet fees are set by the landlord',
  },
  {
    exactMatch: ['cleaning_fee', 'cleaning_deposit', 'application_fee', 'admin_fee', 'processing_fee'],
    patterns: ['cleaning fee', 'application fee', 'admin fee', 'processing fee'],
    filledBy: 'admin',
    reason: 'Administrative fees are set by the landlord',
  },
  {
    exactMatch: ['garage_rent', 'parking_fee', 'garage_fee', 'parking_rent', 'parking_spaces'],
    patterns: ['garage rent', 'parking fee', 'parking space'],
    filledBy: 'admin',
    reason: 'Parking fees are set by the landlord',
  },
  {
    exactMatch: ['early_termination_fee', 'break_lease_fee', 'termination_fee'],
    patterns: ['early termination', 'break lease'],
    filledBy: 'admin',
    reason: 'Early termination penalty is set in lease terms',
  },
  
  // Dates - Set by Admin
  {
    exactMatch: ['lease_start', 'start_date', 'lease_start_date', 'commencement_date', 'begin_date'],
    patterns: ['lease start', 'start date', 'commencement', 'beginning date'],
    filledBy: 'admin',
    reason: 'Lease dates are agreed upon before signing',
  },
  {
    exactMatch: ['lease_end', 'end_date', 'lease_end_date', 'termination_date', 'expiration_date'],
    patterns: ['lease end', 'end date', 'termination date', 'expiration'],
    filledBy: 'admin',
    reason: 'Lease dates are agreed upon before signing',
  },
  {
    exactMatch: ['effective_date', 'agreement_effective_date'],
    patterns: ['effective date'],
    filledBy: 'admin',
    reason: 'Effective date is set by the landlord',
  },
  {
    exactMatch: ['move_in_date', 'occupancy_date'],
    patterns: ['move in date', 'occupancy date'],
    filledBy: 'admin',
    reason: 'Move-in date is agreed upon before signing',
  },
  {
    exactMatch: ['signing_date', 'execution_date', 'agreement_date', 'document_date'],
    patterns: ['signing date', 'execution date', 'agreement date', 'document date'],
    filledBy: 'admin',
    reason: 'Document date is set when preparing the document',
  },
  {
    exactMatch: ['rent_due_day', 'rent_due', 'due_date', 'payment_due'],
    patterns: ['rent due', 'payment due', 'due on'],
    filledBy: 'admin',
    reason: 'Payment due date is set in lease terms',
  },
  {
    exactMatch: ['payment_method', 'payment_methods', 'accepted_payments'],
    patterns: ['payment method', 'accepted payment', 'forms of payment'],
    filledBy: 'admin',
    reason: 'Accepted payment methods are set by the landlord',
  },
  
  // Policies & Terms - Set by Admin
  {
    exactMatch: ['lease_term', 'term_length', 'lease_duration'],
    patterns: ['lease term', 'term length', 'duration'],
    filledBy: 'admin',
    reason: 'Lease term is set by the landlord',
  },
  {
    exactMatch: ['pet_policy', 'pet_allowed', 'pets_allowed', 'smoking_policy'],
    patterns: ['pet policy', 'smoking policy', 'pets allowed'],
    filledBy: 'admin',
    reason: 'Property policies are set by the landlord',
  },
  {
    exactMatch: ['notice_period', 'notice_days', 'termination_notice'],
    patterns: ['notice period', 'termination notice'],
    filledBy: 'admin',
    reason: 'Notice period is set in lease terms',
  },
  {
    exactMatch: ['quiet_hours', 'noise_policy'],
    patterns: ['quiet hours', 'noise policy'],
    filledBy: 'admin',
    reason: 'House rules are set by the landlord',
  },
  {
    exactMatch: ['utilities_included', 'included_utilities', 'utilities_tenant', 'tenant_utilities'],
    patterns: ['utilities included', 'tenant pays', 'utilities'],
    filledBy: 'admin',
    reason: 'Utility arrangements are set in lease terms',
  },
  {
    exactMatch: ['appliances', 'supplied_appliances', 'included_appliances'],
    patterns: ['appliances included', 'supplied appliances'],
    filledBy: 'admin',
    reason: 'Included appliances are listed by the landlord',
  },
  {
    exactMatch: ['num_occupants', 'occupants_allowed', 'max_occupants'],
    patterns: ['max occupants', 'occupants allowed'],
    filledBy: 'admin',
    reason: 'Occupancy limits are set by the landlord',
  },
  {
    exactMatch: ['renewal_terms', 'auto_renew'],
    patterns: ['renewal terms', 'auto renew'],
    filledBy: 'admin',
    reason: 'Renewal terms are set in the lease',
  },
  {
    exactMatch: ['bedrooms', 'beds', 'bathrooms', 'baths', 'square_feet', 'sqft'],
    patterns: ['number of bedrooms', 'number of bathrooms', 'square feet', 'square footage'],
    filledBy: 'admin',
    reason: 'Property specifications are known by the landlord',
  },
  {
    exactMatch: ['unit', 'apt', 'apartment', 'suite', 'unit_number'],
    patterns: ['unit number', 'apt number', 'apartment number', 'suite'],
    filledBy: 'admin',
    reason: 'Unit details are known by the landlord',
  },
  
  // ===== TENANT fills these =====
  
  // Tenant Personal Info
  {
    exactMatch: ['tenant_name', 'lessee_name', 'renter_name', 'guest_name', 'occupant_name'],
    patterns: ['tenant name', 'lessee name', 'renter name', 'guest name', 'your name', 'full name'],
    filledBy: 'tenant',
    reason: 'Tenant provides their own name',
  },
  {
    exactMatch: ['tenant_email', 'lessee_email', 'renter_email', 'guest_email'],
    patterns: ['tenant email', 'renter email', 'your email'],
    filledBy: 'tenant',
    reason: 'Tenant provides their own email',
  },
  {
    exactMatch: ['tenant_phone', 'lessee_phone', 'renter_phone', 'guest_phone'],
    patterns: ['tenant phone', 'renter phone', 'your phone', 'cell phone', 'mobile'],
    filledBy: 'tenant',
    reason: 'Tenant provides their own phone number',
  },
  {
    exactMatch: ['tenant_address', 'current_address', 'previous_address'],
    patterns: ['tenant address', 'current address', 'previous address', 'your address'],
    filledBy: 'tenant',
    reason: 'Tenant provides their address information',
  },
  {
    exactMatch: ['co_tenant', 'additional_tenant', 'co_signer', 'other_occupant', 'co_tenant_name'],
    patterns: ['co tenant', 'additional tenant', 'co signer', 'other occupant'],
    filledBy: 'tenant',
    reason: 'Tenant lists additional occupants',
  },
  
  // Identification
  {
    exactMatch: ['ssn', 'social_security', 'tax_id', 'taxpayer_id'],
    patterns: ['social security', 'tax identification', 'ssn', 'tax id'],
    filledBy: 'tenant',
    reason: 'Tenant provides their own identification',
  },
  {
    exactMatch: ['drivers_license', 'driver_license', 'dl_number', 'id_number', 'license_number'],
    patterns: ['driver license', 'license number', 'id number', 'dl number'],
    filledBy: 'tenant',
    reason: 'Tenant provides their own ID',
  },
  {
    exactMatch: ['dob', 'date_of_birth', 'birth_date', 'birthdate'],
    patterns: ['date of birth', 'birth date', 'dob'],
    filledBy: 'tenant',
    reason: 'Tenant provides their own date of birth',
  },
  
  // Vehicle Information
  {
    exactMatch: ['vehicle_make', 'car_make', 'vehicle_model', 'car_model', 'vehicle_year', 'car_year'],
    patterns: ['vehicle make', 'vehicle model', 'vehicle year', 'car make', 'car model'],
    filledBy: 'tenant',
    reason: 'Tenant provides their vehicle information',
  },
  {
    exactMatch: ['vehicle_color', 'car_color', 'license_plate', 'tag_number', 'plate_number'],
    patterns: ['vehicle color', 'license plate', 'tag number', 'plate number'],
    filledBy: 'tenant',
    reason: 'Tenant provides their vehicle information',
  },
  
  // Emergency Contact
  {
    exactMatch: ['emergency_name', 'emergency_contact', 'emergency_contact_name'],
    patterns: ['emergency contact', 'emergency name'],
    filledBy: 'tenant',
    reason: 'Tenant provides their emergency contact',
  },
  {
    exactMatch: ['emergency_phone', 'emergency_number', 'emergency_contact_phone'],
    patterns: ['emergency phone', 'emergency number'],
    filledBy: 'tenant',
    reason: 'Tenant provides their emergency contact',
  },
  {
    exactMatch: ['emergency_relationship', 'emergency_relation'],
    patterns: ['emergency relationship'],
    filledBy: 'tenant',
    reason: 'Tenant provides their emergency contact',
  },
  
  // Initials per page - Tenant fills
  {
    exactMatch: ['initials', 'tenant_initials', 'lessee_initials', 'guest_initials'],
    patterns: ['initial', 'initials'],
    filledBy: 'tenant',
    reason: 'Tenant initials each page when signing',
  },
];

/**
 * Signature field rules - these are handled separately
 */
export const SIGNATURE_ASSIGNMENT_RULES = {
  tenantSignatures: ['tenant', 'lessee', 'renter', 'guest', 'occupant'],
  adminSignatures: ['landlord', 'lessor', 'owner', 'manager', 'agent', 'innkeeper', 'host', 'admin'],
};

/**
 * Get the appropriate filler (admin or tenant) for a field
 */
export function getFieldAssignment(apiId: string, label: string, category?: string): FieldFilledBy {
  const apiIdLower = apiId.toLowerCase();
  const apiIdNormalized = apiIdLower.replace(/[_\-\.]/g, '');
  const labelLower = label.toLowerCase();
  const labelNormalized = labelLower.replace(/\s+/g, '');

  // Check for signature fields first
  if (category === 'signature' || apiIdLower.includes('signature') || apiIdLower.includes('sign')) {
    // Determine if it's a tenant or admin signature
    const isTenantSig = SIGNATURE_ASSIGNMENT_RULES.tenantSignatures.some(
      pattern => apiIdLower.includes(pattern) || labelLower.includes(pattern)
    );
    return isTenantSig ? 'tenant' : 'admin';
  }

  // Check each rule in order
  for (const rule of FIELD_ASSIGNMENT_RULES) {
    // Check exact matches first (highest priority)
    if (rule.exactMatch) {
      for (const exact of rule.exactMatch) {
        const exactNormalized = exact.toLowerCase().replace(/[_\-]/g, '');
        if (apiIdLower === exact.toLowerCase() || apiIdNormalized === exactNormalized) {
          return rule.filledBy;
        }
      }
    }
    
    // Check pattern matches
    if (rule.patterns.length > 0) {
      for (const pattern of rule.patterns) {
        const patternNormalized = pattern.toLowerCase().replace(/\s+/g, '');
        if (apiIdNormalized.includes(patternNormalized) || labelNormalized.includes(patternNormalized)) {
          return rule.filledBy;
        }
      }
    }
  }

  // Default fallback based on category
  switch (category) {
    case 'property':
    case 'financial':
    case 'dates':
    case 'occupancy':
      return 'admin';
    case 'identification':
    case 'vehicle':
    case 'emergency':
    case 'contact':
      // Contact could be either - check if it's landlord/tenant specific
      if (labelLower.includes('landlord') || labelLower.includes('lessor') || 
          labelLower.includes('management') || labelLower.includes('office')) {
        return 'admin';
      }
      return 'tenant';
    case 'acknowledgment':
    case 'signature':
      return 'tenant';
    default:
      // If still unclear, default to admin (property manager reviews and fills gaps)
      return 'admin';
  }
}

/**
 * Get a human-readable explanation of why a field is assigned to a particular role
 */
export function getAssignmentReason(apiId: string, label: string): string {
  const apiIdLower = apiId.toLowerCase();
  const apiIdNormalized = apiIdLower.replace(/[_\-\.]/g, '');
  const labelLower = label.toLowerCase();
  const labelNormalized = labelLower.replace(/\s+/g, '');

  for (const rule of FIELD_ASSIGNMENT_RULES) {
    if (rule.exactMatch) {
      for (const exact of rule.exactMatch) {
        const exactNormalized = exact.toLowerCase().replace(/[_\-]/g, '');
        if (apiIdLower === exact.toLowerCase() || apiIdNormalized === exactNormalized) {
          return rule.reason;
        }
      }
    }
    
    if (rule.patterns.length > 0) {
      for (const pattern of rule.patterns) {
        const patternNormalized = pattern.toLowerCase().replace(/\s+/g, '');
        if (apiIdNormalized.includes(patternNormalized) || labelNormalized.includes(patternNormalized)) {
          return rule.reason;
        }
      }
    }
  }

  return 'Review and assign based on your workflow';
}

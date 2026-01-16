/**
 * Field Assignment Utility
 * 
 * CRITICAL RULE: Tenant ONLY fills these field types:
 * 1. Signature fields (where tenant signs)
 * 2. Date fields (where tenant dates their signature)  
 * 3. Initial fields (where tenant initials)
 * 
 * ALL OTHER FIELDS are filled by ADMIN including:
 * - Tenant name, address, phone, email (admin pre-fills from guest info)
 * - All lease content, terms, amounts, dates
 * - Everything except signature/date/initials
 */

export type FieldFilledBy = 'admin' | 'guest' | 'tenant';

export interface FieldAssignmentRule {
  patterns: string[];
  exactMatch?: string[];
  filledBy: FieldFilledBy;
  reason: string;
}

/**
 * Signature/Initial/Date field patterns that TENANT fills
 * These are the ONLY fields tenant should fill
 */
const TENANT_ONLY_PATTERNS = {
  // Signature patterns - tenant signs here
  signature: [
    'signature', 'sign here', 'signed', 'autograph',
    'tenant_signature', 'lessee_signature', 'guest_signature', 'renter_signature',
    'tenant signature', 'lessee signature', 'guest signature', 'renter signature',
    'applicant_signature', 'resident_signature', 'occupant_signature',
    'your signature', 'signer'
  ],
  // Initial patterns - tenant initials here
  initials: [
    'initial', 'initials', 'tenant_initials', 'lessee_initials', 'guest_initials',
    'tenant initials', 'lessee initials', 'guest initials', 'your initials',
    'applicant_initials', 'resident_initials', 'renter_initials'
  ],
  // Signature date patterns - date when tenant signed
  signatureDate: [
    'signature_date', 'signature date', 'date_signed', 'date signed',
    'signing_date', 'tenant_date', 'lessee_date', 'guest_date',
    'tenant date', 'lessee date', 'guest date', 'signer_date', 'signer date'
  ]
};

/**
 * Admin signature patterns - these are admin's signature fields
 */
const ADMIN_SIGNATURE_PATTERNS = [
  'landlord_signature', 'landlord signature',
  'lessor_signature', 'lessor signature',
  'owner_signature', 'owner signature',
  'manager_signature', 'manager signature',
  'host_signature', 'host signature',
  'property_manager_signature', 'property manager signature',
  'agent_signature', 'agent signature',
  'landlord_initials', 'landlord initials',
  'lessor_initials', 'lessor initials',
  'owner_initials', 'owner initials',
  'manager_initials', 'manager initials',
  'host_initials', 'host initials',
  'landlord_date', 'landlord date',
  'lessor_date', 'lessor date',
  'owner_date', 'owner date',
  'manager_date', 'manager date'
];

/**
 * Check if field is a tenant signature/initial/date field
 */
function isTenantSignatureField(apiId: string, label: string): boolean {
  const combined = `${apiId.toLowerCase()} ${label.toLowerCase()}`;
  const normalizedCombined = combined.replace(/[_\-\.]/g, ' ');
  
  // First check if it's explicitly an admin signature/initial/date
  for (const pattern of ADMIN_SIGNATURE_PATTERNS) {
    const normalizedPattern = pattern.replace(/[_\-]/g, ' ');
    if (normalizedCombined.includes(normalizedPattern)) {
      return false; // This is admin's field
    }
  }
  
  // Check if it matches any tenant-only patterns
  for (const pattern of TENANT_ONLY_PATTERNS.signature) {
    const normalizedPattern = pattern.replace(/[_\-]/g, ' ');
    if (normalizedCombined.includes(normalizedPattern)) {
      return true;
    }
  }
  
  for (const pattern of TENANT_ONLY_PATTERNS.initials) {
    const normalizedPattern = pattern.replace(/[_\-]/g, ' ');
    if (normalizedCombined.includes(normalizedPattern)) {
      return true;
    }
  }
  
  for (const pattern of TENANT_ONLY_PATTERNS.signatureDate) {
    const normalizedPattern = pattern.replace(/[_\-]/g, ' ');
    if (normalizedCombined.includes(normalizedPattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if field is an admin signature/initial/date field
 */
function isAdminSignatureField(apiId: string, label: string): boolean {
  const combined = `${apiId.toLowerCase()} ${label.toLowerCase()}`;
  const normalizedCombined = combined.replace(/[_\-\.]/g, ' ');
  
  for (const pattern of ADMIN_SIGNATURE_PATTERNS) {
    const normalizedPattern = pattern.replace(/[_\-]/g, ' ');
    if (normalizedCombined.includes(normalizedPattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the appropriate filler (admin or tenant) for a field
 * 
 * CRITICAL: Tenant ONLY fills:
 * 1. Signature fields
 * 2. Initial fields  
 * 3. Signature date fields
 * 
 * EVERYTHING ELSE is admin
 */
export function getFieldAssignment(apiId: string, label: string, category?: string): FieldFilledBy {
  // Check if it's an admin signature field first
  if (isAdminSignatureField(apiId, label)) {
    return 'admin';
  }
  
  // Check if it's a tenant signature/initial/date field
  if (isTenantSignatureField(apiId, label)) {
    return 'tenant';
  }
  
  // Check category for signature types
  if (category === 'signature') {
    // Even in signature category, default to tenant unless it's explicitly admin
    const combined = `${apiId.toLowerCase()} ${label.toLowerCase()}`;
    if (combined.includes('landlord') || combined.includes('lessor') || 
        combined.includes('owner') || combined.includes('manager') ||
        combined.includes('host') || combined.includes('agent')) {
      return 'admin';
    }
    return 'tenant';
  }
  
  // EVERYTHING ELSE is admin - tenant only signs, dates, and initials
  return 'admin';
}

/**
 * Get a human-readable explanation of why a field is assigned to a particular role
 */
export function getAssignmentReason(apiId: string, label: string): string {
  if (isAdminSignatureField(apiId, label)) {
    return 'Admin/landlord signature or initial field';
  }
  
  if (isTenantSignatureField(apiId, label)) {
    const combined = `${apiId.toLowerCase()} ${label.toLowerCase()}`;
    
    for (const pattern of TENANT_ONLY_PATTERNS.signature) {
      if (combined.includes(pattern.replace(/[_\-]/g, ' '))) {
        return 'Tenant signs this field';
      }
    }
    
    for (const pattern of TENANT_ONLY_PATTERNS.initials) {
      if (combined.includes(pattern.replace(/[_\-]/g, ' '))) {
        return 'Tenant initials this field';
      }
    }
    
    for (const pattern of TENANT_ONLY_PATTERNS.signatureDate) {
      if (combined.includes(pattern.replace(/[_\-]/g, ' '))) {
        return 'Tenant enters date when signing';
      }
    }
    
    return 'Tenant signature/initial/date field';
  }
  
  return 'Admin pre-fills all lease content before sending to tenant';
}

/**
 * Legacy export for backwards compatibility
 */
export const FIELD_ASSIGNMENT_RULES: FieldAssignmentRule[] = [];
export const SIGNATURE_ASSIGNMENT_RULES = {
  adminSignaturePatterns: ADMIN_SIGNATURE_PATTERNS,
  tenantPatterns: [...TENANT_ONLY_PATTERNS.signature, ...TENANT_ONLY_PATTERNS.initials, ...TENANT_ONLY_PATTERNS.signatureDate]
};

// Default values for GA Residential Lease - PeachHaus standard values
// These are pre-filled for admin fields when sending contracts
// NOTE: Property-specific fields (address, tenant names) should NOT have defaults

export const LEASE_SAMPLE_VALUES: Record<string, string> = {
  // Landlord Info - Company defaults
  landlord_name: "PeachHaus Group LLC",
  landlord_representative: "Ingo Schaer, Operations Manager",
  
  // NOTE: tenant_name, property_address, property_county are INTENTIONALLY OMITTED
  // These vary per contract and should be entered by the owner/guest
  
  // Lease Terms - Generic defaults
  lease_type: "1-month lease with month-to-month extension option",
  notice_to_vacate: "14-day notice required by either party",
  
  // Financial - Rent (example values, should be overridden per contract)
  rent_due_day: "9th of each month",
  late_after: "14th of the month",
  late_fee: "$50.00",
  daily_late_fee: "$30.00",
  payment_method: "ACH / wire (online payment preferred)",
  
  // Security & Fees
  escrow_bank: "Thread Bank, Rogersville, TN",
  
  // Utilities & Property
  utilities_tenant: "Gas, Water, Trash, Electricity",
  furnishing_status: "Fully Furnished",
  renters_insurance: "Optional (tenant's discretion)",
};

// Standard admin fields that should be auto-filled
export const ADMIN_FIELD_PATTERNS = [
  'landlord', 'lessor', 'escrow_bank', 'late_fee', 'daily_late_fee',
  'payment_method', 'utilities_tenant', 'furnishing_status',
  'renters_insurance', 'lease_type', 'notice_to_vacate',
  'rent_due_day', 'late_after'
];

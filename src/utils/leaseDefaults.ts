// Default values for GA Residential Lease - PeachHaus standard values
// These are pre-filled for admin fields when sending contracts

export const LEASE_SAMPLE_VALUES: Record<string, string> = {
  // Landlord Info
  landlord_name: "PeachHaus Group LLC",
  landlord_representative: "Ingo Schaer, Operations Manager",
  
  // Tenants for 3708 Canadian Way
  tenant_name: "Shankivia Daugherty, Autumn Hill, Aidan Ball",
  
  // Property - 3708 Canadian Way
  property_county: "DeKalb County, Georgia",
  property_address: "3708 Canadian Way, Tucker, GA 30084",
  
  // Dates
  lease_execution_date: "December 5, 2025",
  lease_start_date: "December 9, 2025",
  lease_end_date: "January 8, 2026",
  
  // Lease Terms
  lease_type: "1-month lease with month-to-month extension option",
  notice_to_vacate: "14-day notice required by either party",
  
  // Financial - Rent
  monthly_rent: "$6,360.00",
  rent_due_day: "9th of each month",
  late_after: "14th of the month",
  late_fee: "$50.00",
  daily_late_fee: "$30.00",
  payment_method: "ACH / wire (online payment preferred)",
  
  // Security & Fees
  security_deposit: "$1,500.00",
  escrow_bank: "Thread Bank, Rogersville, TN",
  cleaning_fee: "$400 (one-time)",
  admin_fee: "$250 (one-time)",
  
  // Utilities & Property
  utilities_tenant: "Gas, Water, Trash, Electricity",
  furnishing_status: "Fully Furnished",
  renters_insurance: "Optional (tenant's discretion)",
  
  // Third Party Authorization
  third_party_authorization: "ALE Solutions, Inc. - May pay rent/deposit, request extensions, give notice, issue notices on tenant's behalf",
};

// Standard admin fields that should be auto-filled
export const ADMIN_FIELD_PATTERNS = [
  'landlord', 'lessor', 'property_county', 'escrow_bank', 'late_fee', 'daily_late_fee',
  'payment_method', 'cleaning_fee', 'admin_fee', 'utilities_tenant', 'furnishing_status',
  'renters_insurance', 'third_party_authorization', 'lease_type', 'notice_to_vacate',
  'rent_due_day', 'late_after'
];

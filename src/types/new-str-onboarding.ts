export interface NewSTROnboardingFormData {
  // Step 1: Property Basics
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  propertyAddress: string;
  propertyType: string;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;

  // Step 2: Rental Strategy
  rentalStrategy: string;
  targetGuestAvatar: string;
  pricingGoal: string;
  expectedAdr: number | null;
  minimumStay: number | null;
  maxGuests: number | null;
  hasExistingListing: boolean;
  existingListingUrl: string;

  // Step 3: Infrastructure & Utilities
  wifiReady: boolean;
  wifiSsid: string;
  wifiPassword: string;
  smartLockInstalled: boolean;
  smartLockBrand: string;
  smartLockCode: string;
  utilitiesSetup: boolean;
  utilities: {
    electric: { provider: string; accountNumber: string };
    gas: { provider: string; accountNumber: string };
    water: { provider: string; accountNumber: string };
    trash: { provider: string; accountNumber: string };
    internet: { provider: string; accountNumber: string };
  };
  // Septic System
  hasSepticTank: boolean;
  septicLastFlushed: string;
  septicServiceCompany: string;
  // Gas Kitchen & Safety
  hasGasKitchen: boolean;
  naturalGasDetectorInstalled: boolean;
  // Shutoff Locations
  waterShutoffLocation: string;
  breakerPanelLocation: string;
  gasShutoffLocation: string;
  // HVAC
  hvacType: string;
  hvacServiceNeeds: string;

  // Step 4: Setup Status
  furnitureStatus: string;
  furnitureNotes: string;
  kitchenStatus: string;
  kitchenNotes: string;
  linensStatus: string;
  linensNotes: string;
  decorStatus: string;
  decorNotes: string;
  outdoorStatus: string;
  outdoorNotes: string;
  cleaningSuppliesStatus: string;
  cleaningSuppliesNotes: string;

  // Step 5: Operations Planning
  hasExistingCleaner: boolean;
  cleanerName: string;
  cleanerPhone: string;
  cleanerRate: number | null;
  needsCleanerReferral: boolean;
  laundrySetup: string;
  laundryNotes: string;
  supplyStorageLocation: string;
  immediateRepairs: string;
  existingVendorRelationships: string;

  // Step 6: Legal Compliance
  strPermitStatus: string;
  permitNumber: string;
  hoaRestrictions: boolean;
  hoaNotes: string;
  hoaContactName: string;
  hoaContactPhone: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  hasStrInsurance: boolean;
  entityOwnership: string;
  entityName: string;
  taxId: string;
  insuranceStatus: string;
  hoaApprovalStatus: string;
  hoaRules: string;

  // Step 7: Documents & Ownership
  governmentIdFile: File | null;
  propertyDeedFile: File | null;
  mortgageStatementFile: File | null;
  entityDocumentsFile: File | null;
  insuranceCertificateFile: File | null;
  hoaRulesFile: File | null;

  // Step 8: Listing Preferences
  photographyNeeds: string;
  photographyNotes: string;
  existingPhotosLink: string;
  listingTitleIdeas: string;
  uniqueSellingPoints: string;
  needsDesignConsultation: boolean;

  // Step 9: Marketing & Rules
  houseRules: string;
  petPolicy: string;
  petDeposit: number | null;
  petSizeRestrictions: string;
  petsAllowed: boolean;
  petDepositRules: string;

  // Step 10: House Quirks & Details
  propertyFeatures: string[];
  knownIssues: string;
  neighborNotes: string;
  parkingInstructions: string;
  maxVehicles: number | null;
  maintenanceContact: string;
  emergencyContact: string;
  emergencyContactPhone: string;
  poolHotTubInfo: string;
  specialInstructions: string;
  // Access Codes
  alarmSystemCode: string;
  gateCode: string;
  garageCode: string;
  lockboxLocation: string;
  lockboxCode: string;
  backupEntryMethod: string;
  securitySystemStatus: string;
  // Parking Details
  parkingSpaces: string;
  parkingType: string;
  parkingHoaRules: string;
  // Trash Collection
  trashBinLocation: string;
  trashPickupDay: string;
  // Safety Equipment
  smokeDetectorStatus: string;
  fireExtinguisherPresent: boolean;
  fireExtinguisherLocation: string;
  poolHotTubPresent: boolean;
}

export const initialNewSTRFormData: NewSTROnboardingFormData = {
  // Step 1
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  propertyAddress: '',
  propertyType: '',
  bedrooms: null,
  bathrooms: null,
  squareFootage: null,

  // Step 2
  rentalStrategy: '',
  targetGuestAvatar: '',
  pricingGoal: '',
  expectedAdr: null,
  minimumStay: null,
  maxGuests: null,
  hasExistingListing: false,
  existingListingUrl: '',

  // Step 3
  wifiReady: false,
  wifiSsid: '',
  wifiPassword: '',
  smartLockInstalled: false,
  smartLockBrand: '',
  smartLockCode: '',
  utilitiesSetup: false,
  utilities: {
    electric: { provider: '', accountNumber: '' },
    gas: { provider: '', accountNumber: '' },
    water: { provider: '', accountNumber: '' },
    trash: { provider: '', accountNumber: '' },
    internet: { provider: '', accountNumber: '' },
  },
  hasSepticTank: false,
  septicLastFlushed: '',
  septicServiceCompany: '',
  hasGasKitchen: false,
  naturalGasDetectorInstalled: false,
  waterShutoffLocation: '',
  breakerPanelLocation: '',
  gasShutoffLocation: '',
  hvacType: '',
  hvacServiceNeeds: '',

  // Step 4
  furnitureStatus: '',
  furnitureNotes: '',
  kitchenStatus: '',
  kitchenNotes: '',
  linensStatus: '',
  linensNotes: '',
  decorStatus: '',
  decorNotes: '',
  outdoorStatus: '',
  outdoorNotes: '',
  cleaningSuppliesStatus: '',
  cleaningSuppliesNotes: '',

  // Step 5
  hasExistingCleaner: false,
  cleanerName: '',
  cleanerPhone: '',
  cleanerRate: null,
  needsCleanerReferral: false,
  laundrySetup: '',
  laundryNotes: '',
  supplyStorageLocation: '',
  immediateRepairs: '',
  existingVendorRelationships: '',

  // Step 6
  strPermitStatus: '',
  permitNumber: '',
  hoaRestrictions: false,
  hoaNotes: '',
  hoaContactName: '',
  hoaContactPhone: '',
  insuranceProvider: '',
  insurancePolicyNumber: '',
  hasStrInsurance: false,
  entityOwnership: '',
  entityName: '',
  taxId: '',
  insuranceStatus: '',
  hoaApprovalStatus: '',
  hoaRules: '',

  // Step 7
  governmentIdFile: null,
  propertyDeedFile: null,
  mortgageStatementFile: null,
  entityDocumentsFile: null,
  insuranceCertificateFile: null,
  hoaRulesFile: null,

  // Step 8
  photographyNeeds: '',
  photographyNotes: '',
  existingPhotosLink: '',
  listingTitleIdeas: '',
  uniqueSellingPoints: '',
  needsDesignConsultation: false,

  // Step 9
  houseRules: '',
  petPolicy: '',
  petDeposit: null,
  petSizeRestrictions: '',
  petsAllowed: false,
  petDepositRules: '',

  // Step 10
  propertyFeatures: [],
  knownIssues: '',
  neighborNotes: '',
  parkingInstructions: '',
  maxVehicles: null,
  maintenanceContact: '',
  emergencyContact: '',
  emergencyContactPhone: '',
  poolHotTubInfo: '',
  specialInstructions: '',
  alarmSystemCode: '',
  gateCode: '',
  garageCode: '',
  lockboxLocation: '',
  lockboxCode: '',
  backupEntryMethod: '',
  securitySystemStatus: '',
  parkingSpaces: '',
  parkingType: '',
  parkingHoaRules: '',
  trashBinLocation: '',
  trashPickupDay: '',
  smokeDetectorStatus: '',
  fireExtinguisherPresent: false,
  fireExtinguisherLocation: '',
  poolHotTubPresent: false,
};

// Option constants
export const PROPERTY_TYPE_OPTIONS = [
  'Single Family Home',
  'Condo',
  'Townhouse',
  'Apartment',
  'Guest House/ADU',
  'Cabin',
  'Villa',
  'Other',
];

export const RENTAL_STRATEGY_OPTIONS = [
  'STR Only (Short-Term Rentals)',
  'MTR Only (Mid-Term Rentals)',
  'Hybrid (STR + MTR)',
];

export const TARGET_GUEST_OPTIONS = [
  'Business Travelers',
  'Families with Kids',
  'Couples/Romantic Getaways',
  'Digital Nomads',
  'Medical/Travel Nurses',
  'Relocating Professionals',
  'Insurance/Displaced Guests',
  'Vacation Groups',
  'Mixed/All Types',
];

export const PRICING_GOAL_OPTIONS = [
  'Maximize Revenue (Premium Pricing)',
  'High Occupancy (Competitive Pricing)',
  'Balanced (Revenue + Occupancy)',
  'Let PeachHaus Decide',
];

export const SETUP_STATUS_OPTIONS = [
  'Fully Ready',
  'Partially Ready',
  'Needs Everything',
  'In Progress',
];

export const LAUNDRY_SETUP_OPTIONS = [
  'In-Unit Washer/Dryer',
  'Shared Laundry On-Site',
  'No Laundry Facilities',
  'Planning to Add',
];

export const STR_PERMIT_STATUS_OPTIONS = [
  'Already Have Permit',
  'Application In Progress',
  'Need to Apply',
  'Not Required in My Area',
  'Not Sure',
];

export const ENTITY_OWNERSHIP_OPTIONS = [
  'Personal Name',
  'LLC',
  'Corporation',
  'Trust',
  'Partnership',
  'Other',
];

export const PHOTOGRAPHY_NEEDS_OPTIONS = [
  'Need Professional Photography',
  'Have Quality Photos Ready',
  'Have Photos but Need Updates',
  'Will Take My Own Photos',
];

export const PET_POLICY_OPTIONS = [
  'No Pets Allowed',
  'Small Pets Only (<25 lbs)',
  'Medium Pets Only (<50 lbs)',
  'All Pets Welcome',
  'Case by Case',
];

export const PROPERTY_FEATURE_OPTIONS = [
  'Pool',
  'Hot Tub',
  'Fireplace',
  'Grill/BBQ',
  'Outdoor Kitchen',
  'Fire Pit',
  'Game Room',
  'Home Theater',
  'Gym/Fitness',
  'Office/Workspace',
  'EV Charger',
  'Garage',
  'Fenced Yard',
  'Patio/Deck',
  'Mountain View',
  'Lake/Water View',
  'City View',
];

export const HVAC_TYPE_OPTIONS = [
  'Central AC/Heat',
  'Mini-Split/Ductless',
  'Window Units',
  'Heat Pump',
  'Radiator/Baseboard',
  'None/Fans Only',
];

export const PARKING_TYPE_OPTIONS = [
  'Private Driveway',
  'Garage',
  'Street Parking',
  'Carport',
  'Shared Lot',
];

export const SECURITY_STATUS_OPTIONS = [
  'Active - Monitored',
  'Active - Not Monitored',
  'Inactive',
  'Not Installed',
];

export const SMOKE_DETECTOR_OPTIONS = [
  'All Working',
  'Some Need Batteries',
  'Need to Install More',
  'Not Sure',
];

export const TRASH_DAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Varies',
];

export const INSURANCE_STATUS_OPTIONS = [
  'Active - STR Coverage',
  'Active - Standard Homeowners',
  'Need to Get Coverage',
  'Switching Providers',
];

export const HOA_APPROVAL_OPTIONS = [
  'Approved for STR',
  'Approval Pending',
  'Need to Apply',
  'No HOA',
  'Not Sure',
];

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
  peakSeasonMonths: string[];

  // Step 3: Infrastructure & Utilities
  wifiReady: boolean;
  wifiSsid: string;
  wifiPassword: string;
  smartLockInstalled: boolean;
  smartLockBrand: string;
  utilitiesSetup: boolean;
  utilities: {
    electric: { provider: string; accountNumber: string };
    gas: { provider: string; accountNumber: string };
    water: { provider: string; accountNumber: string };
    trash: { provider: string; accountNumber: string };
    internet: { provider: string; accountNumber: string };
  };

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
  preferredTurnoverTime: string;
  turnoverNotes: string;

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

  // Step 7: Documents & Ownership
  governmentIdFile: File | null;
  propertyDeedFile: File | null;
  mortgageStatementFile: File | null;
  entityDocumentsFile: File | null;
  insuranceCertificateFile: File | null;
  hoaRulesFile: File | null;

  // Step 8: Listing Preferences
  listingPlatforms: string[];
  photographyNeeds: string;
  photographyNotes: string;
  listingTitleIdeas: string;
  uniqueSellingPoints: string;
  competitorLinks: string;

  // Step 9: Marketing & Rules
  houseRules: string;
  petPolicy: string;
  petDeposit: number | null;
  petSizeRestrictions: string;
  checkoutProcedures: string;
  noisePolicy: string;
  smokingPolicy: string;
  partyPolicy: string;

  // Step 10: House Quirks & Details
  propertyFeatures: string[];
  knownIssues: string;
  neighborNotes: string;
  parkingInstructions: string;
  maxVehicles: number | null;
  maintenanceContact: string;
  emergencyContact: string;
  poolHotTubInfo: string;
  specialInstructions: string;
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
  peakSeasonMonths: [],

  // Step 3
  wifiReady: false,
  wifiSsid: '',
  wifiPassword: '',
  smartLockInstalled: false,
  smartLockBrand: '',
  utilitiesSetup: false,
  utilities: {
    electric: { provider: '', accountNumber: '' },
    gas: { provider: '', accountNumber: '' },
    water: { provider: '', accountNumber: '' },
    trash: { provider: '', accountNumber: '' },
    internet: { provider: '', accountNumber: '' },
  },

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
  preferredTurnoverTime: '',
  turnoverNotes: '',

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

  // Step 7
  governmentIdFile: null,
  propertyDeedFile: null,
  mortgageStatementFile: null,
  entityDocumentsFile: null,
  insuranceCertificateFile: null,
  hoaRulesFile: null,

  // Step 8
  listingPlatforms: [],
  photographyNeeds: '',
  photographyNotes: '',
  listingTitleIdeas: '',
  uniqueSellingPoints: '',
  competitorLinks: '',

  // Step 9
  houseRules: '',
  petPolicy: '',
  petDeposit: null,
  petSizeRestrictions: '',
  checkoutProcedures: '',
  noisePolicy: '',
  smokingPolicy: '',
  partyPolicy: '',

  // Step 10
  propertyFeatures: [],
  knownIssues: '',
  neighborNotes: '',
  parkingInstructions: '',
  maxVehicles: null,
  maintenanceContact: '',
  emergencyContact: '',
  poolHotTubInfo: '',
  specialInstructions: '',
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

export const TURNOVER_TIME_OPTIONS = [
  '2 Hours',
  '3 Hours',
  '4 Hours',
  'Same Day Flexible',
  'Next Day',
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

export const LISTING_PLATFORM_OPTIONS = [
  'Airbnb',
  'VRBO',
  'Furnished Finder',
  'Booking.com',
  'CHBO',
  'June Homes',
  'Direct Booking Website',
  'Zillow',
  'Facebook Marketplace',
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

export const PEAK_SEASON_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

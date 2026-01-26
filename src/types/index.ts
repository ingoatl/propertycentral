export interface Property {
  id: string;
  name: string;
  address: string;
  visitPrice: number;
  rentalType?: "hybrid" | "mid_term" | "long_term";
  createdAt: string;
  image_path?: string;
  propertyType?: "Client-Managed" | "Company-Owned" | "Inactive" | "On-Hold" | "Partner";
  managementFeePercentage?: number;
  nightlyRate?: number;
  orderMinimumFee?: number;
  offboardedAt?: string;
  offboardingReason?: string;
  offboardingNotes?: string;
  onHoldAt?: string;
  onHoldReason?: string;
}

export interface PartnerProperty {
  id: string;
  source_id: string;
  source_system: string;
  category: string;
  property_title: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: string;
  property_description: string;
  bedrooms: number;
  bathrooms: number;
  square_footage: number;
  max_guests: number;
  featured_image_url: string;
  gallery_images: string[];
  amenities: any;
  monthly_price: number;
  security_deposit: number;
  cleaning_fee: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  pet_policy: string;
  ical_url: string;
  existing_listing_url: string;
  virtual_tour_url: string;
  status: string;
  synced_at: string;
  created_at: string;
}

export interface PropertyMetrics {
  totalRevenue: number;
  bookingCount: number;
  avgBookingValue: number;
  occupancyRate: number;
  revPAR: number;
  adr: number;
  totalNights: number;
  avgLengthOfStay: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  growthRate: number;
}

export interface Visit {
  id: string;
  propertyId: string;
  date: string;
  time: string;
  price: number;
  notes?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  propertyId: string;
  amount: number;
  date: string;
  purpose?: string;
  filePath?: string;
  createdAt: string;
  category?: string;
  orderNumber?: string;
  orderDate?: string;
  trackingNumber?: string;
  vendor?: string;
  itemsDetail?: string;
  deliveryAddress?: string;
  lineItems?: {
    items: Array<{
      name: string;
      price: number;
    }>;
  };
  emailScreenshotPath?: string;
  isReturn?: boolean;
  parentExpenseId?: string;
  returnReason?: string;
  refundAmount?: number;
  exported?: boolean;
}

export interface OwnerRezBooking {
  id: string;
  propertyId: string | null;
  ownerrezListingId: string;
  ownerrezListingName: string;
  bookingId: string | null;
  guestName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  totalAmount: number;
  managementFee: number;
  bookingStatus: string | null;
  syncDate: string;
  createdAt: string;
}

export interface PropertySummary {
  property: Property;
  visitCount: number;
  visitTotal: number;
  expenseTotal: number;
  ownerrezRevenue: number;
  managementFees: number;
  netBalance: number;
  isManaged: boolean;
  bookingCount: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  revPAR: number;
  occupancyRate: number;
}

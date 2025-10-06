export interface Property {
  id: string;
  name: string;
  address: string;
  visitPrice: number;
  createdAt: string;
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
}

/**
 * Shared reconciliation calculation utilities
 * Ensures consistent "Due from Owner" calculations across:
 * - ReconciliationList cards
 * - Email preview modal
 * - Backend email generation
 */

export interface ReconciliationLineItem {
  id: string;
  item_type: string;
  amount: number;
  verified: boolean;
  excluded: boolean;
  description?: string;
}

export interface ReconciliationData {
  id: string;
  total_revenue: number;
  management_fee: number;
  order_minimum_fee: number;
  visit_fees: number;
  total_expenses: number;
  net_to_owner: number;
}

/**
 * Calculate "Due from Owner" from line items
 * Formula: Mgmt Fee + Visit Fees (from checked visits) + Expenses (from checked expenses)
 * Note: Filters out visit-related expenses to avoid double counting
 */
export function calculateDueFromOwnerFromLineItems(
  lineItems: ReconciliationLineItem[],
  managementFee: number,
  orderMinimumFee: number = 0
): {
  visitFees: number;
  totalExpenses: number;
  dueFromOwner: number;
} {
  // Only include verified and non-excluded line items
  const validLineItems = lineItems.filter(
    (item) => item.verified && !item.excluded
  );

  // Calculate visit fees from line items
  const visitFees = validLineItems
    .filter((item) => item.item_type === "visit")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);

  // Calculate expenses from line items, filtering out visit-related expenses to avoid double counting
  const totalExpenses = validLineItems
    .filter((item) => {
      if (item.item_type !== "expense") return false;
      
      // Check if this is a visit-related expense (these should be counted in visitFees instead)
      const description = ((item as any).description || '').toLowerCase();
      return !description.includes('visit fee') && 
             !description.includes('visit charge') &&
             !description.includes('hourly charge') &&
             !description.includes('property visit');
    })
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);

  // Calculate total due from owner
  const dueFromOwner = managementFee + orderMinimumFee + visitFees + totalExpenses;

  return {
    visitFees,
    totalExpenses,
    dueFromOwner,
  };
}

/**
 * Validate if stored reconciliation values match line items
 */
export function validateReconciliationTotals(
  reconciliation: ReconciliationData,
  lineItems: ReconciliationLineItem[]
): {
  isValid: boolean;
  visitFeesMismatch: boolean;
  expensesMismatch: boolean;
  calculatedValues: {
    visitFees: number;
    totalExpenses: number;
    dueFromOwner: number;
  };
} {
  const calculated = calculateDueFromOwnerFromLineItems(
    lineItems,
    reconciliation.management_fee,
    reconciliation.order_minimum_fee
  );

  const visitFeesMismatch = 
    Math.abs(reconciliation.visit_fees - calculated.visitFees) > 0.01;
  
  const expensesMismatch = 
    Math.abs(reconciliation.total_expenses - calculated.totalExpenses) > 0.01;

  return {
    isValid: !visitFeesMismatch && !expensesMismatch,
    visitFeesMismatch,
    expensesMismatch,
    calculatedValues: calculated,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

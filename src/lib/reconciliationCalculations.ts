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
 * Calculate "Due from Owner" from line items - ONLY APPROVED ITEMS
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
  error?: string;
} {
  try {
    // ONLY include APPROVED items: verified=true AND excluded=false
    const approvedItems = lineItems.filter(
      (item) => item.verified === true && item.excluded === false
    );

    // Calculate visit fees from approved line items
    const visitFees = approvedItems
      .filter((item) => item.item_type === "visit")
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);

    // Calculate expenses from approved line items, filtering out visit-related expenses to avoid double counting
    const totalExpenses = approvedItems
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
  } catch (error) {
    console.error("Calculation error:", error);
    return {
      visitFees: 0,
      totalExpenses: 0,
      dueFromOwner: managementFee + orderMinimumFee,
      error: "Failed to calculate totals from approved items"
    };
  }
}

// Validation function removed - we now use live calculation from approved line items only

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

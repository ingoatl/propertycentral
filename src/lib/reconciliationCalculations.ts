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
  managementFee: number
): {
  visitFees: number;
  totalExpenses: number;
  dueFromOwner: number;
  duplicatesDetected?: number;
  error?: string;
} {
  try {
    // ONLY include APPROVED items: verified=true AND excluded=false
    const approvedItems = lineItems.filter(
      (item) => item.verified === true && item.excluded === false
    );

    // WATCHDOG: Detect and log duplicate item_ids
    const itemIdCounts = new Map<string, number>();
    approvedItems.forEach((item: any) => {
      if (item.item_id) {
        const key = `${item.item_type}:${item.item_id}`;
        itemIdCounts.set(key, (itemIdCounts.get(key) || 0) + 1);
      }
    });
    
    let duplicatesDetected = 0;
    itemIdCounts.forEach((count, key) => {
      if (count > 1) {
        duplicatesDetected += count - 1;
        console.warn(`⚠️ CALCULATION WATCHDOG: Duplicate detected - ${key} appears ${count}x`);
      }
    });

    // Deduplicate by item_id for accurate calculation
    const seenItemIds = new Set<string>();
    const deduplicatedItems = approvedItems.filter((item: any) => {
      if (!item.item_id) return true; // Keep items without item_id
      const key = `${item.item_type}:${item.item_id}`;
      if (seenItemIds.has(key)) {
        console.log(`CALCULATION WATCHDOG: Excluding duplicate from calc: ${key}`);
        return false;
      }
      seenItemIds.add(key);
      return true;
    });

    // Calculate visit fees from deduplicated line items
    const visitFees = deduplicatedItems
      .filter((item) => item.item_type === "visit")
      .reduce((sum, item) => sum + Math.abs(item.amount), 0);

    // Calculate expenses from deduplicated line items, filtering out visit-related expenses
    const totalExpenses = deduplicatedItems
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

    // Calculate total due from owner (management fee already includes minimum if applicable)
    const dueFromOwner = managementFee + visitFees + totalExpenses;

    return {
      visitFees,
      totalExpenses,
      dueFromOwner,
      duplicatesDetected: duplicatesDetected > 0 ? duplicatesDetected : undefined,
    };
  } catch (error) {
    console.error("Calculation error:", error);
    return {
      visitFees: 0,
      totalExpenses: 0,
      dueFromOwner: managementFee,
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

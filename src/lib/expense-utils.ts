/**
 * Utility functions for parsing and displaying expense data
 */

/**
 * Parse raw expense purpose text to extract clean item names
 * Handles formats like:
 * - "Items Ordered Price 1 of: M2cbridge Furniture Corner..."
 * - "1 of: Product Name - For something..."
 * - Regular description text
 */
export function parseExpenseDescription(purpose: string | null | undefined): string {
  if (!purpose) return "";
  
  // Clean up the raw text
  let cleaned = purpose.trim();
  
  // Remove "Items Ordered Price" prefix pattern
  cleaned = cleaned.replace(/^Items\s+Ordered\s+Price\s*/i, "");
  
  // Remove "X of:" quantity prefix pattern (e.g., "1 of:", "2 of:")
  cleaned = cleaned.replace(/^\d+\s+of:\s*/i, "");
  
  // Remove trailing order numbers (e.g., "114-0979908-5334632")
  cleaned = cleaned.replace(/\d{3}-\d{7}-\d{7}\s*$/g, "").trim();
  
  // Remove excessive whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  
  // If it's still very long, try to extract just the product name
  if (cleaned.length > 100) {
    // Often the first part before a dash or comma is the product name
    const parts = cleaned.split(/\s*[-–—,]\s*/);
    if (parts.length > 1 && parts[0].length > 10) {
      cleaned = parts[0].trim();
    }
  }
  
  return cleaned || purpose;
}

/**
 * Get the best display name for an expense
 * Prioritizes: items_detail > parsed purpose > category
 */
export function getExpenseDisplayName(expense: {
  items_detail?: string | null;
  purpose?: string | null;
  category?: string | null;
  line_items?: { items?: Array<{ name: string; price: number }> } | null;
  vendor?: string | null;
}): string {
  // If we have line_items, create a nice summary
  if (expense.line_items?.items && expense.line_items.items.length > 0) {
    const items = expense.line_items.items;
    if (items.length === 1) {
      return items[0].name;
    }
    return `${items[0].name} + ${items.length - 1} more`;
  }
  
  // If items_detail is available and clean, use it
  if (expense.items_detail && expense.items_detail.length < 150) {
    const parsed = parseExpenseDescription(expense.items_detail);
    if (parsed.length > 5) return parsed;
  }
  
  // Parse the purpose field
  if (expense.purpose) {
    const parsed = parseExpenseDescription(expense.purpose);
    if (parsed.length > 5) return parsed;
  }
  
  // Fallback to category
  if (expense.category) return expense.category;
  
  // Last resort
  return "Expense";
}

/**
 * Format line items for display
 */
export function formatLineItems(
  lineItems: { items?: Array<{ name: string; price: number }> } | null | undefined
): string[] {
  if (!lineItems?.items || !Array.isArray(lineItems.items)) {
    return [];
  }
  
  return lineItems.items.map(item => {
    const price = typeof item.price === 'number' ? `$${item.price.toFixed(2)}` : '';
    return `${item.name}${price ? ` (${price})` : ''}`;
  });
}

/**
 * Check if an expense has any receipt attached
 */
export function hasReceipt(expense: {
  file_path?: string | null;
  original_receipt_path?: string | null;
  email_screenshot_path?: string | null;
}): boolean {
  return !!(expense.file_path || expense.original_receipt_path || expense.email_screenshot_path);
}

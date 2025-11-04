/**
 * Reconciliation validation utilities
 * Detects potential issues with reconciliation data
 */

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  itemId?: string;
  suggestedAction?: string;
}

export interface ReconciliationLineItem {
  id: string;
  item_type: string;
  description: string;
  amount: number;
  verified: boolean;
  excluded: boolean;
  exclusion_reason?: string;
}

/**
 * Detect visit-related expenses that might cause double counting
 */
export function detectVisitRelatedExpenses(
  lineItems: ReconciliationLineItem[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const visitRelatedKeywords = [
    'visit fee',
    'visit charge',
    'hourly charge',
    'property visit',
  ];
  
  const expenseItems = lineItems.filter(item => item.item_type === 'expense');
  
  for (const item of expenseItems) {
    const description = item.description.toLowerCase();
    const isVisitRelated = visitRelatedKeywords.some(keyword => 
      description.includes(keyword)
    );
    
    if (isVisitRelated && !item.excluded) {
      issues.push({
        severity: 'error',
        type: 'visit_double_count',
        message: `Expense "${item.description}" appears to be visit-related and should be excluded to avoid double counting with visit fees.`,
        itemId: item.id,
        suggestedAction: 'Exclude this item - visit fees are tracked separately'
      });
    }
  }
  
  return issues;
}

/**
 * Validate that visit line items have proper visitor names
 */
export function validateVisitNames(
  lineItems: ReconciliationLineItem[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const visitItems = lineItems.filter(item => item.item_type === 'visit');
  
  for (const item of visitItems) {
    // Check if description follows the expected format: "Property visit - [Name]"
    const match = item.description.match(/Property visit - (.+)/i);
    
    if (!match) {
      issues.push({
        severity: 'warning',
        type: 'missing_visitor_name',
        message: `Visit on ${item.description} is missing visitor name information.`,
        itemId: item.id,
        suggestedAction: 'Update visit description to include who performed the visit'
      });
    } else {
      const visitorName = match[1];
      if (visitorName.toLowerCase() === 'staff' || visitorName.toLowerCase() === 'unknown') {
        issues.push({
          severity: 'warning',
          type: 'generic_visitor_name',
          message: `Visit has generic name "${visitorName}" - consider updating to specific staff member.`,
          itemId: item.id,
          suggestedAction: 'Update to specific staff member name (e.g., "Anja Schaer", "Ingo Schaer")'
        });
      }
    }
  }
  
  return issues;
}

/**
 * Detect orphaned line items (where source record was deleted)
 */
export function detectOrphanedItems(
  lineItems: ReconciliationLineItem[],
  existingExpenseIds: string[],
  existingVisitIds: string[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const expenseLineItems = lineItems.filter(item => item.item_type === 'expense');
  const visitLineItems = lineItems.filter(item => item.item_type === 'visit');
  
  for (const item of expenseLineItems) {
    // Note: item_id is in the database but not exposed in this interface
    // This would need to be added to the interface if we want to check orphaned items
    issues.push({
      severity: 'info',
      type: 'orphaned_check_needed',
      message: 'Unable to verify if expense source exists (item_id not available in interface)',
      itemId: item.id
    });
  }
  
  return issues;
}

/**
 * Run all validation checks on a reconciliation
 */
export function validateReconciliation(
  lineItems: ReconciliationLineItem[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Check for visit-related expense double counting
  issues.push(...detectVisitRelatedExpenses(lineItems));
  
  // Validate visit names
  issues.push(...validateVisitNames(lineItems));
  
  return issues;
}

/**
 * Group issues by severity for display
 */
export function groupIssuesBySeverity(issues: ValidationIssue[]): {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
} {
  return {
    errors: issues.filter(i => i.severity === 'error'),
    warnings: issues.filter(i => i.severity === 'warning'),
    info: issues.filter(i => i.severity === 'info')
  };
}

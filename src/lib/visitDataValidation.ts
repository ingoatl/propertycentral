import { z } from "zod";

/**
 * Enhanced validation schema for visit data synchronization
 * Ensures data consistency between visits tab and owner statement emails
 */
export const visitDataSchema = z.object({
  id: z.string().uuid("Visit ID must be a valid UUID"),
  propertyId: z.string().uuid("Property ID must be a valid UUID"),
  date: z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Date must be in YYYY-MM-DD format"
  ),
  time: z.string().regex(
    /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/,
    "Time must be in HH:MM or HH:MM:SS format (24-hour)"
  ),
  amount: z.number().positive("Amount must be a positive number").finite("Amount must be a finite number"),
  visitedBy: z.string().min(1, "Visited by is required").max(100, "Visited by must be less than 100 characters"),
  description: z.string().max(2000, "Description must be less than 2000 characters").optional(),
  hours: z.number().min(0, "Hours cannot be negative").max(24, "Hours cannot exceed 24"),
});

export type ValidatedVisitData = z.infer<typeof visitDataSchema>;

/**
 * Validates visit data structure for reconciliation
 */
export const validateVisitForReconciliation = (visit: any): { 
  isValid: boolean; 
  errors: string[]; 
  data?: ValidatedVisitData 
} => {
  try {
    const validatedData = visitDataSchema.parse({
      id: visit.id,
      propertyId: visit.property_id || visit.propertyId,
      date: visit.date,
      time: visit.time,
      amount: Number(visit.price),
      visitedBy: visit.visited_by || visit.visitedBy || "Unknown",
      description: visit.notes || visit.description,
      hours: Number(visit.hours) || 0,
    });

    return {
      isValid: true,
      errors: [],
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      };
    }
    return {
      isValid: false,
      errors: ["Unknown validation error occurred"],
    };
  }
};

/**
 * Validates batch of visits for reconciliation
 */
export const validateVisitsBatch = (visits: any[]): {
  valid: ValidatedVisitData[];
  invalid: Array<{ visit: any; errors: string[] }>;
} => {
  const valid: ValidatedVisitData[] = [];
  const invalid: Array<{ visit: any; errors: string[] }> = [];

  for (const visit of visits) {
    const result = validateVisitForReconciliation(visit);
    if (result.isValid && result.data) {
      valid.push(result.data);
    } else {
      invalid.push({ visit, errors: result.errors });
    }
  }

  return { valid, invalid };
};

/**
 * Checks if visit data is synchronized with reconciliation line items
 */
export const checkVisitReconciliationSync = (
  visit: any,
  lineItem: any
): { isSynced: boolean; mismatches: string[] } => {
  const mismatches: string[] = [];

  // Check date format
  if (visit.date !== lineItem.date) {
    mismatches.push(`Date mismatch: Visit (${visit.date}) vs Line Item (${lineItem.date})`);
  }

  // Check amount
  const visitAmount = Math.abs(Number(visit.price));
  const lineItemAmount = Math.abs(Number(lineItem.amount));
  if (Math.abs(visitAmount - lineItemAmount) > 0.01) {
    mismatches.push(`Amount mismatch: Visit ($${visitAmount.toFixed(2)}) vs Line Item ($${lineItemAmount.toFixed(2)})`);
  }

  // Check ID reference
  if (visit.id !== lineItem.item_id) {
    mismatches.push(`ID mismatch: Visit (${visit.id}) vs Line Item (${lineItem.item_id})`);
  }

  return {
    isSynced: mismatches.length === 0,
    mismatches,
  };
};

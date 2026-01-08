import { z } from "zod";

// Email validation
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Please enter a valid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

// Phone validation - US phone numbers
export const phoneSchema = z
  .string()
  .trim()
  .min(10, { message: "Phone number must be at least 10 digits" })
  .max(20, { message: "Phone number is too long" })
  .refine(
    (val) => {
      // Remove all non-digit characters for validation
      const digitsOnly = val.replace(/\D/g, "");
      return digitsOnly.length >= 10 && digitsOnly.length <= 11;
    },
    { message: "Please enter a valid phone number (10-11 digits)" }
  );

// Name validation
export const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "Name must be at least 2 characters" })
  .max(100, { message: "Name must be less than 100 characters" });

// Address validation
export const addressSchema = z
  .string()
  .trim()
  .min(5, { message: "Address must be at least 5 characters" })
  .max(500, { message: "Address is too long" });

// Lead form validation schema
export const createLeadSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  opportunity_source: z.string().min(1, { message: "Please select an opportunity source" }),
  opportunity_value: z.string().optional(),
  property_address: addressSchema,
  property_type: z.string().min(1, { message: "Please select a property type" }),
  stage: z.string().min(1),
  notes: z.string().max(5000, { message: "Notes must be less than 5000 characters" }).optional(),
});

// Format phone number for display
export function formatPhoneNumber(phone: string): string {
  const digitsOnly = phone.replace(/\D/g, "");
  
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }
  
  return phone;
}

// Validate individual field and return error message
export function validateField<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): string | null {
  const result = schema.safeParse(value);
  if (!result.success) {
    return result.error.errors[0]?.message || "Invalid value";
  }
  return null;
}

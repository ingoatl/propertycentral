/**
 * Centralized Phone Number Configuration
 * =======================================
 * ALL edge functions MUST use this config to ensure consistency.
 * NEVER hardcode phone numbers in individual functions.
 * 
 * Self-healing: The watchdog validates these match GHL configuration.
 */

// Google Reviews dedicated phone number - MUST match GHL location phone
export const GOOGLE_REVIEWS_PHONE = "+14049247251";

// Main GHL phone for general SMS
export const GHL_MAIN_PHONE = "+14048005932";

// Twilio phone number for calls
export const TWILIO_PHONE = "+14046090955";

// Format phone number to E.164 format
export function formatPhoneE164(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

// Normalize phone to last 10 digits for comparison
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

// Check if two phone numbers match (ignoring formatting)
export function phonesMatch(phone1: string, phone2: string): boolean {
  return normalizePhone(phone1) === normalizePhone(phone2);
}

// All configured phone numbers for validation
export const ALL_CONFIGURED_PHONES = {
  google_reviews: GOOGLE_REVIEWS_PHONE,
  ghl_main: GHL_MAIN_PHONE,
  twilio: TWILIO_PHONE,
};

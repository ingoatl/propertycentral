/**
 * Phone number utility functions
 */

/**
 * Strips the +1 country code and formats for display
 * Always shows 10-digit US numbers without +1 prefix
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, "");
  
  // Remove leading 1 if present (US country code)
  if (cleaned.startsWith("1") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  
  // Format as (XXX) XXX-XXXX
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // For partial numbers, just format what we have
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}

/**
 * Cleans phone number to just digits, removing +1 prefix
 */
export function cleanPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  
  let cleaned = phone.replace(/\D/g, "");
  
  // Remove leading 1 if present (US country code)
  if (cleaned.startsWith("1") && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  
  return cleaned;
}

/**
 * Formats phone number for Twilio API (adds +1 if needed)
 */
export function formatPhoneForTwilio(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  
  // Add country code if not present
  if (!cleaned.startsWith("1") && cleaned.length === 10) {
    cleaned = "1" + cleaned;
  }
  
  return "+" + cleaned;
}

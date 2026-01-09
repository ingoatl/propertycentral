/**
 * Extracts a clean first name from a full name, avoiding "Unknown" patterns
 */
export function extractFirstName(fullName: string | null | undefined): string {
  if (!fullName) return '';
  
  // Check for "Unknown" patterns
  const lowerName = fullName.toLowerCase();
  if (
    lowerName.includes('unknown') ||
    lowerName === 'caller' ||
    lowerName === 'contact' ||
    lowerName.startsWith('+1') ||
    /^\d+$/.test(fullName) // Just numbers (phone number)
  ) {
    return '';
  }
  
  // Remove common titles
  const titles = ['mr.', 'mrs.', 'ms.', 'dr.', 'prof.'];
  let cleanedName = fullName;
  
  for (const title of titles) {
    if (lowerName.startsWith(title)) {
      cleanedName = fullName.slice(title.length).trim();
      break;
    }
  }
  
  // Extract first name
  const parts = cleanedName.split(' ').filter(p => p.length > 0);
  return parts[0] || '';
}

/**
 * Creates a smart greeting that avoids "Hi Unknown" patterns
 */
export function createSmartGreeting(fullName: string | null | undefined): string {
  const firstName = extractFirstName(fullName);
  return firstName ? `Hi ${firstName},` : 'Hi,';
}

/**
 * Checks if a name appears to be valid (not unknown/placeholder)
 */
export function isValidName(name: string | null | undefined): boolean {
  if (!name) return false;
  
  const lowerName = name.toLowerCase().trim();
  
  return !(
    lowerName.includes('unknown') ||
    lowerName === 'caller' ||
    lowerName === 'contact' ||
    lowerName.startsWith('+1') ||
    /^\d+$/.test(name) ||
    /^\(\d{3}\)\s?\d{3}-?\d{4}$/.test(name) // Phone number format
  );
}
/**
 * Search utility functions for inbox filtering and relevance ranking
 */

export interface SearchableItem {
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  body?: string;
  subject?: string;
}

/**
 * Parse search input into normalized terms
 */
export function parseSearchTerms(search: string): string[] {
  return search.trim().toLowerCase().split(/\s+/).filter(t => t.length > 0);
}

/**
 * Calculate search relevance score for an item
 * Higher score = more relevant match
 */
export function getSearchScore(item: SearchableItem, searchTerms: string[]): number {
  if (searchTerms.length === 0) return 100; // No search = all equal
  
  let score = 0;
  const name = item.contact_name?.toLowerCase() || "";
  const body = item.body?.toLowerCase() || "";
  const email = item.contact_email?.toLowerCase() || "";
  const phone = item.contact_phone?.replace(/[^\d]/g, '') || "";
  const subject = item.subject?.toLowerCase() || "";
  
  // Calculate if ALL terms match somewhere (required for inclusion)
  let allTermsMatch = true;
  
  for (const term of searchTerms) {
    let termMatches = false;
    
    // Exact name match = highest score
    if (name === term) {
      score += 100;
      termMatches = true;
    }
    // Name starts with term = very high
    else if (name.startsWith(term)) {
      score += 50;
      termMatches = true;
    }
    // Name contains term = high
    else if (name.includes(term)) {
      score += 30;
      termMatches = true;
    }
    
    // Email contains term
    if (email.includes(term)) {
      score += 25;
      termMatches = true;
    }
    
    // Phone contains term (numeric only search)
    const numericTerm = term.replace(/[^\d]/g, '');
    if (numericTerm && phone.includes(numericTerm)) {
      score += 20;
      termMatches = true;
    }
    
    // Subject contains term
    if (subject.includes(term)) {
      score += 15;
      termMatches = true;
    }
    
    // Body contains term = lowest score but still relevant
    if (body.includes(term)) {
      score += 10;
      termMatches = true;
    }
    
    if (!termMatches) {
      allTermsMatch = false;
    }
  }
  
  // If not all terms match, return 0 (exclude from results)
  return allTermsMatch ? score : 0;
}

/**
 * Normalize a contact name for deduplication
 * - Extracts primary name (first person if multiple)
 * - Lowercases for comparison
 * - Removes common suffixes like "and [Name]"
 */
export function normalizeContactName(name: string | undefined | null): string {
  if (!name) return "";
  
  // Handle "Name and OtherName" or "Name & OtherName" patterns
  // Extract just the first name for deduplication key
  const andMatch = name.match(/^([^&]+?)(?:\s+and\s+|\s*&\s*)/i);
  if (andMatch) {
    return andMatch[1].trim().toLowerCase();
  }
  
  return name.trim().toLowerCase();
}

/**
 * Extract email address from various formats
 * Handles: "Name <email@domain.com>", just "email@domain.com", etc.
 */
export function extractEmailAddress(email: string | undefined | null): string {
  if (!email) return "";
  
  // Try to extract email from "Name <email>" format
  const match = email.match(/<([^>]+)>/) || email.match(/[\w.-]+@[\w.-]+\.\w+/i);
  if (match) {
    return (match[1] || match[0]).toLowerCase();
  }
  
  return email.toLowerCase();
}

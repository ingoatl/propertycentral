/**
 * Email utility functions following RFC 5322 and best practices
 */

/**
 * Formats an email reply subject following RFC 5322 standards.
 * 
 * Best practices:
 * - Use a single "Re:" prefix for replies (not nested Re: Re:)
 * - Preserve the original subject for proper email threading
 * - Remove any existing Re:/RE:/Fwd:/FW: prefixes before adding new one
 * 
 * @param originalSubject - The original email subject
 * @returns Formatted reply subject with single "Re:" prefix
 */
export function formatReplySubject(originalSubject: string): string {
  if (!originalSubject) return "";
  
  // Remove any existing "Re:", "RE:", "re:", "Fwd:", "FW:" prefixes (can be nested)
  // RFC 5322 recommends a single "Re:" prefix for replies
  let cleanSubject = originalSubject
    .replace(/^(Re:\s*|RE:\s*|re:\s*|Fwd:\s*|FW:\s*|Fw:\s*)+/gi, '')
    .trim();
  
  // Add single "Re:" prefix for proper email threading
  return `Re: ${cleanSubject}`;
}

/**
 * Formats a forward subject following email conventions.
 * 
 * @param originalSubject - The original email subject
 * @returns Formatted forward subject with single "Fwd:" prefix
 */
export function formatForwardSubject(originalSubject: string): string {
  if (!originalSubject) return "";
  
  // Remove any existing prefixes
  let cleanSubject = originalSubject
    .replace(/^(Re:\s*|RE:\s*|re:\s*|Fwd:\s*|FW:\s*|Fw:\s*)+/gi, '')
    .trim();
  
  // Add single "Fwd:" prefix
  return `Fwd: ${cleanSubject}`;
}

/**
 * Checks if a subject indicates this is a reply email.
 * 
 * @param subject - The email subject to check
 * @returns True if the subject starts with Re: or similar
 */
export function isReplySubject(subject: string): boolean {
  return /^(Re:|RE:|re:)/i.test(subject.trim());
}

/**
 * Extracts the clean subject without any Re:/Fwd: prefixes.
 * 
 * @param subject - The email subject
 * @returns Clean subject without prefixes
 */
export function getCleanSubject(subject: string): string {
  if (!subject) return "";
  
  return subject
    .replace(/^(Re:\s*|RE:\s*|re:\s*|Fwd:\s*|FW:\s*|Fw:\s*)+/gi, '')
    .trim();
}

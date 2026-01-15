/**
 * Decodes HTML entities in a string.
 * Handles common entities like &#39; (apostrophe), &amp; (ampersand), etc.
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return '';
  
  // Use a textarea element to decode HTML entities (browser-native decoding)
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Strips HTML tags from a string, leaving only text content.
 */
export function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

/**
 * Cleans and formats text for display by:
 * 1. Decoding HTML entities
 * 2. Normalizing whitespace
 * 3. Trimming
 */
export function cleanTextForDisplay(text: string | null | undefined): string {
  if (!text) return '';
  
  return decodeHtmlEntities(text)
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim();
}

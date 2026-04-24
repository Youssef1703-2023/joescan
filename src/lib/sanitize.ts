/**
 * JoeScan Input Sanitization Utilities
 * Prevents XSS, injection attacks, and malformed input across all scan tools.
 */

/**
 * Strip HTML tags and script content from user input
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

/**
 * Sanitize and validate email address
 */
export function sanitizeEmail(input: string): string {
  const clean = input.trim().toLowerCase().slice(0, 254);
  return clean.replace(/[^a-z0-9.@_+-]/g, '');
}

/**
 * Sanitize IP address (v4 or v6)
 */
export function sanitizeIP(input: string): string {
  const clean = input.trim().slice(0, 45);
  // Allow only valid IP characters
  return clean.replace(/[^0-9a-fA-F.:]/g, '');
}

/**
 * Sanitize domain name
 */
export function sanitizeDomain(input: string): string {
  const clean = input.trim().toLowerCase().slice(0, 253);
  // Remove protocol prefix if present
  const withoutProtocol = clean.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return withoutProtocol.replace(/[^a-z0-9.-]/g, '');
}

/**
 * Sanitize URL (for link analysis)
 */
export function sanitizeURL(input: string): string {
  const clean = input.trim().slice(0, 2048);
  // Block javascript: and data: URIs
  if (/^(javascript|data|vbscript):/i.test(clean)) return '';
  return clean;
}

/**
 * Sanitize phone number
 */
export function sanitizePhone(input: string): string {
  return input.trim().replace(/[^0-9+()-\s]/g, '').slice(0, 20);
}

/**
 * Sanitize username for OSINT lookup
 */
export function sanitizeUsername(input: string): string {
  return input.trim().replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 64);
}

/**
 * Generic length limiter with XSS strip
 */
export function sanitizeInput(input: string, maxLength: number = 500): string {
  return sanitizeText(input).slice(0, maxLength);
}

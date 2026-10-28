/**
 * Domain-input cleaning + shape validation for DomainLookup.
 *
 * The lookup burns one of the user's limited scan attempts (see
 * scanRateLimit.ts) before any network call, so the input must be checked
 * for a plausible domain SHAPE before consumeScanAttempt() runs — the same
 * validate-before-cost rule the URL, IP and email analyzers already follow.
 * Previously the only gate was `cleanedDomain.includes('.')`, which let
 * nonsense like "a.", ".com" or "foo..bar" through to RDAP/DNS fetches
 * that could only fail.
 *
 * isValidLookupDomain is deliberately STRICTER than the old check, never
 * looser: anything it accepts is non-empty and contains a dot, so no input
 * that used to work changes behaviour. It only rejects shapes no real
 * domain can have (empty labels, leading/trailing/consecutive dots,
 * illegal characters, hyphen edges, ports).
 */

/** Strip scheme, one leading www., path and query — verbatim the old local helper. */
export function cleanDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^(https?:\/\/)?(www\.)?/, '');
  d = d.split('/')[0];
  d = d.split('?')[0];
  return d;
}

const LABEL_PATTERN = /^[a-z0-9-]+$/;

/** True when `domain` (already cleaned) is a plausible DNS hostname. */
export function isValidLookupDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (
      label.length < 1 ||
      label.length > 63 ||
      !LABEL_PATTERN.test(label) ||
      label.startsWith('-') ||
      label.endsWith('-')
    ) {
      return false;
    }
  }
  return true;
}

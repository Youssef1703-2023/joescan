/**
 * Email typo helpers.
 *
 * Previously, EmailAnalyzer's `normalizeEmail` silently rewrote the domain
 * of any address within Levenshtein distance 2 of a common provider
 * (e.g. `user@gmial.com` -> `user@gmail.com`) — on blur and again at
 * submit, before validation, the MX check and the scan itself. For a
 * security tool that is an identity-integrity problem: breach results,
 * saved scans and monitoring could silently attach to a different address
 * than the one the user typed, including a real domain that merely sits
 * close to a common one.
 *
 * The fix splits the old behaviour in two:
 * - `cleanEmailAddress`: harmless hygiene only (trim + lowercase). This
 *   is all that is ever applied automatically.
 * - `suggestEmailCorrection`: the same distance rule as the old silent
 *   rewrite, but returned as a *suggestion* the user explicitly adopts
 *   (e.g. by tapping "Did you mean ...?"). The typed address is never
 *   rewritten behind the user's back.
 */

const COMMON_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
  'icloud.com', 'aol.com', 'proton.me', 'protonmail.com', 'live.com',
  'msn.com', 'me.com', 'mac.com',
];

export function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

/** Trim surrounding whitespace and lowercase. Never touches the domain. */
export function cleanEmailAddress(rawEmail: string): string {
  return rawEmail.trim().toLowerCase();
}

/**
 * Returns a corrected address when the typed domain is within distance 2
 * of a well-known provider domain, or null when there is no close match.
 * Exact matches of a common domain return null (nothing to correct), and
 * malformed input (no single `@`) returns null.
 */
export function suggestEmailCorrection(rawEmail: string): string | null {
  const clean = cleanEmailAddress(rawEmail);
  const parts = clean.split('@');
  if (parts.length !== 2) return null;

  const [local, domain] = parts;
  if (COMMON_DOMAINS.includes(domain)) return null;

  let closestDomain = domain;
  let minDist = 3; // Max distance to suggest a correction

  for (const d of COMMON_DOMAINS) {
    const dist = levenshteinDistance(domain, d);
    if (dist > 0 && dist < minDist) {
      minDist = dist;
      closestDomain = d;
    }
  }

  return closestDomain === domain ? null : `${local}@${closestDomain}`;
}

const STORAGE_KEY = 'joescan:scan-attempts:v1';
export const SCAN_LIMIT = 12;
export const SCAN_WINDOW_MS = 60_000;

export class ScanRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`Too many scan requests. Try again in ${retryAfterSeconds} seconds.`);
    this.name = 'ScanRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Browser-side protection for public analyzers. It prevents rapid-fire
 * requests before they reach third-party intelligence services.
 */
export function consumeScanAttempt(now = Date.now()): { remaining: number } {
  if (typeof window === 'undefined') return { remaining: SCAN_LIMIT };

  let attempts: number[] = [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) attempts = saved.filter((value) => typeof value === 'number');
  } catch {
    // Treat corrupt browser storage as an empty, non-blocking history.
  }

  attempts = attempts.filter((timestamp) => timestamp > now - SCAN_WINDOW_MS);
  if (attempts.length >= SCAN_LIMIT) {
    const retryAfterSeconds = Math.max(1, Math.ceil((attempts[0] + SCAN_WINDOW_MS - now) / 1000));
    throw new ScanRateLimitError(retryAfterSeconds);
  }

  attempts.push(now);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    // The scan remains available when a privacy setting blocks local storage.
  }

  return { remaining: SCAN_LIMIT - attempts.length };
}

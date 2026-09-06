import { beforeEach, describe, expect, it } from 'vitest';
import { consumeScanAttempt, SCAN_LIMIT, SCAN_WINDOW_MS, ScanRateLimitError } from './scanRateLimit';

describe('scan rate limit', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('allows the configured number of scans and blocks the next scan in the same minute', () => {
    const start = 1_000_000;

    for (let i = 0; i < SCAN_LIMIT; i++) {
      expect(consumeScanAttempt(start + i).remaining).toBe(SCAN_LIMIT - i - 1);
    }

    expect(() => consumeScanAttempt(start + SCAN_LIMIT)).toThrow(ScanRateLimitError);
    try {
      consumeScanAttempt(start + SCAN_LIMIT);
    } catch (error) {
      expect((error as ScanRateLimitError).retryAfterSeconds).toBe(60);
    }
  });

  it('releases attempts after the one-minute window', () => {
    const start = 2_000_000;
    for (let i = 0; i < SCAN_LIMIT; i++) consumeScanAttempt(start + i);

    expect(consumeScanAttempt(start + SCAN_WINDOW_MS + SCAN_LIMIT).remaining).toBe(SCAN_LIMIT - 1);
  });
});

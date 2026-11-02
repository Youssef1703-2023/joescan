import { describe, expect, it } from 'vitest';
import { parseScanUrl } from './scanUrl';

describe('parseScanUrl', () => {
  it('prepends http:// to a bare domain', () => {
    const parsed = parseScanUrl('example.com');
    expect(parsed?.targetUrl).toBe('http://example.com');
    expect(parsed?.urlObj.hostname).toBe('example.com');
    // The http:// came from us, not from the user.
    expect(parsed?.schemeSpecified).toBe(false);
  });

  it('preserves an explicit https scheme, path and query', () => {
    const parsed = parseScanUrl('https://example.com/path?q=1');
    expect(parsed?.targetUrl).toBe('https://example.com/path?q=1');
    expect(parsed?.urlObj.hostname).toBe('example.com');
    expect(parsed?.schemeSpecified).toBe(true);
  });

  it('trims surrounding whitespace before parsing', () => {
    const parsed = parseScanUrl('  example.com  ');
    expect(parsed?.targetUrl).toBe('http://example.com');
  });

  it('returns null for inputs new URL cannot parse', () => {
    expect(parseScanUrl('http://')).toBeNull();
    expect(parseScanUrl('://bad')).toBeNull();
    // Invalid port: new URL throws, so this must not consume a scan attempt.
    expect(parseScanUrl('example.com:99999')).toBeNull();
    expect(parseScanUrl('http://example.com:abc')).toBeNull();
  });
});

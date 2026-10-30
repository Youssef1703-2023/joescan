import { describe, expect, it } from 'vitest';
import { cleanDomain, isValidLookupDomain } from './domainValidation';

describe('cleanDomain', () => {
  it('strips scheme, www, path and query — the old component behaviour', () => {
    expect(cleanDomain('https://www.google.com/path?q=1')).toBe('google.com');
    expect(cleanDomain('http://example.com/')).toBe('example.com');
    expect(cleanDomain('www.example.com')).toBe('example.com');
  });

  it('trims surrounding whitespace and lowercases', () => {
    expect(cleanDomain('  EXAMPLE.com  ')).toBe('example.com');
  });

  it('leaves a bare domain untouched', () => {
    expect(cleanDomain('sub.example.co.uk')).toBe('sub.example.co.uk');
  });
});

describe('isValidLookupDomain', () => {
  it('accepts ordinary domains and subdomains', () => {
    expect(isValidLookupDomain('google.com')).toBe(true);
    expect(isValidLookupDomain('sub.domain.co.uk')).toBe(true);
    expect(isValidLookupDomain('a.b')).toBe(true);
  });

  it('accepts punycode labels', () => {
    expect(isValidLookupDomain('xn--fsq.com')).toBe(true);
  });

  it('rejects empty input and single labels', () => {
    expect(isValidLookupDomain('')).toBe(false);
    expect(isValidLookupDomain('com')).toBe(false);
  });

  it('rejects empty labels: leading, trailing and consecutive dots', () => {
    expect(isValidLookupDomain('a.')).toBe(false);
    expect(isValidLookupDomain('.com')).toBe(false);
    expect(isValidLookupDomain('foo..bar')).toBe(false);
  });

  it('rejects hyphen edges on any label', () => {
    expect(isValidLookupDomain('-foo.com')).toBe(false);
    expect(isValidLookupDomain('foo-.com')).toBe(false);
    expect(isValidLookupDomain('foo.-bar.com')).toBe(false);
  });

  it('rejects characters no hostname can contain', () => {
    expect(isValidLookupDomain('foo_bar.com')).toBe(false);
    expect(isValidLookupDomain('foo bar.com')).toBe(false);
    // A port is not part of a domain; the old check let this through to RDAP.
    expect(isValidLookupDomain('google.com:8080')).toBe(false);
  });

  it('rejects over-long input', () => {
    expect(isValidLookupDomain(`${'a'.repeat(64)}.com`)).toBe(false);
    expect(isValidLookupDomain(`${'a.'.repeat(130)}com`)).toBe(false);
    // Exact total-length boundary: 63+63+63+62 + 3 dots = 254.
    expect(
      isValidLookupDomain(
        `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`,
      ),
    ).toBe(false);
  });

  it('accepts inputs exactly at the length boundaries', () => {
    // Longest allowed single label.
    expect(isValidLookupDomain(`${'a'.repeat(63)}.com`)).toBe(true);
    // Longest allowed total length: 63+63+63+61 + 3 dots = 253.
    expect(
      isValidLookupDomain(
        `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`,
      ),
    ).toBe(true);
  });
});

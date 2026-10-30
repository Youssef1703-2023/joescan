import { describe, expect, it } from 'vitest';
import {
  cleanEmailAddress,
  levenshteinDistance,
  suggestEmailCorrection,
} from './emailTypo';

describe('cleanEmailAddress', () => {
  it('trims whitespace and lowercases, but never rewrites the domain', () => {
    expect(cleanEmailAddress('  User@Gmial.COM  ')).toBe('user@gmial.com');
  });
});

describe('levenshteinDistance', () => {
  it('measures single-character edits', () => {
    expect(levenshteinDistance('gmial.com', 'gmail.com')).toBe(2);
    expect(levenshteinDistance('gmal.com', 'gmail.com')).toBe(1);
    expect(levenshteinDistance('gmail.com', 'gmail.com')).toBe(0);
  });
});

describe('suggestEmailCorrection', () => {
  it('suggests a correction at distance 1', () => {
    expect(suggestEmailCorrection('user@gmal.com')).toBe('user@gmail.com');
  });

  it('suggests a correction at distance 2 (the old silent-rewrite threshold)', () => {
    expect(suggestEmailCorrection('user@gmial.com')).toBe('user@gmail.com');
  });

  it('suggests nothing at distance 3 or more', () => {
    expect(suggestEmailCorrection('user@gmxyz.com')).toBeNull();
    expect(suggestEmailCorrection('user@heloo.com')).toBeNull();
  });

  it('suggests nothing for an exact common domain', () => {
    expect(suggestEmailCorrection('user@gmail.com')).toBeNull();
  });

  it('suggests nothing for malformed input', () => {
    expect(suggestEmailCorrection('not-an-email')).toBeNull();
    expect(suggestEmailCorrection('a@b@c.com')).toBeNull();
  });

  it('suggests nothing for an unrelated real-looking domain', () => {
    expect(suggestEmailCorrection('user@example.com')).toBeNull();
  });
});

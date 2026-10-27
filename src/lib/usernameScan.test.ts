import { describe, expect, it } from 'vitest';
import { countUsernameStealers, usernameBreachRisk } from './usernameScan';

describe('countUsernameStealers', () => {
  it('counts the stealers list when present', () => {
    expect(countUsernameStealers({ stealers: [{}, {}], total_results: 5 })).toBe(2);
  });

  it('falls back to total_results when the stealers list is empty', () => {
    expect(countUsernameStealers({ stealers: [], total_results: 3 })).toBe(3);
  });

  it('returns 0 for an empty result, null, and undefined', () => {
    expect(countUsernameStealers({ stealers: [], total_results: 0 })).toBe(0);
    expect(countUsernameStealers(null)).toBe(0);
    expect(countUsernameStealers(undefined)).toBe(0);
  });
});

describe('usernameBreachRisk', () => {
  it('is High when stealers are found', () => {
    expect(usernameBreachRisk({ stealers: [{}], total_results: 1 })).toBe('High');
  });

  it('is High when only total_results reports hits', () => {
    expect(usernameBreachRisk({ stealers: [], total_results: 2 })).toBe('High');
  });

  it('is Low for a clean result and for null', () => {
    expect(usernameBreachRisk({ stealers: [], total_results: 0 })).toBe('Low');
    expect(usernameBreachRisk(null)).toBe('Low');
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('firebase/auth', () => ({
  getRedirectResult: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn((...args: unknown[]) => ({ __doc: args })),
  setDoc: vi.fn(),
}));
vi.mock('./firebase', () => ({
  auth: { __auth: true },
  db: { __db: true },
}));

import { getRedirectResult } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import {
  GOOGLE_REDIRECT_FALLBACK_CODES,
  consumeGoogleRedirectResult,
  saveGoogleUserToFirestore,
  shouldFallbackToRedirect,
} from './googleSignIn';

const mockedGetRedirectResult = vi.mocked(getRedirectResult);
const mockedSetDoc = vi.mocked(setDoc);
const mockedDoc = vi.mocked(doc);

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'uid-1',
    email: 'Joe@Example.com',
    displayName: 'Joe',
    ...overrides,
  } as never;
}

describe('googleSignIn', () => {
  describe('shouldFallbackToRedirect', () => {
    it.each([
      ['auth/internal-error', true],
      ['auth/popup-blocked', true],
      ['auth/web-storage-unsupported', true],
    ])('falls back on %s', (code, expected) => {
      expect(shouldFallbackToRedirect({ code })).toBe(expected);
    });

    it.each([
      ['auth/popup-closed-by-user', false],
      ['auth/cancelled-popup-request', false],
      ['auth/user-cancelled', false],
      ['auth/invalid-credential', false],
      ['auth/multi-factor-auth-required', false],
      ['auth/unauthorized-domain', false],
    ])('does not fall back on %s', (code, expected) => {
      expect(shouldFallbackToRedirect({ code })).toBe(expected);
    });

    it('does not fall back on non-error values', () => {
      expect(shouldFallbackToRedirect(undefined)).toBe(false);
      expect(shouldFallbackToRedirect(null)).toBe(false);
      expect(shouldFallbackToRedirect('auth/internal-error')).toBe(false);
      expect(shouldFallbackToRedirect({})).toBe(false);
      expect(shouldFallbackToRedirect({ code: 42 })).toBe(false);
    });

    it('fallback set holds exactly the popup-mechanism codes', () => {
      expect([...GOOGLE_REDIRECT_FALLBACK_CODES].sort()).toEqual([
        'auth/internal-error',
        'auth/popup-blocked',
        'auth/web-storage-unsupported',
      ]);
    });
  });

  describe('saveGoogleUserToFirestore', () => {
    beforeEach(() => vi.clearAllMocks());

    it('writes uid, lowercased email and display name with merge', async () => {
      await saveGoogleUserToFirestore(fakeUser());
      expect(mockedDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'uid-1');
      expect(mockedSetDoc).toHaveBeenCalledWith(expect.anything(), {
        uid: 'uid-1',
        email: 'joe@example.com',
        name: 'Joe',
      }, { merge: true });
    });

    it('tolerates a missing email and name', async () => {
      await saveGoogleUserToFirestore(fakeUser({ email: null, displayName: null }));
      expect(mockedSetDoc).toHaveBeenCalledWith(expect.anything(), {
        uid: 'uid-1',
        email: '',
        name: '',
      }, { merge: true });
    });
  });

  describe('consumeGoogleRedirectResult', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns no user and no error when no redirect is pending', async () => {
      mockedGetRedirectResult.mockResolvedValue(null as never);
      await expect(consumeGoogleRedirectResult()).resolves.toEqual({ user: null, error: null });
      expect(mockedSetDoc).not.toHaveBeenCalled();
    });

    it('saves the profile and returns the user with no error on a pending result', async () => {
      const user = fakeUser();
      mockedGetRedirectResult.mockResolvedValue({ user } as never);
      await expect(consumeGoogleRedirectResult()).resolves.toEqual({ user, error: null });
      expect(mockedSetDoc).toHaveBeenCalled();
    });

    it('returns the error instead of throwing when resolution fails', async () => {
      const boom = new Error('boom');
      mockedGetRedirectResult.mockRejectedValue(boom);
      await expect(consumeGoogleRedirectResult()).resolves.toEqual({ user: null, error: boom });
    });

    it('still returns the user with no error when the profile save fails', async () => {
      const user = fakeUser();
      mockedGetRedirectResult.mockResolvedValue({ user } as never);
      mockedSetDoc.mockRejectedValue(new Error('firestore down'));
      await expect(consumeGoogleRedirectResult()).resolves.toEqual({ user, error: null });
    });
  });
});

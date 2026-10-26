import { getRedirectResult } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Popup-mechanism failures worth retrying as a full-page redirect.
 *
 * The popup path opens a window and leans on the gapi iframe; the redirect
 * path navigates the whole page to the same Firebase auth handler instead.
 * So a failure in the popup machinery itself (blocked window, unavailable
 * web storage, or the opaque internal-error the popup flow surfaces when
 * its pre-flight fails) is a reason to try redirect, while user-driven
 * cancellations and credential errors are not — redirecting after the user
 * deliberately closed the popup would just nag them with a navigation.
 */
export const GOOGLE_REDIRECT_FALLBACK_CODES = new Set([
  'auth/internal-error',
  'auth/popup-blocked',
  'auth/web-storage-unsupported',
]);

export function shouldFallbackToRedirect(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && GOOGLE_REDIRECT_FALLBACK_CODES.has(code);
}

/** Save (or refresh) the Google user's profile row after any Google sign-in. */
export async function saveGoogleUserToFirestore(user: User): Promise<void> {
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email?.toLowerCase() || '',
    name: user.displayName || '',
  }, { merge: true });
}

/**
 * Storage key for a redirect error that must survive one reload.
 *
 * A toast alone is not enough evidence: it auto-dismisses after seconds
 * and vanishes entirely on reload, so a failed redirect could come and go
 * before anyone looked. Persisting the error lets the app re-surface it
 * on the next mount, once, and then forget it.
 */
const REDIRECT_ERROR_STORAGE_KEY = 'joescan:redirect-error';

export interface StoredRedirectError {
  code?: string;
  message: string;
}

function readStorage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

/** Persist a redirect failure so it can be re-surfaced after a reload. */
export function storeRedirectError(error: StoredRedirectError): void {
  try {
    readStorage()?.setItem(REDIRECT_ERROR_STORAGE_KEY, JSON.stringify(error));
  } catch {
    // Storage unavailable (private mode, tests) — the toast still shows.
  }
}

/**
 * Take a previously stored redirect error, if any. Returns it once and
 * clears it, so it is re-surfaced exactly once after a reload, never on
 * every mount. Returns null when nothing was stored or it is unreadable.
 */
export function takeStoredRedirectError(): StoredRedirectError | null {
  const storage = readStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(REDIRECT_ERROR_STORAGE_KEY);
    if (!raw) return null;
    storage.removeItem(REDIRECT_ERROR_STORAGE_KEY);
    const parsed = JSON.parse(raw) as StoredRedirectError;
    return typeof parsed?.message === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/** Drop any stored redirect error (e.g. after a successful sign-in). */
export function clearStoredRedirectError(): void {
  try {
    readStorage()?.removeItem(REDIRECT_ERROR_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Complete a Google sign-in that fell back to redirect. Call once on app
 * mount: after the auth handler redirects back, this resolves the pending
 * credential and saves the profile row. Returns the user (or null when
 * there is no pending redirect result) together with any completion error.
 *
 * It never throws to the caller: a failed redirect completion must not
 * break page load. But the error is returned, not swallowed — a previous
 * version swallowed it and left users signed out with no explanation at
 * all. MFA-after-redirect is the known gap — the MFA challenge UI lives
 * in the popup dialog, so an MFA-required redirect result leaves the
 * user signed out to retry via popup instead of surfacing a dead end here.
 */
export async function consumeGoogleRedirectResult(): Promise<{ user: User | null; error: unknown }> {
  let result;
  try {
    result = await getRedirectResult(auth);
  } catch (err) {
    console.warn('Google redirect sign-in could not be completed:', err);
    return { user: null, error: err };
  }
  if (!result?.user) return { user: null, error: null };
  try {
    await saveGoogleUserToFirestore(result.user);
  } catch (err) {
    console.warn('Saving Google user profile after redirect failed:', err);
  }
  return { user: result.user, error: null };
}

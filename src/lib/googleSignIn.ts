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
 * Complete a Google sign-in that fell back to redirect. Call once on app
 * mount: after the auth handler redirects back, this resolves the pending
 * credential and saves the profile row. Returns the user, or null when
 * there is no pending redirect result.
 *
 * Never throws to the caller: a failed redirect completion must not break
 * page load. MFA-after-redirect is the known gap — the MFA challenge UI
 * lives in the popup dialog, so an MFA-required redirect result leaves the
 * user signed out to retry via popup instead of surfacing a dead end here.
 */
export async function consumeGoogleRedirectResult(): Promise<User | null> {
  let result;
  try {
    result = await getRedirectResult(auth);
  } catch (err) {
    console.warn('Google redirect sign-in could not be completed:', err);
    return null;
  }
  if (!result?.user) return null;
  try {
    await saveGoogleUserToFirestore(result.user);
  } catch (err) {
    console.warn('Saving Google user profile after redirect failed:', err);
  }
  return result.user;
}

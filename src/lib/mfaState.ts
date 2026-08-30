import { multiFactor, type User } from 'firebase/auth';

/**
 * True MFA state comes from Firebase Auth itself (server-side), not from a
 * Firestore flag. A user with at least one enrolled second factor has MFA.
 */
export function hasMfaEnrolled(user: User): boolean {
  return multiFactor(user).enrolledFactors.length > 0;
}

/**
 * During an active sign-in session Firebase exposes the mfaPendingCredential
 * on the resolver only, so this lightweight flag mirrors the auth flow in
 * AuthModal/App: after sign-in completes without MFA challenge, an unenrolled
 * user is "pending enrollment", an enrolled user passed the challenge already
 * (resolveSignIn succeeded).
 */
const MFA_DISMISS_KEY = 'joescan_mfa_dismissed';

export function isMfaDismissed(uid: string): boolean {
  try {
    return localStorage.getItem(`${MFA_DISMISS_KEY}_${uid}`) === 'true';
  } catch {
    return false;
  }
}

export function dismissMfaPrompt(uid: string): void {
  try {
    localStorage.setItem(`${MFA_DISMISS_KEY}_${uid}`, 'true');
  } catch {
    // private mode — prompt simply reappears next session
  }
}

export function clearMfaDismissal(uid: string): void {
  try {
    localStorage.removeItem(`${MFA_DISMISS_KEY}_${uid}`);
  } catch {
    // noop
  }
}

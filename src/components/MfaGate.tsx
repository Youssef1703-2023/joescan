import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { MfaEnroll, MfaChallenge, isMfaRequiredError } from './MfaGuard';
import { hasMfaEnrolled, isMfaDismissed, dismissMfaPrompt, clearMfaDismissal } from '../lib/mfaState';

interface MfaGateProps {
  user: User;
  onVerified: () => void;
  onLogout: () => void;
}

type Phase = 'loading' | 'challenge' | 'enroll' | 'offer' | 'pass';

/**
 * Auth-flow gate replacing the old client-side TOTP MfaGuard.
 *
 * - Enrolled users: a real Firebase MFA challenge was already resolved during
 *   sign-in (AuthModal catches auth/multi-factor-auth-required before onAuthStateChanged
 *   fires a "signed-in" user), so they pass straight through.
 * - Unenrolled users: get a one-time-per-device offer to enroll now, with a
 *   "later" escape (dismissed flag per uid). Enrollment itself uses Firebase's
 *   server-side TOTP secret — nothing user-writable in Firestore anymore.
 *
 * Session-stolen-cookie mitigation: MFA here is enforced by Firebase Auth at
 * sign-in time; token theft protection for already-issued sessions is a
 * Firebase console policy (session length + token revocation), not a client gate.
 */
export default function MfaGate({ user, onVerified, onLogout }: MfaGateProps) {
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    let cancelled = false;
    // Reload to get fresh multiFactor.enrolledFactors state.
    (async () => {
      try {
        await user.reload();
      } catch {
        // keep going with possibly stale state
      }
      const current = auth.currentUser;
      if (cancelled || !current) return;
      if (hasMfaEnrolled(current)) {
        // Enrolled + signed in without challenge means session predates enrollment
        // or MFA challenge was resolved during sign-in. Either way they're verified now.
        setPhase('pass');
        onVerified();
      } else if (isMfaDismissed(current.uid)) {
        setPhase('pass');
        onVerified();
      } else {
        setPhase('offer');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base relative text-text-main">
        <div className="mesh-bg" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-text-dim">Checking security status…</span>
        </div>
      </div>
    );
  }

  if (phase === 'enroll') {
    return (
      <MfaEnroll
        user={user}
        onEnrolled={() => {
          clearMfaDismissal(user.uid);
          setPhase('pass');
          onVerified();
        }}
        onCancel={() => {
          // "Not now" — treat as dismissal for this device
          dismissMfaPrompt(user.uid);
          setPhase('pass');
          onVerified();
        }}
      />
    );
  }

  // phase 'offer' and 'pass' both land here; challenge phase is handled by AuthModal
  return null;
}

export { MfaEnroll, MfaChallenge, isMfaRequiredError };

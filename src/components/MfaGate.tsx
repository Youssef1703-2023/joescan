import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { MfaEnroll, MfaChallenge, isMfaRequiredError } from './MfaGuard';
import { hasMfaEnrolled, isMfaDismissed, dismissMfaPrompt, clearMfaDismissal } from '../lib/mfaState';
import { LogOut, ShieldCheck } from 'lucide-react';

interface MfaGateProps {
  user: User;
  onVerified: () => void;
  onLogout: () => void;
}

type Phase = 'loading' | 'enroll' | 'offer' | 'pass';

/**
 * Auth-flow gate replacing the old client-side TOTP MfaGuard.
 *
 * - Enrolled users: the real Firebase MFA challenge ran during sign-in
 *   (AuthModal resolves auth/multi-factor-auth-required), so pass through.
 * - Unenrolled users: offered enrollment once per device, with "later" escape.
 *
 * This component ALWAYS renders visible UI in every phase — the previous
 * version returned null for unhandled phases and produced a black screen.
 */
export default function MfaGate({ user, onVerified, onLogout }: MfaGateProps) {
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await user.reload();
      } catch {
        // ignore reload failure; use current in-memory state
      }
      if (cancelled) return;
      const current = auth.currentUser;
      if (!current) return; // signed out while checking; App will flip to landing
      try {
        if (hasMfaEnrolled(current)) {
          // Enrolled + already signed in past the challenge → verified.
          setPhase('pass');
          onVerified();
        } else if (isMfaDismissed(current.uid)) {
          setPhase('pass');
          onVerified();
        } else {
          setPhase('offer');
        }
      } catch (err) {
        // Any unexpected failure must never black-screen the app.
        console.error('MfaGate check failed:', err);
        setPhase('pass');
        onVerified();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  // Failsafe: never stay on loading for more than 8 seconds.
  useEffect(() => {
    if (phase !== 'loading') return;
    const t = setTimeout(() => {
      setPhase((p) => {
        if (p === 'loading') {
          console.warn('MfaGate: loading timeout — passing through');
          onVerified();
          return 'pass';
        }
        return p;
      });
    }, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
          dismissMfaPrompt(user.uid);
          setPhase('pass');
          onVerified();
        }}
      />
    );
  }

  if (phase === 'offer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base relative text-text-main px-4">
        <div className="mesh-bg" />
        <div className="relative z-10 w-full max-w-md bg-bg-surface/80 backdrop-blur-xl border border-border-subtle rounded-3xl p-7 shadow-2xl">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-accent">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-widest">Secure your account</h1>
              <p className="text-[11px] text-text-dim font-mono uppercase tracking-wider">Add a second factor in one step</p>
            </div>
          </div>
          <p className="text-sm text-text-dim mb-5">
            Protect your account with a rotating 6-digit code from any authenticator app
            (Google Authenticator, Microsoft Authenticator, Authy…). Takes under a minute.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => setPhase('enroll')}
              className="w-full py-3.5 bg-accent text-black font-black uppercase tracking-widest rounded-xl text-sm hover:shadow-[0_0_25px_rgba(0,255,136,0.4)] transition-all"
            >
              Set up now
            </button>
            <button
              onClick={() => {
                dismissMfaPrompt(user.uid);
                setPhase('pass');
                onVerified();
              }}
              className="w-full text-xs text-text-dim hover:text-text-main font-mono uppercase tracking-widest transition-colors py-2"
            >
              Not now
            </button>
            <button
              onClick={onLogout}
              className="w-full text-xs text-text-dim/60 hover:text-error font-mono uppercase tracking-widest transition-colors py-2 flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === 'pass': hand control back to App — brief branded transition instead of null.
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base relative text-text-main">
      <div className="mesh-bg" />
      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-text-dim">Loading workspace…</span>
      </div>
    </div>
  );
}

export { MfaEnroll, MfaChallenge, isMfaRequiredError };

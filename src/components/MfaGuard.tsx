import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ShieldAlert, KeyRound, QrCode, Smartphone, ArrowLeft, Copy, CheckCircle } from 'lucide-react';
import {
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
  type MultiFactorError,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { QRCodeSVG } from 'qrcode.react';

/**
 * Real Firebase Auth TOTP MFA.
 *
 * Enrollment: the TOTP secret is generated SERVER-SIDE by Firebase
 * (TotpMultiFactorGenerator.generateSecret(multiFactor(user).session)) and the
 * verification happens as part of Firebase Auth itself — the secret never
 * lives in a user-writable Firestore document and cannot be bypassed by
 * replaying a stolen session cookie, because the code becomes part of
 * sign-in (multiFactor assertion), not a client-side gate.
 *
 * Sign-in challenge: shown when Firebase raises auth/multi-factor-auth-required
 * (handled by the caller via onMfaError) — this component renders the resolver
 * UI for a pending MultiFactorError.
 */

interface MfaSetupProps {
  user: User;
  onEnrolled: () => void;
  onCancel?: () => void;
}

interface MfaChallengeProps {
  error: MultiFactorError;
  onResolved: () => void;
  onCancel?: () => void;
}

export function isMfaRequiredError(err: unknown): err is MultiFactorError {
  return !!err && typeof err === 'object' && (err as any).code === 'auth/multi-factor-auth-required';
}

// ─── Enrollment flow (first-time setup) ───
export function MfaEnroll({ user, onEnrolled, onCancel }: MfaSetupProps) {
  const [phase, setPhase] = useState<'choose' | 'qr' | 'manual'>('choose');
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [otpUrl, setOtpUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Server-side secret generation via a multi-factor session.
        const session = await multiFactor(user).getSession();
        const totpSecret = await TotpMultiFactorGenerator.generateSecret(session);
        if (cancelled) return;
        const email = user.email || 'operator';
        setSecret(totpSecret);
        setOtpUrl(totpSecret.generateQrCodeUrl(email, 'JoeScan'));
      } catch (err: any) {
        setError(err?.message || 'Failed to start MFA enrollment.');
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const copySecret = () => {
    if (!secret) return;
    navigator.clipboard.writeText(secret.sharedSecretKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret) return;
    setError('');
    setVerifying(true);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.replace(/\s+/g, ''));
      await multiFactor(user).enroll(assertion, 'Authenticator App');
      onEnrolled();
    } catch (err: any) {
      if (err?.code === 'auth/invalid-verification-code') {
        setError('Invalid code. Check your authenticator app and try again.');
      } else if (err?.code === 'auth/maximum-second-factor-count-exceeded') {
        setError('This account already has the maximum number of second factors.');
      } else {
        setError(err?.message || 'Enrollment failed.');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base relative text-text-main px-4">
      <div className="mesh-bg" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-bg-surface/80 backdrop-blur-xl border border-border-subtle rounded-3xl p-7 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-accent">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-widest">Two-Factor Auth</h1>
            <p className="text-[11px] text-text-dim font-mono uppercase tracking-wider">Secured by Firebase Authentication</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!secret && !error && <p className="text-sm text-text-dim">Preparing secure enrollment…</p>}

        {secret && phase === 'choose' && (
          <div className="space-y-4">
            <p className="text-sm text-text-dim">
              Add an extra layer of protection. You'll be asked for a rotating 6-digit code from your
              authenticator app when you sign in.
            </p>
            <button
              onClick={() => setPhase('qr')}
              className="w-full p-5 bg-bg-base border-2 border-border-subtle rounded-xl hover:border-accent/50 hover:bg-accent/5 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-accent"><QrCode className="w-7 h-7" /></div>
                <div className="flex-1">
                  <div className="font-bold text-text-main text-sm uppercase tracking-wider">Scan QR Code</div>
                  <div className="text-[11px] text-text-dim mt-0.5">Use any authenticator app</div>
                </div>
                <div className="text-text-dim group-hover:text-accent transition-colors text-lg">›</div>
              </div>
            </button>
            <button
              onClick={() => setPhase('manual')}
              className="w-full p-5 bg-bg-base border-2 border-border-subtle rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400"><KeyRound className="w-7 h-7" /></div>
                <div className="flex-1">
                  <div className="font-bold text-text-main text-sm uppercase tracking-wider">Enter Key Manually</div>
                  <div className="text-[11px] text-text-dim mt-0.5">Type the secret into your app</div>
                </div>
                <div className="text-text-dim group-hover:text-blue-400 transition-colors text-lg">›</div>
              </div>
            </button>
            {onCancel && (
              <button onClick={onCancel} className="w-full text-xs text-text-dim hover:text-accent font-mono uppercase tracking-widest transition-colors py-2">
                Remind me later
              </button>
            )}
          </div>
        )}

        {secret && phase === 'qr' && (
          <div className="space-y-4">
            <button onClick={() => setPhase('choose')} className="flex items-center gap-2 text-xs text-text-dim hover:text-accent font-mono uppercase tracking-widest transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <p className="text-sm text-text-dim">Scan with your <strong className="text-text-main">authenticator app</strong></p>
            <div className="bg-white p-4 rounded-xl inline-block mx-auto border-4 border-accent shadow-[0_0_30px_rgba(0,255,0,0.3)]">
              {otpUrl && <QRCodeSVG value={otpUrl} size={180} />}
            </div>
            <button onClick={copySecret} className="w-full text-xs text-text-dim hover:text-accent font-mono transition-colors flex items-center justify-center gap-2 py-2">
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy setup key instead'}
            </button>
            <VerifyForm code={code} setCode={setCode} verifying={verifying} onSubmit={handleVerify} />
          </div>
        )}

        {secret && phase === 'manual' && (
          <div className="space-y-4">
            <button onClick={() => setPhase('choose')} className="flex items-center gap-2 text-xs text-text-dim hover:text-accent font-mono uppercase tracking-widest transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <p className="text-sm text-text-dim">Enter this key in your authenticator app:</p>
            <div className="p-4 bg-bg-base border border-border-subtle rounded-xl font-mono text-accent text-center text-lg tracking-[0.25em] select-all break-all">
              {secret.sharedSecretKey}
            </div>
            <button onClick={copySecret} className="w-full text-xs text-text-dim hover:text-accent font-mono transition-colors flex items-center justify-center gap-2 py-2">
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy key'}
            </button>
            <VerifyForm code={code} setCode={setCode} verifying={verifying} onSubmit={handleVerify} />
          </div>
        )}
      </motion.div>
    </div>
  );
}

function VerifyForm({ code, setCode, verifying, onSubmit }: {
  code: string;
  setCode: (v: string) => void;
  verifying: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
        className="w-full p-4 bg-bg-base border border-border-subtle rounded-xl text-center text-2xl font-mono tracking-[0.5em] text-text-main focus:border-accent focus:outline-none"
        autoFocus
      />
      <button
        type="submit"
        disabled={verifying || code.length !== 6}
        className="w-full py-3.5 bg-accent text-black font-black uppercase tracking-widest rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_25px_rgba(0,255,136,0.4)] transition-all"
      >
        {verifying ? 'Verifying…' : 'Verify & Enable'}
      </button>
    </form>
  );
}

// ─── Sign-in challenge (runs when auth/multi-factor-auth-required is raised) ───
export function MfaChallenge({ error, onResolved, onCancel }: MfaChallengeProps) {
  const [code, setCode] = useState('');
  const [errorText, setErrorText] = useState('');
  const [verifying, setVerifying] = useState(false);
  const resolverRef = useRef(getMultiFactorResolver(auth, error));

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setVerifying(true);
    try {
      const resolver = resolverRef.current;
      const totpHint = resolver.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID);
      if (!totpHint) {
        setErrorText('No TOTP factor is registered on this account.');
        return;
      }
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(totpHint.uid, code.replace(/\s+/g, ''));
      await resolver.resolveSignIn(assertion);
      onResolved();
    } catch (err: any) {
      if (err?.code === 'auth/invalid-verification-code') {
        setErrorText('Invalid code. Try again.');
      } else {
        setErrorText(err?.message || 'Verification failed.');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base relative text-text-main px-4">
      <div className="mesh-bg" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-bg-surface/80 backdrop-blur-xl border border-border-subtle rounded-3xl p-7 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-accent">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-widest">Two-Factor Required</h1>
            <p className="text-[11px] text-text-dim font-mono uppercase tracking-wider">Enter the code from your authenticator</p>
          </div>
        </div>

        {errorText && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
            className="w-full p-4 bg-bg-base border border-border-subtle rounded-xl text-center text-2xl font-mono tracking-[0.5em] text-text-main focus:border-accent focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full py-3.5 bg-accent text-black font-black uppercase tracking-widest rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_0_25px_rgba(0,255,136,0.4)] transition-all"
          >
            {verifying ? 'Verifying…' : 'Verify'}
          </button>
          {onCancel && (
            <button type="button" onClick={onCancel} className="w-full text-xs text-text-dim hover:text-text-main font-mono uppercase tracking-widest transition-colors py-2">
              Cancel sign-in
            </button>
          )}
        </form>
      </motion.div>
    </div>
  );
}

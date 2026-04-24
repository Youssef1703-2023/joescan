import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, ShieldAlert, KeyRound, Zap, QrCode, Smartphone, ArrowLeft, Copy, CheckCircle } from 'lucide-react';
import { TOTP, NobleCryptoPlugin, ScureBase32Plugin, generateSecret } from 'otplib';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../lib/firebase';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';

// Create properly configured crypto and base32 plugin instances
const cryptoPlugin = new NobleCryptoPlugin();
const base32Plugin = new ScureBase32Plugin();

// ─── Setup Mode UI with two options ───
function SetupModeUI({ secret, otpUrl }: { secret: string; otpUrl: string }) {
  const [setupChoice, setSetupChoice] = useState<'choose' | 'qr' | 'ms'>('choose');
  const [copied, setCopied] = useState(false);

  const copySecret = () => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Microsoft Authenticator deep link
  const msAuthUrl = otpUrl; // otpauth:// URLs are universally supported by authenticator apps

  return (
    <AnimatePresence mode="wait">
      {setupChoice === 'choose' && (
        <motion.div key="choose" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
          <p className="text-sm text-text-dim">
            Choose how you'd like to set up <strong className="text-text-main">Two-Factor Authentication</strong> for your account.
          </p>
          
          {/* Option 1: Scan QR */}
          <button
            onClick={() => setSetupChoice('qr')}
            className="w-full p-5 bg-bg-surface border-2 border-border-subtle rounded-xl hover:border-accent/50 hover:bg-accent/5 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl text-accent group-hover:shadow-[0_0_15px_rgba(0,255,0,0.2)] transition-all">
                <QrCode className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-text-main text-sm uppercase tracking-wider">Scan QR Code</div>
                <div className="text-[11px] text-text-dim mt-0.5">Use any authenticator app to scan a QR code</div>
              </div>
              <div className="text-text-dim group-hover:text-accent transition-colors text-lg">›</div>
            </div>
          </button>

          {/* Option 2: Microsoft Authenticator */}
          <button
            onClick={() => setSetupChoice('ms')}
            className="w-full p-5 bg-bg-surface border-2 border-border-subtle rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left group"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all">
                <Smartphone className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-text-main text-sm uppercase tracking-wider">Microsoft Authenticator</div>
                <div className="text-[11px] text-text-dim mt-0.5">Open the app directly and add your account</div>
              </div>
              <div className="text-text-dim group-hover:text-blue-400 transition-colors text-lg">›</div>
            </div>
          </button>
        </motion.div>
      )}

      {setupChoice === 'qr' && (
        <motion.div key="qr" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
          <button onClick={() => setSetupChoice('choose')} className="flex items-center gap-2 text-xs text-text-dim hover:text-accent font-mono uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <p className="text-sm text-text-dim">
            Scan this QR code with your <strong className="text-text-main">Authenticator App</strong>
          </p>
          <div className="bg-white p-4 rounded-xl inline-block mx-auto border-4 border-accent shadow-[0_0_30px_rgba(0,255,0,0.3)]">
            <QRCodeSVG value={otpUrl} size={150} />
          </div>
          <div className="flex items-center justify-center gap-2">
            <p className="text-[10px] font-mono tracking-widest text-[#888] uppercase break-all">
              Manual Key: <span className="text-text-main">{secret}</span>
            </p>
            <button onClick={copySecret} className="p-1 text-text-dim hover:text-accent transition-colors" title="Copy Key">
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </motion.div>
      )}

      {setupChoice === 'ms' && (
        <motion.div key="ms" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
          <button onClick={() => setSetupChoice('choose')} className="flex items-center gap-2 text-xs text-text-dim hover:text-accent font-mono uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl inline-block">
            <Smartphone className="w-10 h-10 text-blue-400" />
          </div>
          <p className="text-sm text-text-dim">
            Click below to open <strong className="text-blue-400">Microsoft Authenticator</strong> and add your JoeScan account automatically.
          </p>
          <a
            href={msAuthUrl}
            className="inline-flex items-center gap-3 px-6 py-3.5 bg-blue-500/10 border-2 border-blue-500/30 text-blue-400 rounded-xl font-bold uppercase tracking-wider text-sm hover:bg-blue-500/20 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all"
          >
            <Smartphone className="w-5 h-5" />
            Open Microsoft Authenticator
          </a>
          <p className="text-[10px] text-text-dim font-mono uppercase tracking-widest">
            After adding the account, enter the 6-digit code below
          </p>
          <div className="flex items-center justify-center gap-2 p-2 bg-bg-surface rounded-lg border border-border-subtle">
            <p className="text-[10px] font-mono tracking-widest text-[#888] break-all">
              Manual Key: <span className="text-text-main">{secret}</span>
            </p>
            <button onClick={copySecret} className="p-1 text-text-dim hover:text-accent transition-colors shrink-0" title="Copy Key">
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface MfaGuardProps {
  user: any;
  onVerified: () => void;
  onLogout: () => void;
}

export default function MfaGuard({ user, onVerified, onLogout }: MfaGuardProps) {
  const [loading, setLoading] = useState(true);
  const [setupMode, setSetupMode] = useState(false);
  const [secret, setSecret] = useState('');
  const [otpUrl, setOtpUrl] = useState('');
  
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    async function checkMfa() {
      try {
        const userDoc = await getDocFromServer(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().mfaSecret) {
          // MFA already setup, just ask for code
          setSecret(userDoc.data().mfaSecret);
          setSetupMode(false);
        } else if (userDoc.exists() && userDoc.data().mfaSkipped === true) {
          // User previously skipped MFA — auto-pass
          onVerified();
          return;
        } else {
          // New User Setup — generate a new TOTP secret
          const newSecret = generateSecret();
          const encodedEmail = encodeURIComponent(user.email || 'operator');
          const pUrl = `otpauth://totp/JoeScan:${encodedEmail}?secret=${newSecret}&issuer=JoeScan`;
          setSecret(newSecret);
          setOtpUrl(pUrl);
          setSetupMode(true);
        }
      } catch (err: any) {
        console.error("Failed to check MFA status", err);
        setError(`Database read failed: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
    checkMfa();
  }, [user]);

  const handleSkip = async () => {
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email || '',
        mfaSkipped: true,
      }, { merge: true });
      onVerified();
    } catch (err: any) {
      console.error('Failed to skip MFA:', err);
      // Still let them in even if save fails
      onVerified();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying(true);

    try {
      // Create a TOTP instance with the user's secret and proper crypto plugins
      const totp = new TOTP({
        secret,
        crypto: cryptoPlugin,
        base32: base32Plugin,
      });

      // otplib v13: verify(token) returns { valid: boolean, ... }
      const result = await totp.verify(code);
      
      if (!result || !result.valid) {
        throw new Error("Invalid Authorization Code. Please check your Authenticator app and try again.");
      }

      if (setupMode) {
        // Save the secret to Firestore now that we verified they configured it
        await setDoc(doc(db, 'users', user.uid), { 
          uid: user.uid,
          email: user.email || '',
          mfaSecret: secret 
        }, { merge: true });
      }
      
      onVerified();
    } catch (err: any) {
      setError(err.message || "Failed to verify.");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base relative text-text-main">
         <div className="mesh-bg" />
         <div className="relative z-10 flex flex-col items-center gap-4">
            <Zap className="w-10 h-10 text-accent animate-pulse" />
            <div className="font-mono text-sm tracking-widest uppercase">Initializing Security Protocol...</div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base relative font-sans p-4" dir="ltr">
      <div className="mesh-bg" />
      <div className="grid-overlay" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card max-w-md w-full relative z-10 p-0 overflow-hidden border-accent/40 shadow-[0_0_50px_rgba(0,255,0,0.1)]"
      >
        <div className="p-6 border-b border-border-subtle bg-[#0a0a0a] flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-error/10 border border-error/50 rounded-lg text-error">
               <ShieldAlert className="w-6 h-6" />
             </div>
             <div>
               <h2 className="font-mono font-bold tracking-widest uppercase text-error text-lg">Clearance Required</h2>
               <p className="text-xs text-text-dim uppercase tracking-widest font-mono">Two-Factor Auth</p>
             </div>
           </div>
        </div>

        <div className="p-8 space-y-6 text-center">
          {setupMode ? (
            <SetupModeUI secret={secret} otpUrl={otpUrl} />
          ) : (
            <div className="space-y-4">
              <div className="w-20 h-20 bg-bg-surface rounded-full flex items-center justify-center mx-auto border border-border-subtle">
                 <img src="/icon-512.png" alt="JoeScan" className="w-12 h-12 rounded-lg opacity-80" />
              </div>
              <p className="text-sm text-text-dim">
                Please enter the 6-digit code from your Authenticator App to access the JoeScan terminal.
              </p>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4 pt-4 border-t border-border-subtle">
             {error && (
               <div className="bg-error/10 border border-error/50 text-error p-3 rounded-lg text-xs font-mono text-left">
                 [ERROR] {error}
               </div>
             )}
             <div className="relative">
               <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-dim" />
               <input 
                 type="text" 
                 value={code}
                 onChange={e => setCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                 placeholder="Enter 6-Digit Code"
                 className="w-full bg-bg-surface border-2 border-border-subtle rounded-xl pl-12 pr-4 py-4 text-center tracking-[0.5em] text-2xl focus:border-accent focus:bg-bg-base outline-none font-mono"
                 required
               />
             </div>
             
             <button 
               type="submit" 
               disabled={code.length !== 6 || verifying}
               className="w-full py-4 btn-glow rounded-xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2 disabled:opacity-50"
             >
               {verifying ? <Zap className="w-5 h-5 animate-pulse" /> : <ShieldCheck className="w-5 h-5" />}
               {setupMode ? 'Verify & Setup' : 'Authorize Login'}
             </button>
          </form>

          <div className="pt-4 flex flex-col items-center gap-3">
             {setupMode && (
               <button
                 onClick={handleSkip}
                 className="text-xs text-accent font-mono tracking-widest uppercase hover:text-accent/80 transition-colors border border-accent/20 rounded-lg px-6 py-2 hover:bg-accent/5"
               >
                 ⏭ Skip for now
               </button>
             )}
             <button onClick={onLogout} className="text-xs text-text-dim font-mono tracking-widest uppercase hover:text-error transition-colors">
               ABORT / RETURN TO LOGIN
             </button>
           </div>
        </div>
      </motion.div>
    </div>
  );
}

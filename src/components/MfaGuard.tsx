import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, ShieldAlert, KeyRound, Zap } from 'lucide-react';
// @ts-ignore
import * as _otplib from 'otplib';
const _mod = _otplib as any;
const authenticator = _mod.authenticator || _mod.default?.authenticator || _mod;
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../lib/firebase';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';

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
        } else {
          // New User Setup
          const newSecret = authenticator.generateSecret();
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

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying(true);

    try {
      const isValid = authenticator.verify({ token: code, secret });
      if (!isValid) {
        throw new Error("Invalid Authorization Code.");
      }

      if (setupMode) {
        // Save to DB now that we proved they configured it
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
            <div className="space-y-4">
              <p className="text-sm text-text-dim">
                Scan this QR code with <strong>Microsoft Authenticator</strong> or Google Authenticator to secure your session.
              </p>
              <div className="bg-white p-4 rounded-xl inline-block mx-auto border-4 border-accent shadow-[0_0_30px_rgba(0,255,0,0.3)]">
                <QRCodeSVG value={otpUrl} size={150} />
              </div>
              <p className="text-[10px] font-mono tracking-widest text-[#888] uppercase break-all">
                Manual Key: <span className="text-text-main">{secret}</span>
              </p>
            </div>
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

          <div className="pt-4">
             <button onClick={onLogout} className="text-xs text-text-dim font-mono tracking-widest uppercase hover:text-error transition-colors">
               ABORT / RETURN TO LOGIN
             </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

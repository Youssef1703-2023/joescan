import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, X, ArrowRight, ShieldCheck, Zap, User, AlertCircle, CheckCircle2, Gift } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  getAdditionalUserInfo,
  sendEmailVerification
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc, getDocs, collection, query, where } from 'firebase/firestore';
import '../styles/auth-experience.css';
import { isDisposableEmail } from '../utils/disposableDomains';
import { isMfaRequiredError, MfaChallenge } from './MfaGuard';
import type { MultiFactorError } from 'firebase/auth';

type AuthMode = 'login' | 'signup' | 'forgot_password';

interface AuthModalProps {
  onClose: () => void;
  isOpen: boolean;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const panelRef=useRef<HTMLDivElement>(null);
  const [showPassword,setShowPassword]=useState(false);

  const switchMode=(next:AuthMode)=>{setMode(next);setError('');setSuccessMsg('');setPassword('');setShowPassword(false);};
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(()=>{if(!isOpen)return;const previous=document.activeElement as HTMLElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';const timer=setTimeout(()=>panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus(),0);const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!loading)onClose();if(e.key==='Tab'){const items=Array.from<HTMLElement>(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,a[href]')||[]).filter(el=>el.getClientRects().length);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',key);return()=>{clearTimeout(timer);document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus()};},[isOpen,onClose,loading]);
  const [successMsg, setSuccessMsg] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [mfaError, setMfaError] = useState<MultiFactorError | null>(null);
  
  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameDebounce, setUsernameDebounce] = useState<NodeJS.Timeout | null>(null);

  useEffect(()=>{setUsernameStatus(/^[a-zA-Z0-9_]{3,20}$/.test(username)?'available':'invalid');},[username]);
  const resolveUsernameToEmail=async(input:string):Promise<string>=>{if(!input.includes('@'))throw Error('Use your email address to sign in or recover your account.');return input.trim();};

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        // Validate username
        if (!username.trim()) throw new Error('Username is required.');
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw new Error('Username must be 3-20 characters (letters, numbers, underscore only).');
        if (usernameStatus === 'taken') throw new Error('This username is already taken. Please choose another.');
        if (password.length < 12) throw new Error('Password must be at least 12 characters.');
        
        // Anti-Spam: Check if email is from a disposable domain
        if (isDisposableEmail(email)) {
          throw new Error('Prepaid or temporary email addresses are blocked. Please use a valid email.');
        }
        
        // Create account
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        
        // Anti-Spam: Send email verification immediately
        await sendEmailVerification(cred.user);
        
        // Set display name to username
        await updateProfile(cred.user, { displayName: username });
        
        // Also save username to user profile
        await setDoc(doc(db, 'users', cred.user.uid), {
          username: username,
          email: email.toLowerCase(),
        }, { merge: true });

        // Process Referral via referralClaims
        if (referralCode.trim()) {
          try {
            await setDoc(doc(db, 'referralClaims', cred.user.uid), {
              newUid: cred.user.uid,
              code: referralCode.trim().toUpperCase(),
              status: 'pending',
              createdAt: new Date().toISOString(),
            });
          } catch (refErr) {
            // Account creation already succeeded — never block the signup on this.
            // Still tell the user, otherwise a mistyped code fails silently.
            console.warn('Referral claim filing failed:', refErr);
            setSuccessMsg('Account created, but the referral code could not be applied.');
          }
        }
        
      } else if (mode === 'login') {
        // Resolve email address
        const resolvedEmail = await resolveUsernameToEmail(username);
        try {
          await signInWithEmailAndPassword(auth, resolvedEmail, password);
        } catch (loginErr: any) {
          if (isMfaRequiredError(loginErr)) {
            setMfaError(loginErr);
            return;
          }
          throw loginErr;
        }
        
      } else if (mode === 'forgot_password') {
        // For forgot password, resolve username to email first
        let targetEmail = email;
        if (username.trim() && !username.includes('@')) {
          targetEmail = await resolveUsernameToEmail(username);
        } else if (username.includes('@')) {
          targetEmail = username;
        }
        await sendPasswordResetEmail(auth, targetEmail);
        setSuccessMsg(`If an account exists for this address, a recovery email will be sent.`);

      }
    } catch (err: any) {
      console.error(err);
      // Friendly error messages
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Try logging in instead.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid credentials. Check your email and password.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with these credentials.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait and try again.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      let cred: Awaited<ReturnType<typeof signInWithPopup>>;
      try {
        cred = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        if (isMfaRequiredError(popupErr)) {
          setMfaError(popupErr);
          return;
        }
        throw popupErr;
      }
      
      // Always save email + name to Firestore on Google login
      if (cred.user) {
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email?.toLowerCase() || '',
          name: cred.user.displayName || '',
        }, { merge: true });
      }

      const additionalInfo = getAdditionalUserInfo(cred);
      if (additionalInfo?.isNewUser && referralCode.trim()) {
        try {
          await setDoc(doc(db, 'referralClaims', cred.user.uid), {
            newUid: cred.user.uid,
            code: referralCode.trim().toUpperCase(),
            status: 'pending',
            createdAt: new Date().toISOString(),
          });
        } catch (refErr) {
          // Sign-in already succeeded — never block it on this, but do not fail silently.
          console.warn('Referral claim filing failed:', refErr);
          setSuccessMsg('Signed in, but the referral code could not be applied.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google Auth failed');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  // Real Firebase MFA sign-in challenge
  if (mfaError) {
    return (
      <AnimatePresence>
        <MfaChallenge
          error={mfaError}
          onResolved={() => {
            setMfaError(null);
            onClose();
          }}
          onCancel={() => {
            setMfaError(null);
            setError('');
            setLoading(false);
          }}
        />
      </AnimatePresence>
    );
  }


  return <div className="auth-backdrop" lang="en" dir="ltr">
    <div className="auth-panel" ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <aside className="auth-story" aria-hidden="true"><span className="auth-brand">JOESCAN / JOETECH</span><div><span className="auth-eyebrow">A CLEARER PERSPECTIVE</span><h2>Your digital life.<br/><em>In focus.</em></h2><p>Understand your exposure.<br/>Make your next move count.</p></div><span className="auth-story-foot">EXPOSURE → CONTEXT → ACTION</span></aside>
      <div className="auth-content"><button className="auth-close" onClick={onClose} disabled={loading} aria-label="Close sign in"><X size={20}/></button>
      <span className="auth-eyebrow">{mode==='signup'?'YOUR NEXT CHAPTER':mode==='forgot_password'?'ACCOUNT RECOVERY':'WELCOME BACK'}</span>
      <h2 id="auth-title">{mode==='login'?'Good to see you.':mode==='signup'?'Make it your space.':'Let’s get you back.'}</h2>
      <p className="auth-intro">{mode==='login'?'Sign in to explore your tools and saved reports.':mode==='signup'?'Create your JoeScan account to start exploring.':'Enter your email and we’ll send a recovery link.'}</p>
      {mode!=='forgot_password'&&<div className="auth-tabs"><button aria-pressed={mode==='login'} disabled={loading} onClick={()=>switchMode('login')}>Login</button><button aria-pressed={mode==='signup'} disabled={loading} onClick={()=>switchMode('signup')}>Create account</button></div>}
      <form onSubmit={handleAuth}>
      {error&&<p className="auth-message auth-error" role="alert">{error}</p>}{successMsg&&<p className="auth-message" role="status">{successMsg}</p>}
      {mode==='signup'&&<label htmlFor="auth-name">Display name<input id="auth-name" value={username} onChange={e=>setUsername(e.target.value.replace(/\s/g,''))} required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]{3,20}" autoComplete="nickname" placeholder="Your display name"/><small>3–20 letters, numbers or underscores.</small></label>}
      <label htmlFor="auth-email">Email address<input id="auth-email" type="email" autoComplete="email" required value={mode==='signup'?email:username} onChange={e=>mode==='signup'?setEmail(e.target.value):setUsername(e.target.value)} placeholder="you@example.com"/></label>
      {mode!=='forgot_password'&&<label htmlFor="auth-password"><span className="auth-label-row">Password{mode==='login'&&<button type="button" disabled={loading} onClick={()=>switchMode('forgot_password')}>Forgot password?</button>}</span><span className="auth-password"><input id="auth-password" type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={mode==='signup'?12:undefined} autoComplete={mode==='login'?'current-password':'new-password'} placeholder={mode==='signup'?'At least 12 characters':'Enter your password'}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword?'Hide':'Show'}</button></span></label>}
      {mode==='signup'&&<details className="auth-referral"><summary>Have a referral code? <span>Optional</span></summary><label htmlFor="auth-referral">Referral code<input id="auth-referral" value={referralCode} onChange={e=>setReferralCode(e.target.value)} placeholder="Enter your code"/></label></details>}
      <button className="auth-submit" type="submit" disabled={loading}>{loading?'Please wait…':mode==='login'?'Login':mode==='signup'?'Create account':'Send recovery link'}<ArrowRight size={17}/></button>
      </form>
      {mode!=='forgot_password'?<><div className="auth-divider"><span>or continue with</span></div><button className="auth-google" onClick={handleGoogleAuth} disabled={loading}><span aria-hidden="true">G</span>Continue with Google</button></>:<button className="auth-back" onClick={()=>switchMode('login')}>← Back to login</button>}
      <p className="auth-legal">{mode==='signup'?'By creating an account, you agree to our ':'Learn about our '}<a href="/terms.en">Terms</a> and <a href="/privacy">Privacy & data policy</a>.</p>
      </div>
    </div>
  </div>;
}

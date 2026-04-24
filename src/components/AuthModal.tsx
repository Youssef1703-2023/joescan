import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, X, ArrowRight, ShieldCheck, Zap, User, AlertCircle, CheckCircle2, Gift } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  getAdditionalUserInfo
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, getDoc, getDocs, collection, query, where, updateDoc, increment } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';

type AuthMode = 'login' | 'signup' | 'forgot_password';

interface AuthModalProps {
  onClose: () => void;
  isOpen: boolean;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { t, lang } = useLanguage();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [referralCode, setReferralCode] = useState('');
  
  // Username validation state
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameDebounce, setUsernameDebounce] = useState<NodeJS.Timeout | null>(null);

  // Check username availability on signup
  useEffect(() => {
    if (mode !== 'signup' || !username.trim()) {
      setUsernameStatus('idle');
      return;
    }
    
    // Validate format: 3-20 chars, alphanumeric + underscore only
    const isValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
    if (!isValid) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    
    if (usernameDebounce) clearTimeout(usernameDebounce);
    
    const timer = setTimeout(async () => {
      try {
        const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
        setUsernameStatus(usernameDoc.exists() ? 'taken' : 'available');
      } catch (err) {
        console.error('Username check failed:', err);
        setUsernameStatus('available'); // Allow attempt if check fails
      }
    }, 500);
    
    setUsernameDebounce(timer);
    
    return () => { if (timer) clearTimeout(timer); };
  }, [username, mode]);

  // Resolve username to email for login
  const resolveUsernameToEmail = async (input: string): Promise<string> => {
    // If it looks like an email, return as-is
    if (input.includes('@')) return input;
    
    // Otherwise, look up the username in Firestore
    const usernameDoc = await getDoc(doc(db, 'usernames', input.toLowerCase()));
    if (usernameDoc.exists()) {
      return usernameDoc.data().email;
    }
    throw new Error('Username not found. Please check your username or use your email address.');
  };

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
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        
        // Double-check username availability
        const existingDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));
        if (existingDoc.exists()) throw new Error('This username is already taken. Please choose another.');

        // Validate Referral Code if provided
        let validReferrerCodeDoc = null;
        if (referralCode.trim()) {
           const cleanCode = referralCode.trim().toUpperCase();
           const codeQuery = query(collection(db, 'referrals'), where('code', '==', cleanCode));
           const codeSnap = await getDocs(codeQuery);
           if (!codeSnap.empty) {
               validReferrerCodeDoc = codeSnap.docs[0];
           } else {
               throw new Error('Invalid referral code. Please check or leave empty.');
           }
        }
        
        // Prevent abuse: Check basic device footprint
        const deviceId = localStorage.getItem('joescan-device-id') || crypto.randomUUID();
        localStorage.setItem('joescan-device-id', deviceId);
        
        // Create account
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        
        // Set display name to username
        await updateProfile(cred.user, { displayName: username });
        
        // Reserve the username in Firestore
        await setDoc(doc(db, 'usernames', username.toLowerCase()), {
          uid: cred.user.uid,
          email: email.toLowerCase(),
          username: username,
          createdAt: new Date().toISOString(),
        });
        
        // Also save username to user profile
        await setDoc(doc(db, 'users', cred.user.uid), {
          username: username,
          email: email.toLowerCase(),
        }, { merge: true });

        // Process Referral
        if (validReferrerCodeDoc) {
             const referrerUid = validReferrerCodeDoc.id;
             const hasReferredBefore = localStorage.getItem(`joescan-referred-${referrerUid}`);
             
             if (!hasReferredBefore) {
                 await setDoc(doc(db, 'referralSignups', cred.user.uid), {
                    newUid: cred.user.uid,
                    referrerUid: referrerUid,
                    email: email.toLowerCase(),
                    createdAt: new Date().toISOString()
                 });
                 await updateDoc(doc(db, 'referrals', referrerUid), {
                    referralCount: increment(1)
                 });
                 localStorage.setItem(`joescan-referred-${referrerUid}`, 'true');
             }
        }
        
      } else if (mode === 'login') {
        // Resolve username or email
        const resolvedEmail = await resolveUsernameToEmail(username);
        await signInWithEmailAndPassword(auth, resolvedEmail, password);
        
      } else if (mode === 'forgot_password') {
        // For forgot password, resolve username to email first
        let targetEmail = email;
        if (username.trim() && !username.includes('@')) {
          targetEmail = await resolveUsernameToEmail(username);
        } else if (username.includes('@')) {
          targetEmail = username;
        }
        await sendPasswordResetEmail(auth, targetEmail);
        setSuccessMsg(`Recovery protocol initiated. Check your inbox at ${targetEmail}.`);
        setTimeout(() => setMode('login'), 3000);
      }
    } catch (err: any) {
      console.error(err);
      // Friendly error messages
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Try logging in instead.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid credentials. Check your username/email and password.');
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
      // Validate Referral Code if provided (even for Google)
      let validReferrerCodeDoc = null;
      if (mode === 'signup' && referralCode.trim()) {
         const cleanCode = referralCode.trim().toUpperCase();
         const codeQuery = query(collection(db, 'referrals'), where('code', '==', cleanCode));
         const codeSnap = await getDocs(codeQuery);
         if (!codeSnap.empty) {
             validReferrerCodeDoc = codeSnap.docs[0];
         } else {
             throw new Error('Invalid referral code. Please check or leave empty.');
         }
      }

      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      
      const additionalInfo = getAdditionalUserInfo(cred);
      if (additionalInfo?.isNewUser && validReferrerCodeDoc) {
            const referrerUid = validReferrerCodeDoc.id;
            const hasReferredBefore = localStorage.getItem(`joescan-referred-${referrerUid}`);
            
            if (!hasReferredBefore) {
                await setDoc(doc(db, 'referralSignups', cred.user.uid), {
                  newUid: cred.user.uid,
                  referrerUid: referrerUid,
                  email: cred.user.email?.toLowerCase() || '',
                  createdAt: new Date().toISOString()
                });
                await updateDoc(doc(db, 'referrals', referrerUid), {
                  referralCount: increment(1)
                });
                localStorage.setItem(`joescan-referred-${referrerUid}`, 'true');
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

  const getUsernameIcon = () => {
    switch (usernameStatus) {
      case 'checking': return <Zap className="w-4 h-4 text-yellow-400 animate-pulse" />;
      case 'available': return <CheckCircle2 className="w-4 h-4 text-accent" />;
      case 'taken': return <AlertCircle className="w-4 h-4 text-error" />;
      case 'invalid': return <AlertCircle className="w-4 h-4 text-orange-400" />;
      default: return <User className="w-4 h-4 text-text-dim" />;
    }
  };

  const getUsernameHint = () => {
    switch (usernameStatus) {
      case 'checking': return <span className="text-yellow-400 text-[10px] font-mono">Checking availability...</span>;
      case 'available': return <span className="text-accent text-[10px] font-mono">✓ Username available</span>;
      case 'taken': return <span className="text-error text-[10px] font-mono">✗ Username already taken</span>;
      case 'invalid': return <span className="text-orange-400 text-[10px] font-mono">3-20 chars, letters/numbers/_ only</span>;
      default: return null;
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="glass-card max-w-md w-full border-accent/30 flex flex-col overflow-hidden relative shadow-[0_0_50px_rgba(0,255,0,0.1)]"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-5 border-b border-border-subtle bg-bg-surface">
             <div className="flex items-center gap-2 font-mono uppercase tracking-widest text-sm">
                <ShieldCheck className="w-4 h-4 text-accent" />
                {mode === 'login' ? 'System Login' : mode === 'signup' ? 'Request Clearance' : 'Password Recovery'}
             </div>
             <button onClick={onClose} className="text-text-dim hover:text-text-main hover:bg-bg-elevated p-1 rounded-md transition-colors">
               <X className="w-5 h-5"/>
             </button>
          </div>

          {/* Body */}
          <form onSubmit={handleAuth} className="p-6 space-y-4">
             {error && (
               <div className="bg-error/10 border border-error/50 text-error p-3 rounded-lg text-xs font-mono mb-4">
                 [ERROR] {error}
               </div>
             )}
             {successMsg && (
               <div className="bg-accent/10 border border-accent/50 text-accent p-3 rounded-lg text-xs font-mono mb-4">
                 [SUCCESS] {successMsg}
               </div>
             )}

             {/* Username field - for login and signup */}
             {mode !== 'forgot_password' && (
               <div className="space-y-1">
                 <label className="text-[10px] font-mono tracking-widest text-text-dim uppercase">
                   {mode === 'login' ? 'Username or Email' : 'Username'}
                 </label>
                 <div className="relative">
                   <div className="absolute left-3 top-1/2 -translate-y-1/2">
                     {mode === 'signup' ? getUsernameIcon() : <User className="w-4 h-4 text-text-dim" />}
                   </div>
                   <input 
                     type="text" 
                     value={username}
                     onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
                     required
                     autoComplete="username"
                     className={`w-full bg-bg-base border rounded-lg pl-10 pr-4 py-3 text-sm focus:border-accent outline-none font-mono transition-colors ${
                       mode === 'signup' && usernameStatus === 'taken' ? 'border-error/60' : 
                       mode === 'signup' && usernameStatus === 'available' ? 'border-accent/60' : 
                       'border-border-subtle'
                     }`}
                     placeholder={mode === 'login' ? 'username or email' : 'choose_username'}
                     dir="ltr"
                   />
                 </div>
                 {mode === 'signup' && getUsernameHint()}
               </div>
             )}

             {/* Email field - only for signup and forgot password */}
             {(mode === 'signup' || mode === 'forgot_password') && (
               <div className="space-y-1">
                 <label className="text-[10px] font-mono tracking-widest text-text-dim uppercase">
                   {mode === 'forgot_password' ? 'Username or Email' : 'Operator Email'}
                 </label>
                 <div className="relative">
                   <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                   <input 
                     type={mode === 'forgot_password' ? 'text' : 'email'}
                     value={mode === 'forgot_password' ? username : email}
                     onChange={e => mode === 'forgot_password' ? setUsername(e.target.value) : setEmail(e.target.value)}
                     required
                     className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-3 text-sm focus:border-accent outline-none font-mono"
                     placeholder={mode === 'forgot_password' ? 'username or email' : 'operator@joescan.cloud'}
                     dir="ltr"
                   />
                 </div>
               </div>
             )}

             {/* Password field */}
             {mode !== 'forgot_password' && (
               <div className="space-y-1 relative">
                 <div className="flex justify-between items-end">
                   <label className="text-[10px] font-mono tracking-widest text-text-dim uppercase">Security Key</label>
                   {mode === 'login' && (
                     <button type="button" onClick={() => setMode('forgot_password')} className="text-[10px] font-mono text-accent hover:underline uppercase">Forgot Key?</button>
                   )}
                 </div>
                 <div className="relative">
                   <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                   <input 
                     type="password" 
                     value={password}
                     onChange={e => setPassword(e.target.value)}
                     required
                     autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                     className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-3 text-sm focus:border-accent outline-none font-mono"
                     placeholder="••••••••"
                     dir="ltr"
                   />
                 </div>
               </div>
             )}

             {/* Referral Code Field (Optional) */}
             {mode === 'signup' && (
               <div className="space-y-1 relative mt-2">
                 <div className="flex justify-between items-end">
                   <label className="text-[10px] font-mono tracking-widest text-text-dim uppercase">{lang === 'ar' ? 'كود الإحالة (اختياري)' : 'Referral Code (Optional)'}</label>
                 </div>
                 <div className="relative">
                   <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent/50" />
                   <input 
                     type="text" 
                     value={referralCode}
                     onChange={e => setReferralCode(e.target.value)}
                     className="w-full bg-bg-base border border-border-subtle rounded-lg pl-10 pr-4 py-3 text-sm focus:border-accent outline-none font-mono uppercase"
                     placeholder="e.g. VIP-123"
                     dir="ltr"
                   />
                 </div>
               </div>
             )}

             <button 
               type="submit" 
               disabled={loading || (mode === 'signup' && usernameStatus === 'taken')}
               className="w-full btn-glow py-3 rounded-lg flex items-center justify-center gap-2 mt-4 text-sm font-bold uppercase tracking-widest disabled:opacity-50"
             >
               {loading ? <Zap className="w-4 h-4 animate-pulse" /> : mode === 'login' ? 'Authenticate' : mode === 'signup' ? 'Establish Clearance' : 'Send Override Link'}
               {!loading && <ArrowRight className="w-4 h-4" />}
             </button>

             {/* Divider */}
             {mode !== 'forgot_password' && (
                <>
                  <div className="flex items-center gap-3 my-4 opacity-50">
                    <div className="flex-1 h-px bg-border-main" />
                    <span className="text-[10px] font-mono uppercase tracking-widest">OR SECURE LOGIN VIA</span>
                    <div className="flex-1 h-px bg-border-main" />
                  </div>
                  <button 
                    type="button" 
                    onClick={handleGoogleAuth}
                    disabled={loading}
                    className="w-full py-3 bg-bg-base border border-border-subtle hover:border-accent/50 hover:bg-bg-elevated rounded-lg flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest transition-all"
                  >
                    Google Identity
                  </button>
                </>
             )}
          </form>

          {/* Footer Toggle */}
          <div className="p-4 border-t border-border-subtle bg-bg-surface text-center">
             {mode === 'login' ? (
                <p className="text-xs text-text-dim">No physical clearance? <button onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }} className="text-accent hover:underline font-bold">Request Access</button></p>
             ) : (
                <p className="text-xs text-text-dim">Already have clearance? <button onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }} className="text-accent hover:underline font-bold">Authenticate Here</button></p>
             )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

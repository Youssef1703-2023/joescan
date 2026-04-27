import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';
import { Shield } from 'lucide-react';
import { motion } from 'motion/react';

export default function Auth() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      // Save email + name to Firestore immediately
      if (cred.user) {
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: cred.user.email?.toLowerCase() || '',
          name: cred.user.displayName || '',
        }, { merge: true });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-surface border border-border-subtle p-8 rounded-xl text-center max-w-sm w-full"
      >
        <Shield className="w-16 h-16 text-accent mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-text-main mb-2">{t('login_title')}</h2>
        <p className="text-text-dim mb-8 text-sm">{t('header_tagline')}</p>
        
        {error && (
          <div className="bg-error/10 border border-error/50 text-error text-sm p-3 rounded mb-4 text-left">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-accent hover:bg-opacity-80 text-accent-fg font-bold tracking-widest uppercase py-4 px-4 rounded-lg transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? t('analyzing') : t('login_button')}
        </button>
      </motion.div>
    </div>
  );
}

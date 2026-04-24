import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, ShieldAlert, RefreshCw, Send, AlertTriangle } from 'lucide-react';
import { auth } from '../lib/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { useLanguage } from '../contexts/LanguageContext';

interface EmailVerificationGuardProps {
  children: React.ReactNode;
}

export default function EmailVerificationGuard({ children }: EmailVerificationGuardProps) {
  const { lang } = useLanguage();
  const [isVerified, setIsVerified] = useState(auth.currentUser?.emailVerified ?? false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // Check verification status periodically
  useEffect(() => {
    if (!auth.currentUser || isVerified) return;

    const interval = setInterval(async () => {
      try {
        await auth.currentUser?.reload();
        if (auth.currentUser?.emailVerified) {
          setIsVerified(true);
        }
      } catch (e) {
        console.error(e);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [isVerified]);

  const checkStatusMenu = async () => {
    if (auth.currentUser) {
      setLoading(true);
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          setIsVerified(true);
        } else {
          setError(lang === 'ar' ? 'لم يتم تأكيد الإيميل بعد. يرجى تصفح صندوق الوارد.' : 'Email not verified yet. Please check your inbox.');
          setTimeout(() => setError(''), 4000);
        }
      } catch (err: any) {
        setError(err.message);
      }
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      setLoading(true);
      setError('');
      try {
        await sendEmailVerification(auth.currentUser);
        setMsg(lang === 'ar' ? 'تم إرسال رابط التأكيد بنجاح!' : 'Verification email sent successfully!');
      } catch (err: any) {
        if (err.code === 'auth/too-many-requests') {
          setError(lang === 'ar' ? 'لقد طلبت إرسال الرابط عدة مرات. يرجى الانتظار.' : 'Too many requests. Please wait a moment.');
        } else {
          setError(err.message || 'Error sending email');
        }
      }
      setLoading(false);
      setTimeout(() => setMsg(''), 5000);
      setTimeout(() => setError(''), 5000);
    }
  };

  if (!auth.currentUser) return <>{children}</>;
  // Google logins and verified emails pass through
  if (isVerified || auth.currentUser.emailVerified) return <>{children}</>;

  const isAr = lang === 'ar';

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center p-4 my-8">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card max-w-md w-full border-error/30 flex flex-col overflow-hidden relative shadow-[0_0_50px_rgba(255,0,0,0.1)] p-8 text-center"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-error/0 via-error to-error/0 animate-pulse-slow" />
        
        <div className="flex justify-center mb-6 relative">
          <div className="absolute inset-0 bg-error/20 blur-xl rounded-full" />
          <div className="w-20 h-20 rounded-full bg-bg-surface border border-error/50 flex items-center justify-center relative z-10 shadow-[0_0_30px_rgba(255,0,0,0.2)]">
             <ShieldAlert className="w-10 h-10 text-error animate-pulse" />
          </div>
        </div>

        <h2 className="text-2xl font-black text-text-main font-mono mb-2 uppercase tracking-widest">
          {isAr ? 'أمان النظام: تأكيد هويتك' : 'System Guard: Verify Identity'}
        </h2>
        
        <p className="text-sm text-text-dim mb-6 leading-relaxed">
          {isAr 
            ? `لقد تم حظر الوصول إلى أدوات JoeScan كإجراء أمني. تم إرسال رسالة تأكيد إلى بريدك الإلكتروني (${auth.currentUser.email}). يرجى النقر على الرابط لتفعيل حسابك.` 
            : `Access to JoeScan modules is blocked for security reasons. A verification protocol has been sent to (${auth.currentUser.email}). Please click the link to authorize your account.`}
        </p>

        {error && (
          <div className="bg-error/10 border border-error/50 text-error p-3 rounded-lg text-xs font-mono mb-4 text-center flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}
        
        {msg && (
          <div className="bg-accent/10 border border-accent/50 text-accent p-3 rounded-lg text-xs font-mono mb-4 text-center">
            {msg}
          </div>
        )}

        <div className="space-y-3">
          <button 
            onClick={checkStatusMenu}
            disabled={loading}
            className="w-full btn-glow border-error/50 hover:bg-error/10 py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest transition-all text-text-main"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {isAr ? 'أكدت الإيميل؟ حدث الصفحة' : 'I Clicked It - Refresh Status'}
          </button>
          
          <button 
            onClick={handleResend}
            disabled={loading}
            className="w-full bg-bg-surface border border-border-subtle hover:border-text-dim py-3 rounded-lg flex items-center justify-center gap-2 text-sm font-bold uppercase disabled:opacity-50 transition-colors text-text-muted hover:text-text-main"
          >
            <Send className="w-4 h-4" />
            {isAr ? 'إعادة إرسال الرابط' : 'Resend Verification Link'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth, upgradeUserTier, getUserTier } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Zap, Clock, CheckCircle, Sparkles, X } from 'lucide-react';

export default function SocTrialBanner() {
  const { lang } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    checkEligibility();
  }, []);

  const checkEligibility = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) { setVisible(true); return; }

      const data = userDoc.data();
      const tier = data.tier || 'free';
      const expiry = data.subscriptionExpiry?.toDate?.() || (data.subscriptionExpiry ? new Date(data.subscriptionExpiry) : null);
      const trialUsed = data.socTrialUsed === true;

      // If already on paid tier, check if it's a trial and show days left
      if (tier === 'pro' || tier === 'enterprise') {
        if (expiry) {
          const now = new Date();
          const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diff > 0 && diff <= 3) {
            setDaysLeft(diff);
            setActivated(true);
            setVisible(true);
          }
        }
        return;
      }

      // Free tier — show trial banner if not already used
      if (tier === 'free' && !trialUsed) {
        setVisible(true);
      }
    } catch (e) {
      console.warn('Trial check failed:', e);
      setVisible(true);
    }
  };

  const handleActivate = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setActivating(true);
    try {
      // Upgrade to enterprise (SOC) for 3 days
      await upgradeUserTier(user.uid, 'enterprise', 3);

      // Mark trial as used so they can't activate again
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'users', user.uid), {
        socTrialUsed: true,
        socTrialActivatedAt: new Date().toISOString(),
      }, { merge: true });

      setActivated(true);
      setDaysLeft(3);

      // Reload page after brief delay to reflect new tier
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      console.error('Trial activation failed:', err);
    } finally {
      setActivating(false);
    }
  };

  if (!visible || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-r from-accent/5 via-bg-base to-accent/5 p-5 md:p-6 mb-6"
      >
        {/* Animated background pulse */}
        <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-accent/10 animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
          <Shield className="w-40 h-40 -mr-10 -mt-10" />
        </div>

        {/* Dismiss button */}
        {!activated && (
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 z-20 p-1 rounded-lg bg-bg-surface/50 text-text-dim hover:text-text-main transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 md:gap-6">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            {activated ? (
              <CheckCircle className="w-8 h-8 text-accent" />
            ) : (
              <Sparkles className="w-8 h-8 text-accent animate-pulse" />
            )}
          </div>

          {/* Text */}
          <div className="flex-1 text-center md:text-left md:rtl:text-right">
            {activated ? (
              <>
                <h3 className="text-lg font-black uppercase tracking-wide text-accent mb-1">
                  {lang === 'ar' ? '✅ تم تفعيل النسخة التجريبية!' : '✅ SOC Enterprise Trial Activated!'}
                </h3>
                <p className="text-sm text-text-dim">
                  {lang === 'ar'
                    ? `لديك ${daysLeft} أيام متبقية من اشتراك SOC Enterprise المجاني. استمتع بجميع الأدوات المتقدمة بما فيها SIEM وإدارة الفريق وخريطة التهديدات!`
                    : `You have ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining on your free SOC Enterprise trial. Enjoy SIEM, Team Management, Threat Map & all tools!`}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <h3 className="text-lg font-black uppercase tracking-wide text-text-main">
                    {lang === 'ar' ? '🎁 نسخة SOC Enterprise التجريبية — مجاناً!' : '🎁 Free SOC Enterprise Trial — 3 Days!'}
                  </h3>
                </div>
                <p className="text-sm text-text-dim max-w-lg">
                  {lang === 'ar'
                    ? 'فعّل اشتراك SOC Enterprise المجاني لمدة 3 أيام واحصل على كل شيء: فحوصات غير محدودة، SIEM Webhooks، إدارة الفريق، خريطة التهديدات ثلاثية الأبعاد، تقارير PDF بدون علامة مائية، وكل الأدوات المتقدمة.'
                    : 'Activate your free 3-day SOC Enterprise trial and unlock everything: unlimited scans, SIEM Webhooks, Team Management, 3D Threat Map, watermark-free PDF reports, and all advanced tools.'}
                </p>
                <div className="flex items-center gap-4 mt-2 text-[11px] font-mono text-text-dim">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {lang === 'ar' ? '3 أيام مجانية' : '3 days free'}</span>
                  <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {lang === 'ar' ? 'بدون بطاقة ائتمان' : 'No credit card'}</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {lang === 'ar' ? 'إلغاء تلقائي' : 'Auto-expires'}</span>
                </div>
              </>
            )}
          </div>

          {/* CTA Button */}
          {!activated && (
            <button
              onClick={handleActivate}
              disabled={activating}
              className="shrink-0 bg-accent text-accent-fg px-8 py-3.5 rounded-xl font-black uppercase tracking-widest text-sm hover:bg-accent/90 disabled:opacity-50 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,0,0.2)] hover:shadow-[0_0_30px_rgba(0,255,0,0.3)]"
            >
              {activating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" className="opacity-75" /></svg>
                  {lang === 'ar' ? 'جاري التفعيل...' : 'Activating...'}
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  {lang === 'ar' ? 'تفعيل مجاناً' : 'Activate Free'}
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

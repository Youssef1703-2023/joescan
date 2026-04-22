import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Zap, Lock, CreditCard, Gift, Check, X, ShieldCheck, ExternalLink, Sparkles } from 'lucide-react';
import { auth, db, getUserTier, upgradeUserTier, SubscriptionTier } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';
import CheckoutModal from './CheckoutModal';

// External Checkout Modal handled payment

export default function Pricing() {
  const { language, t } = useLanguage();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'USD' | 'EGP'>('USD');
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('free');
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      getUserTier(auth.currentUser.uid).then(t => {
        setCurrentTier(t);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    
    // Check user location for currency
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.country_code === 'EG') {
          setCurrency('EGP');
        }
      })
      .catch(() => {});
    
    // Check for Stripe redirect success
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setPaymentSuccess(true);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refresh tier
      if (auth.currentUser) {
        getUserTier(auth.currentUser.uid).then(t => setCurrentTier(t));
      }
    }
  }, []);

  const handleSelectTier = (tier: SubscriptionTier) => {
    if (tier === currentTier) return;
    if (tier === 'free') return;
    setSelectedTier(tier);
    setPaymentSuccess(false);
    setPaymentSuccess(false);
    setCheckoutError('');
    setIsCheckoutOpen(true);
  };

  const handlePaymentSuccess = async (tier: 'pro' | 'enterprise') => {
    if (!auth.currentUser) throw new Error("Not logged in");
    await upgradeUserTier(auth.currentUser.uid, tier, 30);
    setCurrentTier(tier);
    setPaymentSuccess(true);
  };

  if (loading) {
     return <div className="flex justify-center items-center h-full"><Zap className="w-8 h-8 animate-pulse text-accent" /></div>;
  }

  const formatPrice = (usdPrice: number) => {
    if (usdPrice === 0) {
      if (currency === 'EGP') return language === 'en' ? '0 EGP' : '٠ ج.م';
      return '$0';
    }
    if (currency === 'EGP') {
      return language === 'en' ? `${usdPrice * 50} EGP` : `${usdPrice * 50} ج.م`;
    }
    return `$${usdPrice}`;
  };

  const tiers = [
    {
      id: 'free',
      name: t('pricing_stealth'),
      price: formatPrice(0),
      description: t('pricing_stealth_desc'),
      features: [
        t('pricing_f_watchlist_1'),
        t('pricing_f_weekly'),
        t('pricing_f_scans_10'),
        t('pricing_f_device_unlimited'),
        t('pricing_f_pdf_watermark'),
      ]
    },
    {
      id: 'pro',
      name: t('pricing_pro'),
      price: formatPrice(6),
      originalPrice: formatPrice(12),
      discountLabel: `50% ${t('pricing_off')}`,
      description: t('pricing_pro_desc'),
      features: [
        '15 Targets on Live Activities',
        '150 Scans/Day',
        t('pricing_f_whitelabel'),
        t('pricing_f_darkweb'),
        t('pricing_f_watchlist_50'),
      ]
    },
    {
      id: 'enterprise',
      name: t('pricing_enterprise'),
      price: formatPrice(30),
      originalPrice: formatPrice(60),
      discountLabel: `50% ${t('pricing_off')}`,
      description: t('pricing_enterprise_desc'),
      features: [
        t('pricing_f_unlimited_watchlist'),
        t('pricing_f_realtime'),
        t('pricing_f_siem'),
        t('pricing_f_team'),
        t('pricing_f_threatmap'),
      ]
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 w-full">
      {/* Payment Success Banner */}
      {paymentSuccess && !isCheckoutOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-accent/10 border border-accent/30 rounded-2xl p-6 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-accent/5 animate-pulse" />
          <div className="relative z-10 flex flex-col items-center gap-3">
            <ShieldCheck className="w-10 h-10 text-accent" />
            <h2 className="text-xl font-black uppercase tracking-widest">{t('pricing_access_granted')}</h2>
            <p className="text-text-dim text-sm">{t('pricing_upgraded')}</p>
          </div>
        </motion.div>
      )}

      <div className="text-center space-y-4 pt-8">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">{t('pricing_title')}</h1>
        <p className="text-text-dim max-w-2xl mx-auto text-lg">
          {t('pricing_subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
        {tiers.map((tier, idx) => {
          const isActive = currentTier === tier.id;
          const isPro = tier.id === 'pro';
          const isEnterprise = tier.id === 'enterprise';
          
          return (
            <motion.div 
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`glass-card p-8 rounded-2xl border-2 flex flex-col relative overflow-hidden transition-all duration-300 ${
                isActive 
                  ? 'border-accent/80 shadow-[0_0_30px_rgba(var(--color-accent),0.2)]' 
                  : isEnterprise 
                  ? 'border-error/30 hover:border-error/50' 
                  : 'border-border-subtle hover:border-border-main'
              }`}
            >
              {isPro && !isActive && (
                <div className="absolute top-0 right-0 bg-accent text-accent-fg text-[10px] font-bold uppercase tracking-widest py-1 px-3 rounded-bl-lg">
                  {t('pricing_most_popular')}
                </div>
              )}
              {isEnterprise && (
                <div className="absolute inset-0 bg-error/5 animate-pulse-glow" style={{ animationDuration: '4s' }} />
              )}
              
              <div className="relative z-10 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-text-dim">{tier.name}</h3>
                  {tier.discountLabel && (
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${isEnterprise ? 'bg-error/20 text-error' : 'bg-accent/20 text-accent'}`}>
                      {tier.discountLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className={`text-4xl font-black ${isEnterprise ? 'text-error' : ''}`}>{tier.price}</span>
                  {tier.originalPrice && (
                    <span className="text-xl font-bold line-through text-text-dim/50 decoration-2 decoration-bg-elevated">{tier.originalPrice}</span>
                  )}
                  <span className="text-text-dim text-sm">{t('pricing_mo')}</span>
                </div>
                <p className="text-sm text-text-dim min-h-[3.5rem] mb-6 leading-relaxed bg-bg-surface p-3 rounded-xl border border-border-subtle/50">{tier.description}</p>
                
                <ul className="space-y-4 mb-8">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Check className={`w-5 h-5 shrink-0 ${isEnterprise ? 'text-error' : 'text-accent'}`} />
                      <span className="text-text-main">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                onClick={() => handleSelectTier(tier.id as SubscriptionTier)}
                disabled={isActive || (tier.id === 'free' && currentTier !== 'free')}
                className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all duration-300 relative z-10 ${
                  isActive 
                    ? 'bg-bg-elevated text-text-dim cursor-not-allowed border border-border-subtle' 
                    : isEnterprise
                    ? 'bg-error/10 text-error hover:bg-error/20 border border-error/50 glow-low-error'
                    : 'btn-glow'
                }`}
              >
                {isActive ? t('pricing_current') : t('pricing_deploy')}
              </button>
            </motion.div>
          )
        })}
      </div>

      {/* Payment Gateway Modal */}
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)}
        tier={selectedTier as 'pro' | 'enterprise'}
        planName={selectedTier === 'enterprise' ? t('pricing_enterprise') : t('pricing_pro')}
        price={selectedTier === 'enterprise' ? formatPrice(30) : formatPrice(6)}
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}

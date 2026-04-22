import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Zap, Lock, CreditCard, Gift, Check, X, ShieldCheck, ExternalLink, Sparkles } from 'lucide-react';
import { auth, db, getUserTier, upgradeUserTier, SubscriptionTier } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';

// ─── Stripe Configuration ───
// Replace these with your real Stripe Payment Links when ready
const STRIPE_CONFIG = {
  // Stripe Payment Links (create these in your Stripe Dashboard)
  // Format: https://buy.stripe.com/xxxxx?client_reference_id={uid}
  pro: {
    paymentLink: '', // e.g. 'https://buy.stripe.com/test_xxxxx'
    priceId: '',     // e.g. 'price_xxxxx'
  },
  enterprise: {
    paymentLink: '', // e.g. 'https://buy.stripe.com/test_yyyyy'
    priceId: '',     // e.g. 'price_yyyyy'
  },
  // After payment, Stripe redirects here
  successUrl: `${window.location.origin}/pricing?payment=success`,
  cancelUrl: `${window.location.origin}/pricing?payment=cancelled`,
};

export default function Pricing() {
  const { language, t } = useLanguage();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'USD' | 'EGP'>('USD');
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('free');
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'promo'>('stripe');

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
    setCheckoutError('');
    setPromoCode('');
    setPromoDiscount(0);
    setPaymentMethod('stripe');
    setIsCheckoutOpen(true);
  };

  const handleApplyPromo = async () => {
    setCheckoutError('');
    setIsProcessing(true);
    const code = promoCode.toUpperCase().trim();
    if (!code) {
       setCheckoutError('Enter a valid promo code');
       setIsProcessing(false);
       return;
    }

    try {
      const codeRef = doc(db, 'promoCodes', code);
      const codeSnap = await getDoc(codeRef);

      if (codeSnap.exists() && codeSnap.data().active !== false) {
        const promoData = codeSnap.data();
        if (promoData.targetTier === selectedTier) {
          setPromoDiscount(promoData.discount || 100);
          setPaymentMethod('promo');
        } else {
          setCheckoutError(`This code is valid for ${promoData.targetTier} tier.`);
          setPromoDiscount(0);
        }
      } else {
        // Fallbacks
        if (code === 'JOEPRO' && selectedTier === 'pro') {
          setPromoDiscount(100);
          setPaymentMethod('promo');
        } else if (code === 'JOE99' && selectedTier === 'enterprise') {
          setPromoDiscount(100);
          setPaymentMethod('promo');
        } else {
          setCheckoutError('Invalid or expired promo code');
          setPromoDiscount(0);
        }
      }
    } catch (err) {
       console.error("Promo error", err);
       setCheckoutError('Failed to verify code securely');
    } finally {
       setIsProcessing(false);
    }
  };

  const handleStripeCheckout = () => {
    if (!auth.currentUser) return;
    
    const config = selectedTier === 'enterprise' ? STRIPE_CONFIG.enterprise : STRIPE_CONFIG.pro;
    
    if (!config.paymentLink) {
      setCheckoutError('Payment system is being configured. Use a promo code for now, or contact support.');
      return;
    }
    
    // Build Stripe Payment Link URL with client_reference_id
    const url = new URL(config.paymentLink);
    url.searchParams.set('client_reference_id', auth.currentUser.uid);
    url.searchParams.set('prefilled_email', auth.currentUser.email || '');
    
    // Redirect to Stripe
    window.open(url.toString(), '_blank');
  };

  const handlePromoCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');
    setIsProcessing(true);

    try {
      if (!auth.currentUser) throw new Error("Not logged in");

      if (promoDiscount < 100) {
        setCheckoutError('Promo code does not provide full discount. Please complete payment via Stripe.');
        setIsProcessing(false);
        return;
      }

      // Promo provides full discount — upgrade directly
      await new Promise(r => setTimeout(r, 1500)); // Visual processing delay
      await upgradeUserTier(auth.currentUser.uid, selectedTier, 30);
      setCurrentTier(selectedTier);
      setPaymentSuccess(true);

      setTimeout(() => {
        setIsCheckoutOpen(false);
      }, 3000);
      
    } catch (err: any) {
      setCheckoutError(err.message || 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
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
      <AnimatePresence>
        {isCheckoutOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className={`glass-card max-w-lg w-full p-0 relative overflow-hidden flex flex-col ${selectedTier === 'enterprise' ? 'border-error/50 shadow-[0_0_40px_rgba(255,0,0,0.15)]' : 'border-accent/50 shadow-[0_0_40px_rgba(0,255,0,0.1)]'}`}
            >
              {paymentSuccess ? (
                <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${selectedTier === 'enterprise' ? 'border-error text-error bg-error/10' : 'border-accent text-accent bg-accent/10'}`}
                  >
                    <ShieldCheck className="w-10 h-10" />
                  </motion.div>
                  <h2 className="text-2xl font-black uppercase tracking-widest">{t('pricing_access_granted')}</h2>
                  <p className="text-text-dim">{t('pricing_telemetry_upgraded')}</p>
                  <p className="text-xs text-text-dim font-mono">Tier: {selectedTier.toUpperCase()} • Active for 30 days</p>
                </div>
              ) : (
                <form onSubmit={handlePromoCheckout}>
                  {/* Header */}
                  <div className={`p-6 border-b ${selectedTier === 'enterprise' ? 'border-error/20 bg-error/5' : 'border-accent/20 bg-accent/5'} flex justify-between items-center`}>
                    <div>
                      <h2 className="text-lg font-bold font-mono uppercase tracking-widest flex items-center gap-2">
                        <Lock className={`w-5 h-5 ${selectedTier === 'enterprise' ? 'text-error' : 'text-accent'}`} /> {t('pricing_secure_gateway')}
                      </h2>
                      <p className="text-xs text-text-dim mt-1">{t('pricing_acquiring')} {selectedTier === 'enterprise' ? t('pricing_enterprise') : t('pricing_pro')} {t('pricing_clearance')}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black font-mono">
                        {promoDiscount === 100 ? formatPrice(0) : selectedTier === 'enterprise' ? formatPrice(30) : formatPrice(6)}
                      </div>
                      <span className="text-[10px] text-text-dim font-mono">/month</span>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {checkoutError && (
                      <div className="p-3 bg-error/10 border border-error/50 text-error text-xs rounded-lg font-mono">
                        [ERROR] {checkoutError}
                      </div>
                    )}

                    {/* Payment Method Tabs */}
                    <div className="flex gap-2 bg-bg-base rounded-xl p-1 border border-border-subtle">
                      <button 
                        type="button"
                        onClick={() => setPaymentMethod('stripe')}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                          paymentMethod === 'stripe' 
                            ? selectedTier === 'enterprise' 
                              ? 'bg-error/10 text-error border border-error/30' 
                              : 'bg-accent/10 text-accent border border-accent/30'
                            : 'text-text-dim hover:text-text-main'
                        }`}
                      >
                        <CreditCard className="w-4 h-4" /> {t('pricing_card_stripe')}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPaymentMethod('promo')}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                          paymentMethod === 'promo' 
                            ? selectedTier === 'enterprise' 
                              ? 'bg-error/10 text-error border border-error/30' 
                              : 'bg-accent/10 text-accent border border-accent/30'
                            : 'text-text-dim hover:text-text-main'
                        }`}
                      >
                        <Gift className="w-4 h-4" /> {t('pricing_promo_code')}
                      </button>
                    </div>

                    {/* Stripe Payment Section */}
                    {paymentMethod === 'stripe' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${selectedTier === 'enterprise' ? 'bg-error/10' : 'bg-accent/10'}`}>
                              <Shield className={`w-5 h-5 ${selectedTier === 'enterprise' ? 'text-error' : 'text-accent'}`} />
                            </div>
                            <div>
                              <h3 className="font-bold text-sm">{t('pricing_secure_checkout')}</h3>
                              <p className="text-[10px] text-text-dim font-mono">{t('pricing_encrypted')}</p>
                            </div>
                          </div>
                          
                          <p className="text-sm text-text-dim leading-relaxed">
                            {t('pricing_stripe_desc')}
                          </p>

                          <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-1.5 bg-bg-base px-3 py-1.5 rounded-lg border border-border-subtle">
                              <span className="text-[10px] font-mono text-text-dim">Visa</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-bg-base px-3 py-1.5 rounded-lg border border-border-subtle">
                              <span className="text-[10px] font-mono text-text-dim">Mastercard</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-bg-base px-3 py-1.5 rounded-lg border border-border-subtle">
                              <span className="text-[10px] font-mono text-text-dim">Apple Pay</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-bg-base px-3 py-1.5 rounded-lg border border-border-subtle">
                              <span className="text-[10px] font-mono text-text-dim">Google Pay</span>
                            </div>
                          </div>
                        </div>

                        <button 
                          type="button"
                          onClick={handleStripeCheckout}
                          disabled={isProcessing}
                          className={`w-full py-4 rounded-xl text-sm font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-3 transition-all ${
                            selectedTier === 'enterprise' 
                              ? 'bg-error text-white hover:bg-error/90 shadow-lg shadow-error/20' 
                              : 'btn-glow'
                          }`}
                        >
                          <ExternalLink className="w-4 h-4" />
                          {t('pricing_pay_stripe')}
                        </button>
                      </motion.div>
                    )}

                    {/* Promo Code Section */}
                    {paymentMethod === 'promo' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-text-dim flex items-center gap-2">
                            <Sparkles className="w-4 h-4" /> {t('pricing_clearance_code')}
                          </h3>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={promoCode}
                              onChange={e => setPromoCode(e.target.value)}
                              placeholder={t('pricing_enter_code')}
                              className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-mono uppercase" 
                            />
                            <button 
                              type="button" 
                              onClick={handleApplyPromo} 
                              disabled={isProcessing}
                              className={`px-5 rounded-lg font-bold text-xs uppercase transition-all ${
                                selectedTier === 'enterprise'
                                  ? 'bg-error/10 border border-error/30 hover:bg-error/20 text-error'
                                  : 'bg-bg-elevated border border-border-subtle hover:border-accent'
                              }`}
                            >
                              {t('pricing_verify')}
                            </button>
                          </div>
                          {promoDiscount > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
                                selectedTier === 'enterprise' 
                                  ? 'bg-error/10 border-error/30 text-error' 
                                  : 'bg-accent/10 border-accent/30 text-accent'
                              }`}
                            >
                              <Check className="w-4 h-4" />
                              {t('pricing_code_accepted')}: {promoDiscount}% {t('pricing_override_active')}.
                            </motion.div>
                          )}
                        </div>

                        {promoDiscount === 100 && (
                          <button 
                            type="submit" 
                            disabled={isProcessing}
                            className={`w-full py-4 rounded-xl text-sm font-bold uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2 transition-all ${
                              selectedTier === 'enterprise' 
                                ? 'bg-error text-white hover:bg-error/90 shadow-lg shadow-error/20' 
                                : 'btn-glow'
                            }`}
                          >
                            {isProcessing ? <Zap className="w-4 h-4 animate-pulse" /> : t('pricing_confirm')}
                          </button>
                        )}
                      </motion.div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-border-subtle bg-bg-surface flex items-center justify-between">
                    <button 
                      type="button"
                      onClick={() => setIsCheckoutOpen(false)}
                      disabled={isProcessing}
                      className="px-5 py-2.5 bg-bg-elevated text-text-main rounded-lg text-xs font-bold uppercase hover:bg-bg-base transition-colors border border-border-subtle"
                    >
                      {t('pricing_abort')}
                    </button>
                    <div className="flex items-center gap-2 text-[10px] text-text-dim font-mono">
                      <Lock className="w-3 h-3" />
                      <span>{t('pricing_e2e_encrypted')}</span>
                    </div>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

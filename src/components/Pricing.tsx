import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Zap, Lock, CreditCard, Gift, Check, X, ShieldCheck } from 'lucide-react';
import { auth, db, getUserTier, upgradeUserTier, SubscriptionTier } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';

export default function Pricing() {
  const { lang } = useLanguage();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [loading, setLoading] = useState(true);
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('free');
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    if (auth.currentUser) {
      getUserTier(auth.currentUser.uid).then(t => {
        setCurrentTier(t);
        setLoading(false);
      });
    }
  }, []);

  const handleSelectTier = (tier: SubscriptionTier) => {
    if (tier === currentTier) return;
    if (tier === 'free') return; // Cannot downgrade to free from UI currently
    setSelectedTier(tier);
    setPaymentSuccess(false);
    setCheckoutError('');
    setPromoCode('');
    setPromoDiscount(0);
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
        } else {
          setCheckoutError(`This code is valid for ${promoData.targetTier} tier.`);
          setPromoDiscount(0);
        }
      } else {
        // Fallbacks
        if (code === 'JOEPRO' && selectedTier === 'pro') {
          setPromoDiscount(100);
        } else if (code === 'JOE99' && selectedTier === 'enterprise') {
          setPromoDiscount(100);
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

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError('');
    setIsProcessing(true);

    try {
      if (!auth.currentUser) throw new Error("Not logged in");

      // Simulate Gateway Processing (Visa / Stripe Mock)
      await new Promise(r => setTimeout(r, 2000));
      
      // Update locally & remotely
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

  const tiers = [
    {
      id: 'free',
      name: 'Stealth',
      price: '$0',
      description: 'Core intelligence tools for basic footprinting.',
      features: [
        '1 Target on Live Watchlist',
        'Weekly Watchlist Scan (1 Day/Week)',
        '10 Manual Scans/Day',
        'Unlimited Device Security Checks',
        'Standard PDF Reports (Watermarked)',
      ]
    },
    {
      id: 'pro',
      name: 'Pro Analyst',
      price: '$6',
      originalPrice: '$12',
      discountLabel: '50% OFF',
      description: 'Advanced automation and unrestricted manual investigations.',
      features: [
        '50 Targets on Live Watchlist',
        'Daily Watchlist Monitoring (Today)',
        '500 Manual Scans/Day',
        'Unbranded White-label Dossiers',
        'Dark Web Password Check Unlocked'
      ]
    },
    {
      id: 'enterprise',
      name: 'SOC Enterprise',
      price: '$99',
      originalPrice: '$199',
      discountLabel: '50% OFF',
      description: 'God-Tier command center for large scale threat operations.',
      features: [
        'Unlimited Watchlist Targets',
        'Continuous Real-time Sweeps (24/7)',
        'SIEM / Webhook Integrations',
        'Team Management (5 Users)',
        '3D Threat Map Visualizer'
      ]
    }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 w-full">
      <div className="text-center space-y-4 pt-8">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight">Expand Your Arsenal</h1>
        <p className="text-text-dim max-w-2xl mx-auto text-lg">
          Military-grade OSINT infrastructure built for operators. Secure a tier that matches your threat model.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
        {tiers.map((t, idx) => {
          const isActive = currentTier === t.id;
          const isPro = t.id === 'pro';
          const isEnterprise = t.id === 'enterprise';
          
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
                  Most Popular
                </div>
              )}
              {isEnterprise && (
                <div className="absolute inset-0 bg-error/5 animate-pulse-glow" style={{ animationDuration: '4s' }} pointerEvents="none" />
              )}
              
              <div className="relative z-10 flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-mono text-xs uppercase tracking-widest text-text-dim">{t.name}</h3>
                  {t.discountLabel && (
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${isEnterprise ? 'bg-error/20 text-error' : 'bg-accent/20 text-accent'}`}>
                      {t.discountLabel}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className={`text-4xl font-black ${isEnterprise ? 'text-error' : ''}`}>{t.price}</span>
                  {t.originalPrice && (
                    <span className="text-xl font-bold line-through text-text-dim/50 decoration-2 decoration-bg-elevated">{t.originalPrice}</span>
                  )}
                  <span className="text-text-dim text-sm">/mo</span>
                </div>
                <p className="text-sm text-text-dim min-h-[3.5rem] mb-6 leading-relaxed bg-bg-surface p-3 rounded-xl border border-border-subtle/50">{t.description}</p>
                
                <ul className="space-y-4 mb-8">
                  {t.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <Check className={`w-5 h-5 shrink-0 ${isEnterprise ? 'text-error' : 'text-accent'}`} />
                      <span className="text-text-main">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                onClick={() => handleSelectTier(t.id as SubscriptionTier)}
                disabled={isActive || (t.id === 'free' && currentTier !== 'free')}
                className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all duration-300 relative z-10 ${
                  isActive 
                    ? 'bg-bg-elevated text-text-dim cursor-not-allowed border border-border-subtle' 
                    : isEnterprise
                    ? 'bg-error/10 text-error hover:bg-error/20 border border-error/50 glow-low-error'
                    : 'btn-glow'
                }`}
              >
                {isActive ? 'Current Array' : 'Deploy Arsenal'}
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
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center border-4 ${selectedTier === 'enterprise' ? 'border-error text-error bg-error/10' : 'border-accent text-accent bg-accent/10'}`}>
                    <ShieldCheck className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-widest">Access Granted</h2>
                  <p className="text-text-dim">Your telemetry arrays have been successfully upgraded.</p>
                </div>
              ) : (
                <form onSubmit={handleCheckout}>
                  <div className={`p-6 border-b ${selectedTier === 'enterprise' ? 'border-error/20 bg-error/5' : 'border-accent/20 bg-accent/5'} flex justify-between items-center`}>
                    <div>
                      <h2 className="text-lg font-bold font-mono uppercase tracking-widest flex items-center gap-2">
                        <Lock className={`w-5 h-5 ${selectedTier === 'enterprise' ? 'text-error' : 'text-accent'}`} /> Secure Gateway
                      </h2>
                      <p className="text-xs text-text-dim mt-1">Acquiring {selectedTier === 'enterprise' ? 'SOC Enterprise' : 'Pro Analyst'} clearance</p>
                    </div>
                    <div className="text-3xl font-black font-mono">
                      {promoDiscount === 100 ? '$0' : selectedTier === 'enterprise' ? '$99' : '$6'}
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {checkoutError && (
                      <div className="p-3 bg-error/10 border border-error/50 text-error text-xs rounded-lg font-mono">
                        [ERROR] {checkoutError}
                      </div>
                    )}

                    <div className="space-y-4 border-b border-border-subtle pb-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-text-dim flex items-center gap-2">
                        <CreditCard className="w-4 h-4" /> Payment Details
                      </h3>
                      <div>
                        <label className="text-[10px] font-mono uppercase text-text-dim">Card Number</label>
                        <input type="text" required={promoDiscount < 100} placeholder="4242 4242 4242 4242" className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-mono" />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-[10px] font-mono uppercase text-text-dim">Expiry</label>
                          <input type="text" required={promoDiscount < 100} placeholder="MM/YY" className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-mono" />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-mono uppercase text-text-dim">CVC</label>
                          <input type="text" required={promoDiscount < 100} placeholder="123" className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-mono" />
                        </div>
                      </div>
                      <div className="pt-2">
                        <button type="button" className={`w-full py-3 rounded-lg border flex items-center justify-center gap-2 text-sm font-bold transition-all ${selectedTier === 'enterprise' ? 'border-error/30 hover:bg-error/10 hover:border-error text-error/80' : 'border-border-subtle hover:bg-bg-surface'}`}>
                          Pay with Google Pay
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-text-dim flex items-center gap-2">
                        <Gift className="w-4 h-4" /> Promotional Override
                      </h3>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={promoCode}
                          onChange={e => setPromoCode(e.target.value)}
                          placeholder="ENTER CLEARANCE CODE" 
                          className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-mono uppercase" 
                        />
                        <button type="button" onClick={handleApplyPromo} className="px-4 bg-bg-elevated border border-border-subtle rounded-lg hover:border-accent transition-colors font-bold text-xs uppercase">
                          Apply
                        </button>
                      </div>
                      {promoDiscount > 0 && <p className="text-xs text-accent font-mono animate-pulse">Code Accepted: 100% Override Active.</p>}
                    </div>
                  </div>

                  <div className="p-6 border-t border-border-subtle bg-bg-surface flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsCheckoutOpen(false)}
                      disabled={isProcessing}
                      className="px-6 py-3 bg-bg-elevated text-text-main rounded-lg text-sm font-bold uppercase hover:bg-bg-base transition-colors border border-border-subtle"
                    >
                      Abort
                    </button>
                    <button 
                      type="submit" 
                      disabled={isProcessing}
                      className={`flex-1 py-3 rounded-lg text-sm font-bold uppercase disabled:opacity-50 flex items-center justify-center gap-2 ${selectedTier === 'enterprise' ? 'bg-error text-error-fg glow-low-error' : 'btn-glow'}`}
                    >
                      {isProcessing ? <Zap className="w-4 h-4 animate-pulse" /> : 'Confirm Authorization'}
                    </button>
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

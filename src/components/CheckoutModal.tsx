import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, CheckCircle, Loader2, Shield, MessageCircle, Tag, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  price: string;
  tier: 'pro' | 'enterprise';
  onPaymentSuccess: (tier: 'pro' | 'enterprise') => Promise<void>;
}

export default function CheckoutModal({ isOpen, onClose, planName, price, tier, onPaymentSuccess }: CheckoutModalProps) {
  const { dir } = useLanguage();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoApplied, setPromoApplied] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState('');

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoApplied(null);

    try {
      const code = promoCode.toUpperCase().trim();
      const promoRef = doc(db, 'promoCodes', code);
      const promoSnap = await getDoc(promoRef);

      if (!promoSnap.exists()) {
        setPromoError('Invalid promo code');
        setPromoLoading(false);
        return;
      }

      const data = promoSnap.data();
      
      if (!data.active) {
        setPromoError('This promo code has expired');
        setPromoLoading(false);
        return;
      }

      if (data.targetTier && data.targetTier !== tier && data.targetTier !== 'all') {
        setPromoError(`This code is only valid for ${data.targetTier} plan`);
        setPromoLoading(false);
        return;
      }

      // If discount is 100%, auto-upgrade immediately
      if (data.discount >= 100) {
        setPromoApplied({ code, discount: 100 });
        setIsProcessing(true);
        try {
          await onPaymentSuccess(tier);
          setIsSuccess(true);
        } catch (err: any) {
          setError(err.message || 'Failed to upgrade');
        }
        setIsProcessing(false);
      } else {
        setPromoApplied({ code, discount: data.discount });
      }
    } catch (err) {
      setPromoError('Failed to verify promo code');
    }

    setPromoLoading(false);
  };

  const getDiscountedPrice = () => {
    if (!promoApplied) return price;
    const numericPrice = parseFloat(price.replace(/[^\d.]/g, ''));
    const discounted = numericPrice * (1 - promoApplied.discount / 100);
    // Keep the same currency format
    if (price.includes('EGP') || price.includes('ج.م')) {
      return price.includes('EGP') ? `${Math.round(discounted)} EGP` : `${Math.round(discounted)} ج.م`;
    }
    return `$${discounted.toFixed(0)}`;
  };

  const handleWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    const phoneNumber = "201123343296";
    const promoText = promoApplied ? ` (Promo: ${promoApplied.code} - ${promoApplied.discount}% off)` : '';
    const finalPrice = promoApplied ? getDiscountedPrice() : price;
    const message = `Hello JoeScan Team, I would like to subscribe to the ${planName} plan (${finalPrice}/month)${promoText}. Please let me know how to proceed with the payment.`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    setTimeout(() => {
      window.open(whatsappUrl, '_blank');
      setIsProcessing(false);
      onClose();
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir={dir}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative"
        >
          {/* Close Button */}
          <button onClick={onClose} disabled={isProcessing || isSuccess} className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-text-dim hover:text-white transition-colors z-20">
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="p-6 pb-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="text-lg font-black uppercase tracking-widest text-white">Upgrade to {planName}</h2>
                <p className="text-xs text-text-dim font-mono">Select your payment method</p>
              </div>
            </div>
          </div>

          {/* Price Display */}
          <div className="px-6 py-4">
            <div className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-text-dim font-mono uppercase tracking-widest">Total Amount</p>
                <div className="flex items-baseline gap-2 mt-1">
                  {promoApplied ? (
                    <>
                      <span className="text-2xl font-black text-accent">{getDiscountedPrice()}</span>
                      <span className="text-sm line-through text-text-dim/50">{price}</span>
                      <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-bold">-{promoApplied.discount}%</span>
                    </>
                  ) : (
                    <span className="text-2xl font-black text-accent">{price}</span>
                  )}
                  <span className="text-text-dim text-xs">/mo</span>
                </div>
              </div>
              <Lock className="w-5 h-5 text-text-dim/30" />
            </div>
          </div>

          {isSuccess ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-10 px-6 text-center"
            >
              <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Upgrade Successful!</h3>
              <p className="text-text-dim text-sm">Welcome to {planName}. All features are now unlocked.</p>
              <button onClick={onClose} className="mt-6 px-8 py-3 bg-accent text-accent-fg font-bold uppercase tracking-widest rounded-xl text-sm">
                Continue
              </button>
            </motion.div>
          ) : (
            <div className="px-6 pb-6 space-y-4">
              {error && (
                <div className="text-error text-sm bg-error/10 border border-error/20 p-3 rounded-xl flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              {/* ── Promo Code Section ── */}
              <div className="bg-bg-surface border border-border-subtle rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-accent" />
                  <span className="text-xs font-bold uppercase tracking-widest text-text-dim">Promo Code</span>
                </div>
                
                {promoApplied ? (
                  <div className="flex items-center gap-3 bg-accent/10 border border-accent/30 rounded-lg p-3">
                    <Sparkles className="w-5 h-5 text-accent" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-accent">{promoApplied.code} Applied!</p>
                      <p className="text-xs text-text-dim">{promoApplied.discount}% discount active</p>
                    </div>
                    <button 
                      onClick={() => { setPromoApplied(null); setPromoCode(''); }}
                      className="text-xs text-text-dim hover:text-white transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                      placeholder="ENTER CODE"
                      className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-3 py-2.5 text-sm font-mono uppercase tracking-widest text-white placeholder:text-text-dim/40 focus:outline-none focus:border-accent/50 transition-colors"
                    />
                    <button
                      onClick={handleApplyPromo}
                      disabled={promoLoading || !promoCode.trim()}
                      className="shrink-0 px-3 sm:px-4 py-2.5 bg-accent/10 border border-accent/30 text-accent font-bold uppercase text-xs tracking-widest rounded-lg hover:bg-accent/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                    </button>
                  </div>
                )}
                
                {promoError && (
                  <p className="text-error text-xs mt-2 font-mono">{promoError}</p>
                )}
              </div>

              {/* ── WhatsApp Payment Button ── */}
              <button 
                onClick={handleWhatsApp}
                disabled={isProcessing}
                className="w-full min-h-[3.5rem] py-3 px-2 sm:px-4 bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold uppercase tracking-wide text-xs sm:text-sm rounded-xl transition-all hover:scale-[1.02] flex items-center justify-center relative overflow-hidden group disabled:opacity-70 disabled:hover:scale-100"
              >
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10 flex items-center justify-center gap-2 max-w-full">
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" /> Redirecting...
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-5 h-5 shrink-0" />
                      <span className="truncate whitespace-normal text-center leading-snug">Pay {promoApplied ? getDiscountedPrice() : price} via WhatsApp</span>
                    </>
                  )}
                </span>
              </button>

              <p className="text-center text-[10px] text-text-dim uppercase tracking-widest">
                Contact our team to complete payment • Instant activation
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

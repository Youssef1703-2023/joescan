import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, CheckCircle, Loader2, Shield } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  price: string;
  tier: 'pro' | 'enterprise';
  onPaymentSuccess: (tier: 'pro' | 'enterprise') => Promise<void>;
}

export default function CheckoutModal({ isOpen, onClose, planName, price, tier }: CheckoutModalProps) {
  const { dir } = useLanguage();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Redirect to WhatsApp
    const phoneNumber = "201123343296";
    const message = `Hello JoeScan Team, I would like to subscribe to the ${planName} plan (${price}/month) for my account. Please let me know how to proceed with the payment.`;
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
          className="w-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative flex flex-col md:flex-row"
        >
          {/* Left Side - Receipt Summary */}
          <div className="w-full md:w-2/5 bg-gradient-to-br from-bg-surface to-bg-base p-8 border-r border-white/5 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[100px] -mr-32 -mt-32" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-12">
                <Shield className="w-8 h-8 text-accent" />
                <span className="text-xl font-bold tracking-widest text-white">JOESCAN</span>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-mono text-text-dim uppercase tracking-widest mb-1">Subscription</h3>
                  <div className="text-2xl font-bold text-white uppercase tracking-wider">{planName}</div>
                </div>
                
                <div className="h-px w-full bg-white/10" />
                
                <div>
                  <h3 className="text-sm font-mono text-text-dim uppercase tracking-widest mb-1">Total Amount</h3>
                  <div className="text-4xl font-bold text-accent">{price} <span className="text-lg text-text-dim font-normal">/mo</span></div>
                </div>
              </div>
            </div>
            
            <div className="relative z-10 mt-12 flex items-center gap-3 text-sm text-text-dim">
              <Lock className="w-4 h-4 text-accent" />
              <span>Secured by Advanced 256-bit Encryption</span>
            </div>
          </div>

          {/* Right Side - Payment Form */}
          <div className="w-full md:w-3/5 bg-[#0f0f0f] p-8 relative">
            <button onClick={onClose} disabled={isProcessing || isSuccess} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-text-dim hover:text-white transition-colors z-20">
              <X className="w-5 h-5" />
            </button>
            
            <div className="max-w-md mx-auto mt-4">
              <h2 className="text-2xl font-bold text-white mb-8">Payment Details</h2>
              
              {isSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <div className="w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle className="w-12 h-12 text-accent" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Payment Successful!</h3>
                  <p className="text-text-dim">Your account has been upgraded. Welcome to {planName}.</p>
                </motion.div>
              ) : (
                <form onSubmit={handlePay} className="space-y-6">
                  <div className="bg-bg-surface border border-border-subtle p-6 rounded-xl flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white uppercase tracking-widest text-sm">WhatsApp Manual Payment</h3>
                      <p className="text-text-dim text-xs mt-1">You will be redirected to WhatsApp to contact our team and complete your subscription manually.</p>
                    </div>
                  </div>

                  {error && (
                    <div className="text-error text-sm bg-error/10 border border-error/20 p-3 rounded-xl flex items-center gap-2 mb-6">
                      <Shield className="w-4 h-4 shrink-0" /> {error}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isProcessing}
                    className="w-full h-14 bg-green-500 hover:bg-green-400 text-black font-bold uppercase tracking-widest rounded-xl transition-all hover:scale-[1.02] flex items-center justify-center mt-8 relative overflow-hidden group disabled:opacity-70 disabled:hover:scale-100"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <span className="relative z-10 flex items-center gap-2">
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" /> Redirecting to WhatsApp...
                        </>
                      ) : (
                        `Pay ${price} via WhatsApp`
                      )}
                    </span>
                  </button>
                  <p className="text-center text-[10px] text-text-dim mt-4 uppercase tracking-widest">Instant Activation via Support</p>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Gift, Copy, Check, Users, Share2, MessageCircle, Trophy, Sparkles, Loader2, Star } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';

const REFERRAL_GOAL = 5;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'JOE-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function ReferralSystem() {
  const { lang, t, dir } = useLanguage();
  const [referralCode, setReferralCode] = useState('');
  const [referralCount, setReferralCount] = useState(0);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [referredUsers, setReferredUsers] = useState<{ email: string; date: string }[]>([]);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;

    try {
      // Get or create referral code
      const refDoc = await getDoc(doc(db, 'referrals', uid));
      if (refDoc.exists()) {
        const data = refDoc.data();
        setReferralCode(data.code);
        setReferralCount(data.referralCount || 0);
        setRewardClaimed(data.rewardClaimed || false);
      } else {
        const code = generateCode();
        await setDoc(doc(db, 'referrals', uid), {
          code,
          userId: uid,
          email: auth.currentUser.email,
          referralCount: 0,
          rewardClaimed: false,
          createdAt: new Date().toISOString(),
        });
        setReferralCode(code);
      }

      // Get referred users
      const signupsQuery = query(collection(db, 'referralSignups'), where('referrerUid', '==', uid));
      const signupsSnap = await getDocs(signupsQuery);
      const users = signupsSnap.docs.map(d => ({
        email: d.data().email || t('referral_default_email'),
        date: d.data().createdAt || '',
      }));
      setReferredUsers(users);
      setReferralCount(users.length);
    } catch (err) {
      console.error('Error loading referral data:', err);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    const text = t('referral_wa_msg') + `${referralCode}\n\nhttps://joescan.me`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = t('referral_wa_msg') + `${referralCode}\n\nhttps://joescan.me`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleClaimReward = async () => {
    if (!auth.currentUser || referralCount < REFERRAL_GOAL || rewardClaimed) return;
    try {
      // Update user tier to pro with 30 days
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        tier: 'pro',
        tierExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        upgradedVia: 'referral_reward',
      });
      // Mark reward as claimed
      await updateDoc(doc(db, 'referrals', auth.currentUser.uid), {
        rewardClaimed: true,
        rewardClaimedAt: new Date().toISOString(),
      });
      setRewardClaimed(true);
    } catch (err) {
      console.error('Error claiming reward:', err);
    }
  };

  const progress = Math.min((referralCount / REFERRAL_GOAL) * 100, 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center">
          <Gift className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase tracking-widest text-text-main">{t('referral_title')}</h1>
          <p className="text-xs text-text-dim font-mono">{t('referral_subtitle')}</p>
        </div>
      </div>

      {/* Hero Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-accent/10 via-bg-surface to-purple-500/10 border border-accent/20 rounded-2xl p-6 overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-40 h-40 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl" />
        
        <div className="relative z-10 text-center space-y-4">
          <div className="w-16 h-16 bg-accent/20 border-2 border-accent/30 rounded-full flex items-center justify-center mx-auto">
            <Trophy className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-lg font-bold text-text-main">{t('referral_hero_title')}</h2>
          <p className="text-sm text-text-dim max-w-md mx-auto">
            {t('referral_hero_desc')}
          </p>
        </div>
      </motion.div>

      {/* Referral Code */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5 space-y-4">
        <p className="text-xs font-mono uppercase tracking-widest text-text-dim">{t('referral_code_label')}</p>
        <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex-1 w-full sm:w-auto bg-bg-base border-2 border-dashed border-accent/40 rounded-xl px-5 py-4 text-center">
            <span className="text-2xl font-black tracking-[0.3em] text-accent font-mono">{referralCode}</span>
          </div>
          <button
            onClick={handleCopy}
            className={`p-4 rounded-xl border transition-all ${
              copied 
                ? 'bg-accent/20 border-accent/30 text-accent' 
                : 'bg-bg-surface border-border-subtle text-text-dim hover:text-accent hover:border-accent/30'
            }`}
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        {/* Share Buttons */}
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 w-full sm:w-auto flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold rounded-xl transition-all hover:scale-[1.02] text-sm"
          >
            <MessageCircle className="w-4 h-4" />
            {t('share_whatsapp')}
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 w-full sm:w-auto flex items-center justify-center gap-2 py-3 bg-bg-elevated border border-border-subtle text-text-main font-bold rounded-xl transition-all hover:border-accent/30 text-sm"
          >
            <Share2 className="w-4 h-4" />
            {t('copy_link')}
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono uppercase tracking-widest text-text-dim">{t('your_progress')}</p>
          <span className="text-sm font-bold text-accent">{referralCount}/{REFERRAL_GOAL}</span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-4 bg-bg-base rounded-full overflow-hidden border border-border-subtle">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${dir === 'rtl' ? 'from-green-400 to-accent' : 'from-accent to-green-400'} rounded-full relative`}
          >
            {progress > 10 && (
              <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
            )}
          </motion.div>
        </div>

        {/* Steps */}
        <div className="flex justify-between flex-wrap sm:flex-nowrap gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex flex-col items-center gap-1.5 w-1/5 sm:w-auto">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                i <= referralCount
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'bg-bg-base border-border-subtle text-text-dim'
              }`}>
                {i <= referralCount ? <Check className="w-4 h-4" /> : i}
              </div>
              <span className="text-[9px] sm:text-xs font-mono text-text-dim whitespace-nowrap">{t('friend_count')} {i}</span>
            </div>
          ))}
        </div>

        {/* Claim Reward */}
        {referralCount >= REFERRAL_GOAL && !rewardClaimed && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleClaimReward}
            className="w-full py-4 bg-gradient-to-r from-accent to-green-400 text-accent-fg font-black uppercase tracking-widest rounded-xl text-sm hover:scale-[1.02] transition-transform flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            {t('claim_reward')}
          </motion.button>
        )}

        {rewardClaimed && (
          <div className="text-center py-3 bg-accent/10 border border-accent/30 rounded-xl">
            <p className="text-accent font-bold text-sm flex items-center justify-center gap-2">
              <Star className="w-4 h-4" fill="currentColor" />
              {t('reward_claimed_msg')}
            </p>
          </div>
        )}
      </div>

      {/* Referred Users */}
      {referredUsers.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-2xl p-5 space-y-3">
          <p className="text-xs font-mono uppercase tracking-widest text-text-dim flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t('referred_friends')} ({referredUsers.length})
          </p>
          <div className="space-y-2">
            {referredUsers.map((user, i) => (
              <div key={i} className="flex items-center gap-3 bg-bg-base border border-border-subtle rounded-xl p-3 flex-wrap sm:flex-nowrap">
                <div className="w-8 h-8 bg-accent/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-accent font-bold text-xs">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-main font-mono truncate">
                    {user.email.replace(/(.{3}).+(@.+)/, '$1***$2')}
                  </p>
                  <p className="text-[10px] sm:text-xs text-text-dim">
                    {user.date ? new Date(user.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : ''}
                  </p>
                </div>
                <Check className="w-4 h-4 text-accent shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

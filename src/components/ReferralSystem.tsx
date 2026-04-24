import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Copy, Check, Users, Share2, MessageCircle, Trophy, Sparkles, Loader2, Star, Edit2, Shield, Gem, Crown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, orderBy, limit } from 'firebase/firestore';
import confetti from 'canvas-confetti';

const TIERS = [
  { count: 1, icon: Shield, nameKey: 'referral_tier_1' },
  { count: 3, icon: Sparkles, nameKey: 'referral_tier_3' },
  { count: 5, icon: Gem, nameKey: 'referral_tier_5' },
  { count: 10, icon: Crown, nameKey: 'referral_tier_10' }
];

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
  const [claimedTiers, setClaimedTiers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [referredUsers, setReferredUsers] = useState<{ email: string; date: string }[]>([]);
  
  // Custom Code State
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [codeError, setCodeError] = useState('');
  
  // Leaderboard State
  const [leaders, setLeaders] = useState<{email: string, count: number}[]>([]);

  useEffect(() => {
    loadReferralData();
    loadLeaderboard();
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
        // Migrate old rewardClaimed to claimedTiers array
        if (data.claimedTiers) {
          setClaimedTiers(data.claimedTiers);
        } else if (data.rewardClaimed) {
          setClaimedTiers([5]);
        }
      } else {
        const code = generateCode();
        await setDoc(doc(db, 'referrals', uid), {
          code,
          userId: uid,
          email: auth.currentUser.email,
          referralCount: 0,
          claimedTiers: [],
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
  
  const loadLeaderboard = async () => {
    try {
      const q = query(collection(db, 'referrals'), orderBy('referralCount', 'desc'), limit(5));
      const snap = await getDocs(q);
      const topUsers = snap.docs
        .map(d => ({
          email: d.data().email || 'Anonymous',
          count: d.data().referralCount || 0
        }))
        .filter(u => u.count > 0);
      setLeaders(topUsers);
    } catch(err) {
      console.error('Error loading leaderboard:', err);
    }
  }

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

  const fireConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#8b5cf6', '#a855f7', '#ffffff']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#8b5cf6', '#a855f7', '#ffffff']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const handleClaimTier = async (tier: number) => {
    if (!auth.currentUser || referralCount < tier || claimedTiers.includes(tier)) return;
    try {
      let daysToAdd = 0;
      let tierName = 'pro';
      
      if (tier === 3) daysToAdd = 7;
      if (tier === 5) daysToAdd = 30;
      if (tier === 10) { daysToAdd = 3650; tierName = 'vip'; } // 10 years for VIP
      
      const newClaimed = [...claimedTiers, tier];
      
      // Update User Level
      if (daysToAdd > 0) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userRef, {
          tier: tierName,
          tierExpiry: new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString(),
          upgradedVia: `referral_reward_tier_${tier}`,
        });
      }

      // Mark reward as claimed
      await updateDoc(doc(db, 'referrals', auth.currentUser.uid), {
        claimedTiers: newClaimed,
      });
      
      setClaimedTiers(newClaimed);
      fireConfetti();
    } catch (err) {
      console.error('Error claiming reward:', err);
    }
  };

  const handleSaveCustomCode = async () => {
    if (!customCodeInput || customCodeInput.length < 3 || customCodeInput.length > 15) {
      setCodeError(t('referral_code_hint'));
      return;
    }
    const cleanCode = customCodeInput.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    try {
      const q = query(collection(db, 'referrals'), where('code', '==', cleanCode));
      const snap = await getDocs(q);
      
      if (!snap.empty && snap.docs[0].id !== auth.currentUser?.uid) {
        setCodeError(t('referral_code_taken'));
        return;
      }
      
      await updateDoc(doc(db, 'referrals', auth.currentUser!.uid), {
        code: cleanCode
      });
      
      setReferralCode(cleanCode);
      setIsEditingCode(false);
      setCodeError('');
    } catch (err) {
      setCodeError('Error saving code.');
      console.error(err);
    }
  }

  const progress = Math.min((referralCount / 10) * 100, 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6" dir={dir}>
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
        className="relative bg-gradient-to-br from-accent/20 via-bg-surface to-purple-500/20 border-2 border-accent/40 rounded-3xl p-8 overflow-hidden shadow-2xl shadow-accent/10"
      >
        <div className="absolute top-0 left-0 w-40 h-40 bg-accent/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        
        <div className="relative z-10 text-center space-y-4">
          <div className="w-20 h-20 bg-accent/20 border-2 border-accent/40 rounded-2xl rotate-3 flex items-center justify-center mx-auto shadow-lg shadow-accent/20 backdrop-blur-md">
            <Trophy className="w-10 h-10 text-accent -rotate-3" />
          </div>
          <h2 className="text-2xl font-black text-text-main tracking-tight">{t('referral_hero_title')}</h2>
          <p className="text-sm text-text-muted max-w-lg mx-auto">
            {t('referral_hero_desc')}
          </p>
        </div>
      </motion.div>

      {/* Referral Code System */}
      <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 space-y-6 shadow-xl shadow-black/20 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono uppercase tracking-widest text-text-dim">{t('referral_code_label')}</p>
          <button 
            onClick={() => {
              setIsEditingCode(!isEditingCode);
              setCustomCodeInput(referralCode);
              setCodeError('');
            }}
            className="flex items-center gap-2 text-xs font-bold text-accent hover:text-accent-bright"
          >
            <Edit2 className="w-3 h-3" />
            {t('referral_custom_code')}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {isEditingCode ? (
            <motion.div 
              key="edit"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={customCodeInput}
                  onChange={(e) => setCustomCodeInput(e.target.value.toUpperCase())}
                  maxLength={15}
                  className="flex-1 bg-bg-base border-2 border-accent/40 rounded-xl px-5 py-4 text-center text-xl font-bold tracking-widest text-text-main focus:outline-none focus:border-accent"
                  placeholder="JOE-HACKER"
                />
                <button 
                  onClick={handleSaveCustomCode}
                  className="bg-accent text-accent-fg font-bold px-6 rounded-xl hover:bg-accent-active transition-colors"
                >
                  {t('referral_code_save')}
                </button>
              </div>
              <p className={`text-xs ${codeError ? 'text-red-400' : 'text-text-dim'} text-center`}>
                {codeError || t('referral_code_hint')}
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key="view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center gap-3 flex-wrap sm:flex-nowrap"
            >
              <div className="flex-1 w-full sm:w-auto bg-bg-base border-2 border-dashed border-accent/40 rounded-xl px-5 py-4 text-center group hover:border-accent transition-colors relative overflow-hidden">
                <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-2xl font-black tracking-[0.3em] text-accent font-mono relative z-10">{referralCode}</span>
              </div>
              <button
                onClick={handleCopy}
                className={`p-4 rounded-xl border-2 transition-all ${
                  copied 
                    ? 'bg-accent/20 border-accent/50 text-accent scale-105' 
                    : 'bg-bg-surface border-border-subtle text-text-dim hover:text-accent hover:border-accent/40'
                }`}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share Buttons */}
        <div className="flex gap-3 flex-wrap sm:flex-nowrap pt-2">
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 w-full sm:w-auto flex items-center justify-center gap-2 py-4 bg-[#25D366] hover:bg-[#20BD5A] text-white font-bold rounded-xl transition-all hover:scale-[1.02] text-sm shadow-lg shadow-[#25D366]/20"
          >
            <MessageCircle className="w-5 h-5" />
            {t('share_whatsapp')}
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 w-full sm:w-auto flex items-center justify-center gap-2 py-4 bg-bg-elevated border border-border-subtle text-text-main font-bold rounded-xl transition-all hover:border-accent/30 text-sm"
          >
            <Share2 className="w-5 h-5" />
            {t('copy_link')}
          </button>
        </div>
      </div>

      {/* Tiered Progress System */}
      <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 space-y-6 shadow-xl shadow-black/20">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono uppercase tracking-widest text-text-dim">{t('your_progress')}</p>
          <span className="text-sm font-bold text-accent px-3 py-1 bg-accent/10 rounded-lg">{referralCount} {t('friend_count')}s</span>
        </div>

        {/* Progress Bar */}
        <div className="relative h-6 bg-bg-base rounded-full overflow-hidden border-2 border-bg-elevated shadow-inner">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className={`h-full bg-gradient-to-r ${dir === 'rtl' ? 'from-green-500 to-accent' : 'from-accent to-green-500'} rounded-full relative shadow-[0_0_15px_rgba(139,92,246,0.5)]`}
          >
            <div className="absolute inset-0 bg-white/20 animate-[pulse_2s_ease-in-out_infinite] rounded-full" />
            <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden rounded-full">
              <div className="w-[200%] h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%,transparent_100%)] bg-[length:20px_20px] animate-[shimmer_1s_linear_infinite]" />
            </div>
          </motion.div>
        </div>

        {/* Tiers List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((tier) => {
            const isUnlocked = referralCount >= tier.count;
            const isClaimed = claimedTiers.includes(tier.count);
            const canClaim = isUnlocked && !isClaimed;
            
            return (
              <div 
                key={tier.count} 
                className={`flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all ${
                  isClaimed ? 'bg-accent/10 border-accent/40' : 
                  canClaim ? 'bg-bg-surface border-accent shadow-[0_0_20px_rgba(139,92,246,0.3)] scale-105' : 
                  'bg-bg-base border-border-subtle opacity-60'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                  isClaimed || canClaim ? 'bg-accent/20 text-accent' : 'bg-bg-elevated text-text-dim'
                }`}>
                  <tier.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-sm text-text-main mb-1">
                  {tier.count} {t('friend_count')}
                </h3>
                <p className="text-xs text-text-dim mb-4 h-8 max-w-[120px]">
                  {/* We are casting here because dynamic key lookup requires it, or just use string index */}
                  {t(tier.nameKey as any)}
                </p>
                
                {isClaimed ? (
                  <span className="text-xs font-bold text-accent flex items-center gap-1 bg-accent/10 px-3 py-1.5 rounded-full">
                    <Check className="w-3 h-3" /> {t('reward_claimed_msg').split('!')[0]}
                  </span>
                ) : canClaim ? (
                  <button 
                    onClick={() => handleClaimTier(tier.count)}
                    className="text-xs font-bold bg-accent text-accent-fg w-full py-2 rounded-xl hover:bg-accent-active shadow-lg shadow-accent/20 transition-all hover:scale-105"
                  >
                    {t('claim_reward')}
                  </button>
                ) : (
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-widest border border-border-subtle px-2 py-1 rounded-md">
                    {t('referral_tier_0').replace('1', tier.count.toString())}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 space-y-4 shadow-xl shadow-black/20">
          <p className="text-xs font-mono uppercase tracking-widest text-accent flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            {t('referral_top_inviters')}
          </p>
          <div className="space-y-3">
            {leaders.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-border-subtle rounded-2xl">
                <p className="text-sm text-text-dim">{t('referral_no_leaders')}</p>
              </div>
            ) : (
              leaders.map((leader, i) => (
                <div key={i} className="flex items-center justify-between bg-bg-base border border-border-subtle rounded-2xl p-3 px-4">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                      i === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                      i === 1 ? 'bg-gray-400/20 text-gray-400' :
                      i === 2 ? 'bg-amber-700/20 text-amber-700' :
                      'bg-bg-elevated text-text-dim'
                    }`}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-mono text-text-main truncate max-w-[120px]">
                      {leader.email.split('@')[0]}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-md">
                    {leader.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Referred Users List */}
        <div className="bg-bg-surface border border-border-subtle rounded-3xl p-6 space-y-4 shadow-xl shadow-black/20">
          <p className="text-xs font-mono uppercase tracking-widest text-text-dim flex items-center gap-2">
            <Users className="w-4 h-4" />
            {t('referred_friends')} ({referredUsers.length})
          </p>
          {referredUsers.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-border-subtle rounded-2xl">
              <p className="text-sm text-text-dim">Invite someone to see them here.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
              {referredUsers.map((user, i) => (
                <div key={i} className="flex items-center justify-between bg-bg-base border border-border-subtle rounded-2xl p-3 px-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-main font-mono truncate">
                      {user.email.replace(/(.{3}).+(@.+)/, '$1***$2')}
                    </p>
                    <p className="text-[10px] sm:text-xs text-text-dim">
                      {user.date ? new Date(user.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US') : ''}
                    </p>
                  </div>
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

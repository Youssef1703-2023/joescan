import '../styles/focus-referral.css';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Copy, Check, Users, Share2, MessageCircle, Trophy, Sparkles, Loader2, Star, Edit2, Shield, Gem, Crown, Clock } from 'lucide-react';
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
  const [pendingRewardTier, setPendingRewardTier] = useState<number | null>(null);
  const [claimLoading, setClaimLoading] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error,setError]=useState('');
  const [loadError,setLoadError]=useState(false);
  const [loadDetail,setLoadDetail]=useState('');
  const [rewardsError,setRewardsError]=useState(false);
  const [friendsError,setFriendsError]=useState(false);
  const [leadersError,setLeadersError]=useState(false);
  const [saving,setSaving]=useState(false);
  const isAr=lang==='ar';
  const label=(en:string,ar:string)=>isAr?ar:en;
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
    if (!auth.currentUser) {setLoading(false);setLoadError(true);return;}
    setLoading(true);setLoadError(false);
    const uid = auth.currentUser.uid;

    let stage='invite-read';
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
        stage='invite-create';
        await setDoc(doc(db, 'referrals', uid), {
          code,
          userId: uid,
          referralCount: 0,
          claimedTiers: [],
          createdAt: new Date().toISOString(),
        });
        setReferralCode(code);
      }

    } catch (err) {
      setLoadError(true);
      setLoadDetail(stage + ': ' + ((err as {code?:string}).code || 'unknown'));
      console.error('Referral code unavailable:',err);
      setLoading(false);
      return;
    }
    // Optional panels must not hide a successfully loaded invitation.
    setRewardsError(false);setFriendsError(false);
    await Promise.all([
      (async()=>{try {
        const requests=await getDocs(query(collection(db,'tierRequests'),where('userId','==',uid)));
        const pending=requests.docs.map(d=>d.data()).find(d=>d.kind==='referral_reward'&&d.status==='pending');
        setPendingRewardTier(pending?.rewardTier??null);
      } catch(err) {setRewardsError(true);console.error('Referral rewards unavailable:',err);}})(),
      (async()=>{try {
        const signups=await getDocs(query(collection(db,'referralSignups'),where('referrerUid','==',uid)));
        setReferredUsers(signups.docs.map(d=>({email:d.data().email||t('referral_default_email'),date:d.data().createdAt||''})));
      } catch(err) {setFriendsError(true);console.error('Referral friends unavailable:',err);}})()
    ]);
    setLoading(false);
  };

  const loadLeaderboard = async () => {
    try {
      const q = query(collection(db, 'referrals'), orderBy('referralCount', 'desc'), limit(5));
      const snap = await getDocs(q);
      const topUsers = snap.docs
        .map(d => ({
          email: d.data().email || (d.data().code ? `Operative (${d.data().code})` : 'Anonymous'),
          count: d.data().referralCount || 0
        }))
        .filter(u => u.count > 0);
      setLeaders(topUsers);
    } catch(err) {
      setLeadersError(true);
      console.error('Error loading leaderboard:', err);
    }
  }

  const handleCopy = async () => {
    setError('');
    try {await navigator.clipboard.writeText(referralCode);setCopied(true);setTimeout(()=>setCopied(false),2000);}
    catch {setError(label('Could not copy. Select and copy the code manually.','تعذر النسخ. حدد الكود وانسخه يدوياً.'));}
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
    if (!auth.currentUser || referralCount < tier || claimedTiers.includes(tier) || pendingRewardTier !== null || claimLoading !== null || rewardsError) return;
    setClaimLoading(tier);
    try {
      await setDoc(doc(db, 'tierRequests', `${auth.currentUser.uid}_referral_reward`), {
        userId: auth.currentUser.uid,
        kind: 'referral_reward',
        status: 'pending',
        rewardTier: tier,
        createdAt: new Date().toISOString(),
      });

      setPendingRewardTier(tier);
    } catch (err) {
      console.error('Error requesting reward claim:', err);
      setError(label('Could not request this reward. Please try again.','تعذر طلب المكافأة. حاول مرة أخرى.'));
    } finally {
      setClaimLoading(null);
    }
  };

  const handleSaveCustomCode = async () => {
    if (!/^[A-Z0-9]{3,15}$/i.test(customCodeInput)) {
      setCodeError(t('referral_code_hint'));
      return;
    }
    if (!auth.currentUser || saving) return;
    setSaving(true);
    const cleanCode = customCodeInput.toUpperCase();
    
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
    } finally {setSaving(false);}
  }

  const nextTier=TIERS.find(tier=>tier.count>referralCount);
  const progress=Math.min(100,Math.max(0,referralCount/10*100));
  if(loading) return <div className="focus-referral fr-loading" role="status"><Loader2 className="animate-spin"/>{label('Loading your invitations…','جاري تحميل الدعوات…')}</div>;
  if(loadError) return <div className="focus-referral fr-panel" role="alert"><h2>{label('Your invitations are unavailable','تعذر تحميل الدعوات')}</h2><code className="fr-error-code">{loadDetail}</code><p>{label('Please retry to load your code and rewards.','حاول مرة أخرى لتحميل الكود والمكافآت.')}</p><button className="fr-primary" onClick={loadReferralData}>{label('Try again','حاول مرة أخرى')}</button></div>;
  return <div className="focus-referral" dir={dir}>
    <header className="fr-heading"><span className="fr-kicker">JOESCAN / {label('INVITE & EARN','ادعُ واكسب')}</span><span className="fr-program"><Gift size={15}/>{label('Friends make it better','مع أصحابك أحلى')}</span></header>
    <section className="fr-hero">
      <div className="fr-intro"><h1>{label('Good security.','أمان أفضل.')}<br/><em>{label('Better together.','مع بعض.')}</em></h1><p>{label('Invite your friends to JoeScan. Turn shared knowledge into useful rewards — one invitation at a time.','ادعُ أصحابك إلى JoeScan. شاركهم المعرفة واستفد من مكافآت برنامج الدعوات.')}</p><div className="fr-how"><span>01 · {label('Share your code','شارك الكود')}</span><span>02 · {label('Friends sign up','أصحابك يسجلوا')}</span><span>03 · {label('Request a reward','اطلب المكافأة')}</span></div></div>
      <div className="fr-invite fr-panel"><div className="fr-invite-top"><div className="fr-gift"><Gift size={26}/></div><span className="fr-kicker">{label('YOUR PERSONAL INVITATION','دعوتك الشخصية')}</span></div><h2>{label('Pass it on.','شاركها مع أصحابك.')}</h2><p>{label('Ask friends to enter this code when they create their account.','اطلب من أصحابك إدخال الكود عند إنشاء حسابهم.')}</p>
        {isEditingCode ? <form onSubmit={e=>{e.preventDefault();handleSaveCustomCode()}} className="fr-edit"><label htmlFor="ref-code">{t('referral_code_label')}</label><input id="ref-code" dir="ltr" autoComplete="off" value={customCodeInput} maxLength={15} onChange={e=>setCustomCodeInput(e.target.value.toUpperCase())}/><p role={codeError?'alert':undefined}>{codeError||t('referral_code_hint')}</p><div className="fr-actions"><button className="fr-primary" disabled={saving}>{saving?label('Saving…','جاري الحفظ…'):t('referral_code_save')}</button><button type="button" disabled={saving} onClick={()=>setIsEditingCode(false)}>{label('Cancel','إلغاء')}</button></div></form> : <><div className="fr-code"><span dir="ltr">{referralCode}</span><button aria-label={label('Customize invitation code','تعديل كود الدعوة')} onClick={()=>{setIsEditingCode(true);setCustomCodeInput(referralCode.replace(/[^A-Z0-9]/g,''));setCodeError('')}}><Edit2 size={17}/></button></div><div className="fr-actions"><button className="fr-primary" onClick={handleCopy}>{copied?<Check size={17}/>:<Copy size={17}/>}<span aria-live="polite">{copied?label('Copied','تم النسخ'):label('Copy invite code','نسخ كود الدعوة')}</span></button><button className="fr-secondary" onClick={handleShareWhatsApp}><MessageCircle size={17}/>WhatsApp</button></div></>}
        <div className="fr-invite-note"><Shield size={14}/>{label('Share with people you know. No spam.','شارك مع الناس اللي تعرفهم.')}</div>
      </div>
    </section>
    {error&&<p className="fr-error" role="alert">{error}</p>}
    <section className="fr-stats"><div><Users/><span>{label('Friends referred','إحالاتك')}</span><strong>{referralCount}</strong></div><div><Gift/><span>{label('Rewards claimed','مكافآت مستلمة')}</span><strong>{claimedTiers.length}</strong></div><div><Clock/><span>{label('Awaiting review','قيد المراجعة')}</span><strong>{rewardsError?'—':pendingRewardTier===null?'0':'1'}</strong></div></section>
    <section className="fr-rewards fr-panel"><div className="fr-section-head"><div><span className="fr-kicker">{label('YOUR REWARD PATH','طريق المكافآت')}</span><h2>{label('A little sharing. A little more back.','كل دعوة تقرّبك من مكافأة.')}</h2></div><p>{nextTier?label((nextTier.count-referralCount)+' more to your next milestone','باقي '+(nextTier.count-referralCount)+' للمرحلة القادمة'):label('All milestones reached','وصلت لكل المراحل')}</p></div><div className="fr-progress" role="progressbar" aria-label={label('Referral milestones','مراحل الإحالات')} aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(10,referralCount)}><span style={{width:progress+'%'}}/></div>
      <div className="fr-tier-grid">{TIERS.map(tier=>{const claimed=claimedTiers.includes(tier.count),pending=pendingRewardTier===tier.count,unlocked=referralCount>=tier.count;return <article key={tier.count} className="fr-tier" data-unlocked={unlocked}><div className="fr-tier-top"><tier.icon size={24}/><span>{String(tier.count).padStart(2,'0')}</span></div><p>{tier.count} {label(tier.count===1?'friend':'friends','إحالات')}</p><h3>{t(tier.nameKey as any)}</h3>{claimed?<span className="fr-status"><Check size={14}/>{label('Claimed','تم الاستلام')}</span>:pending?<span className="fr-status fr-pending"><Clock size={14}/>{label('Under review','قيد المراجعة')}</span>:unlocked?<button className="fr-claim" disabled={rewardsError||pendingRewardTier!==null||claimLoading!==null} onClick={()=>handleClaimTier(tier.count)}>{claimLoading===tier.count?label('Sending…','جاري الإرسال…'):t('claim_reward')}</button>:<span className="fr-locked">{label('Unlock at '+tier.count+' referrals','تفتح عند '+tier.count+' إحالات')}</span>}</article>})}</div>{rewardsError&&<p role="status" className="fr-error">{label('Reward status could not load. Claims are paused until retry.','تعذر تحميل حالة المكافآت. أعد المحاولة قبل طلب مكافأة.')} <button onClick={loadReferralData}>{label('Retry','إعادة المحاولة')}</button></p>}<p className="fr-review-note">{label('Rewards are reviewed after you request them. Only one reward request can be pending at a time.','المكافآت تخضع للمراجعة بعد طلبها. يمكن وجود طلب واحد قيد المراجعة في نفس الوقت.')}</p>
    </section>
    <div className="fr-bottom"><section className="fr-panel"><div className="fr-section-head"><h2>{t('referred_friends')}</h2><span className="fr-count">{referredUsers.length}</span></div>{friendsError?<p role="status" className="fr-empty">{label('Invited friends could not load.','تعذر تحميل قائمة المدعوين.')} <button onClick={loadReferralData}>{label('Retry','إعادة المحاولة')}</button></p>:!referredUsers.length?<div className="fr-empty"><Users size={30}/><h3>{label('Your circle starts here.','دايرتك تبدأ هنا.')}</h3><p>{label('Share your code. Friends who use it will appear here.','شارك الكود. أصحابك اللي يستخدموه هيظهروا هنا.')}</p></div>:<div className="fr-people">{referredUsers.map((user,i)=><div className="fr-person" key={i}><span className="fr-avatar"><Users size={16}/></span><div><strong>{user.email.replace(/(.{3}).+(@.+)/,'$1***$2')}</strong><small>{user.date?new Date(user.date).toLocaleDateString(isAr?'ar-EG':'en-US'):'—'}</small></div><Check size={16}/></div>)}</div>}</section>
      <section className="fr-panel"><div className="fr-section-head"><h2>{t('referral_top_inviters')}</h2><Trophy size={20}/></div>{leadersError?<p className="fr-empty">{label('Leaderboard is unavailable right now.','الترتيب غير متاح حالياً.')}</p>:!leaders.length?<div className="fr-empty"><Trophy size={30}/><h3>{label('Room at the top.','مكانك في المقدمة.')}</h3><p>{t('referral_no_leaders')}</p></div>:<div className="fr-people">{leaders.map((leader,i)=><div className="fr-person" key={i}><span className="fr-rank">{String(i+1).padStart(2,'0')}</span><strong>{leader.email.split('@')[0]}</strong><b>{leader.count}</b></div>)}</div>}</section></div>
  </div>;
}

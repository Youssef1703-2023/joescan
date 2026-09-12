import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Check, ChevronDown, CircleHelp, Layers3, Loader2, Network, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import { auth, getUserTier, type SubscriptionTier } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import CheckoutModal from './CheckoutModal';
import '../styles/focus-membership.css';

type PaidTier = 'pro' | 'enterprise';
// Existing monthly prices. EGP amounts are product prices, not a live FX quote.
const planPrices = { free: { USD: 0, EGP: 0 }, pro: { USD: 6, EGP: 300 }, enterprise: { USD: 30, EGP: 1500 } };
const previousPrices = { pro: { USD: 12, EGP: 600 }, enterprise: { USD: 60, EGP: 3000 } };

export default function Pricing() {
  const { lang, dir, t } = useLanguage();
  const copy = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const reduced = useReducedMotion();
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [tierError, setTierError] = useState(false);
  const [currency, setCurrency] = useState<'USD' | 'EGP'>('USD');
  const [selectedTier, setSelectedTier] = useState<PaidTier | null>(null);
  const [requestReceived, setRequestReceived] = useState(false);

  useEffect(() => {
    let active = true;
    const user = auth.currentUser;
    if (!user) { setTierError(true); return; }
    getUserTier(user.uid).then(tier => {
      if (active) setCurrentTier(tier);
    }).catch(() => { if (active) setTierError(true); });
    return () => { active = false; };
  }, []);

  const formatPrice = (amount: number) => currency === 'USD' ? `$${amount}` : `${amount.toLocaleString('en-US')} ${lang === 'ar' ? 'ج.م' : 'EGP'}`;
  const planName = (id: SubscriptionTier) => t(id === 'free' ? 'pricing_stealth' : id === 'pro' ? 'pricing_pro' : 'pricing_enterprise');
  const plans = [
    { id: 'free' as const, icon: Shield, note: copy('THE ESSENTIALS', 'الأساسيات'), description: copy('A starting point for your everyday security checks.', 'بداية لفحوصات الأمان اليومية.'), features: [copy('10 AI analyses per day', '10 تحليلات بالذكاء الاصطناعي يوميًا'), copy('1 watchlist target', 'هدف واحد في قائمة المراقبة'), copy('Core security checks', 'فحوصات الأمان الأساسية'), copy('Standard PDF reports', 'تقارير PDF قياسية')] },
    { id: 'pro' as const, icon: Layers3, note: copy('ROOM TO EXPLORE', 'مساحة أكبر للفحص'), description: copy('More capacity for a closer look at your digital exposure.', 'سعة أكبر لفهم مدى تعرض بياناتك للمخاطر.'), features: [copy('150 AI analyses per day', '150 تحليلًا بالذكاء الاصطناعي يوميًا'), copy('50 watchlist targets', '50 هدفًا في قائمة المراقبة'), copy('Core security checks', 'فحوصات الأمان الأساسية'), copy('PDF report exports', 'تصدير التقارير بصيغة PDF')] },
    { id: 'enterprise' as const, icon: Network, note: copy('A SHARED WORKSPACE', 'مساحة عمل مشتركة'), description: copy('Higher limits and a workspace for your security team.', 'حدود استخدام أعلى ومساحة عمل لفريقك.'), features: [copy('2,000 AI analyses per day', '2,000 تحليل بالذكاء الاصطناعي يوميًا'), copy('200 watchlist targets', '200 هدف في قائمة المراقبة'), copy('Team management · 5 members', 'إدارة الفريق · 5 أعضاء'), copy('PDF report exports', 'تصدير التقارير بصيغة PDF')] },
  ];
  const choose = (tier: PaidTier) => { setRequestReceived(false); setSelectedTier(tier); };
  const faq = [
    [copy('How does activation work?', 'إزاي الاشتراك بيتفعل؟'), copy('Choose a plan and submit a subscription request. Continue on WhatsApp to confirm payment instructions with the team. Your plan changes after verification.', 'اختار الباقة وقدّم طلب اشتراك، ثم تابع عبر WhatsApp لتأكيد تفاصيل الدفع مع الفريق. الباقة بتتغير بعد التحقق.')],
    [copy('Where do I use a promo code?', 'أستخدم كود الخصم فين؟'), copy('Add your code in the checkout window before submitting. You can review the adjusted amount first. Applying a code alone does not submit a request.', 'أضف الكود في نافذة الاشتراك قبل تقديم الطلب. هتشوف المبلغ بعد الخصم أولًا، وتطبيق الكود وحده مش بيقدم الطلب.')],
    [copy('What do the usage limits mean?', 'حدود الاستخدام معناها إيه؟'), copy('The daily allowance covers AI analyses provided by JoeScan. Watchlist limits count saved targets. Scheduled checks depend on the target type and available sources.', 'الحد اليومي يشمل تحليلات الذكاء الاصطناعي المقدمة من JoeScan. حد قائمة المراقبة هو عدد الأهداف المحفوظة، والفحص المجدول يعتمد على نوع الهدف والمصادر المتاحة.')],
  ];

  return <div className="focus-membership" dir={dir}>
    <header className="mp-header">
      <div><span className="mp-eyebrow"><span /> JOESCAN / MEMBERSHIP</span><h1>{copy('A plan for your', 'باقة تناسب')}<br /><em>{copy('next move.', 'خطوتك الجاية.')}</em></h1><p>{copy('Start with the essentials. Make room for more as your needs grow.', 'ابدأ بالأساسيات، وزوّد إمكانياتك مع احتياجاتك.')}</p></div>
      <div className="mp-current"><ShieldCheck size={18} /><div><span>{copy('YOUR WORKSPACE', 'مساحة عملك')}</span><strong>{currentTier ? planName(currentTier) : tierError ? copy('Plan unavailable', 'تعذر عرض الباقة') : copy('Checking your plan…', 'جاري مراجعة الباقة…')}</strong></div>{!currentTier && !tierError && <Loader2 size={15} className="mp-spinner" />}</div>
    </header>

    {requestReceived && !selectedTier && <div className="mp-notice" role="status"><ShieldCheck size={23} /><div><strong>{copy('Subscription request received', 'تم استلام طلب الاشتراك')}</strong><p>{copy('Your request is pending review. Your current plan stays active until verification.', 'طلبك قيد المراجعة. باقتك الحالية مستمرة حتى التحقق من الطلب.')}</p></div></div>}
    {tierError && <p className="mp-load-error" role="alert">{copy('Your current plan could not be confirmed. Refresh your session before requesting a change.', 'تعذر التأكد من باقتك الحالية. حدّث جلستك قبل طلب تغيير الباقة.')}</p>}

    <div className="mp-plan-bar"><span>{copy('MONTHLY PLANS', 'باقات شهرية')}<small>{copy('Choose what fits.', 'اختار المناسب ليك.')}</small></span><div className="mp-currency" role="group" aria-label={copy('Price currency', 'عملة الأسعار')}>{(['USD', 'EGP'] as const).map(c => <button key={c} aria-pressed={currency === c} onClick={() => setCurrency(c)}>{c === 'USD' ? '$ USD' : 'EGP'}</button>)}</div></div>
    <div className="mp-grid">{plans.map((plan, index) => {
      const active = currentTier === plan.id;
      const Icon = plan.icon;
      return <motion.article key={plan.id} className="mp-card" data-plan={plan.id} data-active={active} initial={{ opacity: 0, y: reduced ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .4, delay: reduced ? 0 : index * .08 }}>
        <div className="mp-card-top"><div className="mp-symbol" aria-hidden="true"><Icon size={25} /><i /></div><span className="mp-card-tag">{active ? copy('CURRENT PLAN', 'باقتك الحالية') : plan.id === 'pro' ? <><Sparkles size={11} />{copy('FOR INDIVIDUALS', 'للأفراد')}</> : plan.note}</span></div>
        <h2>{planName(plan.id)}</h2><p className="mp-description">{plan.description}</p>
        <div className="mp-price"><strong>{formatPrice(planPrices[plan.id][currency])}</strong><span>{copy('/ month', '/ شهر')}</span></div>
        <div className="mp-offer">{plan.id === 'free' ? <span>{copy('Your starting point. No payment needed.', 'ابدأ مجانًا بدون دفع.')}</span> : <><s>{formatPrice(previousPrices[plan.id][currency])}</s><span>{copy('50% off the standard price', 'خصم 50% من السعر الأساسي')}</span></>}</div>
        <button className="mp-select" disabled={!currentTier || active || plan.id === 'free'} onClick={() => plan.id !== 'free' && choose(plan.id)}>{active ? <><Check size={16} />{copy('Current plan', 'الباقة الحالية')}</> : plan.id === 'free' ? copy('Included with JoeScan', 'متاحة مع JoeScan') : <>{copy('Choose ', 'اختار ')}{planName(plan.id)}<ArrowUpRight size={17} /></>}</button>
        <div className="mp-features"><span>{copy('WHAT’S INCLUDED', 'المميزات المتاحة')}</span><ul>{plan.features.map(feature => <li key={feature}><Check size={15} /><span>{feature}</span></li>)}</ul></div>
        <div className="mp-card-foot"><span>0{index + 1}</span><span>{plan.note}</span></div>
      </motion.article>;
    })}</div>

    <div className="mp-process">{[
      [copy('Find your fit', 'اختار المناسب'), copy('Compare the limits and choose a plan.', 'قارن حدود الاستخدام واختار الباقة.')],
      [copy('Review your request', 'راجع طلبك'), copy('Check the amount and add a promo code.', 'راجع المبلغ وأضف كود الخصم.')],
      [copy('Continue with the team', 'تابع مع الفريق'), copy('Confirm payment and wait for activation.', 'أكد الدفع وانتظر تفعيل الاشتراك.')],
    ].map(([title, description], i) => <div key={title}><span className="mp-step">0{i + 1}</span><div><h3>{title}</h3><p>{description}</p></div></div>)}</div>

    <section className="mp-questions"><div><span className="mp-eyebrow"><CircleHelp size={14} />{copy('A LITTLE CLARITY', 'تفاصيل تفيدك')}</span><h2>{copy('Before you choose.', 'قبل ما تختار.')}</h2><p>{copy('The details, without the guesswork.', 'إجابات واضحة على أسئلتك.')}</p></div><div className="mp-faq">{faq.map(([question, answer]) => <details key={question}><summary>{question}<ChevronDown size={16} /></summary><p>{answer}</p></details>)}</div></section>
    <footer className="mp-footer"><span><Shield size={14} />{copy('Payment is arranged with the JoeScan team.', 'الدفع بيتم بالتنسيق مع فريق JoeScan.')}</span><a href="/terms.en">{copy('Terms of service', 'شروط الاستخدام')}<ArrowUpRight size={13} /></a></footer>
    <CheckoutModal isOpen={selectedTier !== null} onClose={() => setSelectedTier(null)} tier={selectedTier || 'pro'} planName={planName(selectedTier || 'pro')} price={formatPrice(planPrices[selectedTier || 'pro'][currency])} onRequestSubmitted={() => setRequestReceived(true)} />
  </div>;
}

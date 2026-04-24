import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, Mail, KeyRound, Wifi, Globe, Fingerprint, Monitor,
  Target, BookOpen, ChevronRight, ChevronLeft, X, Sparkles, Rocket
} from 'lucide-react';

interface TourStep {
  icon: React.ElementType;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  tabId: string;
  color: string;
}

const STEPS: TourStep[] = [
  {
    icon: Database,
    title: 'Command Center',
    titleAr: 'مركز القيادة',
    description: 'Your security nerve center. Monitor your global security posture score, recent scans, risk distribution, and quick access to all tools.',
    descriptionAr: 'مركز التحكم الأمني. راقب درجة أمانك العامة والفحوصات الأخيرة وتوزيع المخاطر.',
    tabId: 'dashboard',
    color: '#00ff88',
  },
  {
    icon: Mail,
    title: 'Email Breach Scanner',
    titleAr: 'فحص اختراق البريد',
    description: 'Check if your email has been exposed in data breaches. Get a detailed security report with remediation steps.',
    descriptionAr: 'تحقق من تسريب بريدك الإلكتروني في خروقات البيانات واحصل على تقرير أمني مفصل.',
    tabId: 'email',
    color: '#00d4ff',
  },
  {
    icon: KeyRound,
    title: 'Password Vault Check',
    titleAr: 'فحص كلمة المرور',
    description: 'Analyze password strength in real-time. Zero-network architecture means your password never leaves your browser.',
    descriptionAr: 'حلل قوة كلمة المرور فوراً. التحليل يتم بالكامل داخل المتصفح بدون إرسال أي بيانات.',
    tabId: 'password',
    color: '#ffbb00',
  },
  {
    icon: Wifi,
    title: 'IP & Network Scanner',
    titleAr: 'فحص الشبكة والآي بي',
    description: 'Scan any IP for geolocation, ISP info, VPN/Tor detection, open ports, and threat intelligence.',
    descriptionAr: 'افحص أي عنوان IP للموقع الجغرافي ومعلومات مزود الخدمة واكتشاف VPN/Tor.',
    tabId: 'ip',
    color: '#ff6b6b',
  },
  {
    icon: Globe,
    title: 'Domain WHOIS & DNS',
    titleAr: 'فحص النطاق والـ DNS',
    description: 'Full WHOIS lookup with DNS records, server geolocation, and exportable PDF reports.',
    descriptionAr: 'فحص WHOIS كامل مع سجلات DNS والموقع الجغرافي للخادم وتقارير PDF.',
    tabId: 'domain',
    color: '#a855f7',
  },
  {
    icon: Fingerprint,
    title: 'Browser Fingerprint',
    titleAr: 'بصمة المتصفح',
    description: 'See how unique your browser fingerprint is. Learn how websites track you without cookies.',
    descriptionAr: 'اكتشف مدى تفرد بصمة متصفحك وكيف تتبعك المواقع بدون كوكيز.',
    tabId: 'fingerprint',
    color: '#06b6d4',
  },
  {
    icon: Monitor,
    title: 'Device Security',
    titleAr: 'أمان الجهاز',
    description: 'Scan your device for open ports, CVE vulnerabilities, and network exposure via Shodan InternetDB.',
    descriptionAr: 'افحص جهازك للمنافذ المفتوحة والثغرات الأمنية والتعرض الشبكي.',
    tabId: 'device_security',
    color: '#f59e0b',
  },
  {
    icon: Target,
    title: 'Live Threat Watchlist',
    titleAr: 'قائمة مراقبة التهديدات',
    description: 'Deploy sensors on critical assets for continuous monitoring. Get alerts when threats are detected.',
    descriptionAr: 'انشر أجهزة استشعار على أصولك الحيوية للمراقبة المستمرة واحصل على تنبيهات.',
    tabId: 'watchlist',
    color: '#ec4899',
  },
];

interface Props {
  onComplete: () => void;
  onNavigate: (tabId: string) => void;
  isAr: boolean;
}

export default function OnboardingTour({ onComplete, onNavigate, isAr }: Props) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const current = STEPS[step];
  const Icon = current.icon;
  const progress = ((step + 1) / STEPS.length) * 100;

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep(s => s + 1);
    } else {
      onComplete();
    }
  }, [step, onComplete]);

  const prev = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep(s => s - 1);
    }
  }, [step]);

  const skip = () => onComplete();

  const goToTool = () => {
    onNavigate(current.tabId);
    onComplete();
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'Escape') skip();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Card */}
      <motion.div
        className="relative w-full max-w-lg rounded-3xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        style={{
          background: 'rgba(10, 10, 15, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          boxShadow: `0 0 80px ${current.color}15, 0 25px 50px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Progress Bar */}
        <div className="h-1 bg-white/5">
          <motion.div
            className="h-full rounded-full"
            style={{ background: current.color }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', damping: 20 }}
          />
        </div>

        {/* Skip */}
        <button
          onClick={skip}
          className="absolute top-5 right-5 z-10 text-white/30 hover:text-white/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="px-8 pt-10 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: direction * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -40 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center"
            >
              {/* Icon */}
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                style={{
                  background: `${current.color}12`,
                  border: `2px solid ${current.color}30`,
                  boxShadow: `0 0 30px ${current.color}15`,
                }}
              >
                <Icon className="w-9 h-9" style={{ color: current.color }} />
              </div>

              {/* Step Counter */}
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/30 mb-3">
                {step + 1} / {STEPS.length}
              </span>

              {/* Title */}
              <h2 className="text-2xl font-black tracking-tight text-white mb-3">
                {isAr ? current.titleAr : current.title}
              </h2>

              {/* Description */}
              <p className="text-sm text-white/50 leading-relaxed max-w-sm" dir={isAr ? 'rtl' : 'ltr'}>
                {isAr ? current.descriptionAr : current.description}
              </p>

              {/* Try it button */}
              <button
                onClick={goToTool}
                className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-105"
                style={{
                  background: `${current.color}15`,
                  color: current.color,
                  border: `1px solid ${current.color}30`,
                }}
              >
                <Rocket className="w-3.5 h-3.5" />
                {isAr ? 'جرّب الآن' : 'Try it now'}
              </button>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-8 pb-8">
          <button
            onClick={prev}
            disabled={step === 0}
            className="flex items-center gap-1.5 text-sm font-medium text-white/30 hover:text-white/60 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            {isAr ? 'السابق' : 'Back'}
          </button>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > step ? 1 : -1); setStep(i); }}
                className="transition-all"
              >
                <div
                  className="rounded-full transition-all"
                  style={{
                    width: i === step ? 24 : 8,
                    height: 8,
                    background: i === step ? current.color : 'rgba(255,255,255,0.1)',
                  }}
                />
              </button>
            ))}
          </div>

          <button
            onClick={next}
            className="flex items-center gap-1.5 text-sm font-bold transition-all hover:scale-105"
            style={{ color: current.color }}
          >
            {step === STEPS.length - 1
              ? (isAr ? 'ابدأ!' : "Let's go!")
              : (isAr ? 'التالي' : 'Next')
            }
            {step === STEPS.length - 1
              ? <Sparkles className="w-4 h-4" />
              : <ChevronRight className="w-4 h-4" />
            }
          </button>
        </div>
      </motion.div>
    </div>
  );
}

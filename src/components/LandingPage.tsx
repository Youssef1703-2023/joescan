import { motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Shield, Mail, KeyRound, Smartphone, Link as LinkIcon,
  UserSearch, MessageSquareWarning, Wifi, ArrowRight,
  Lock, Zap, Globe, ChevronDown, Fingerprint, Monitor
} from 'lucide-react';
import React, { useState } from 'react';
import AuthModal from './AuthModal';

interface LandingPageProps {
  onLogin: () => void;
  loading: boolean;
}

export default function LandingPage({ loading }: LandingPageProps) {
  const { t, lang } = useLanguage();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const features = [
    { icon: Mail, title: t('nav_email'), desc: t('landing_feat_email'), color: '#00ff00' },
    { icon: KeyRound, title: t('nav_password'), desc: t('landing_feat_password'), color: '#00cc88' },
    { icon: Smartphone, title: t('nav_phone'), desc: t('landing_feat_phone'), color: '#00aaff' },
    { icon: LinkIcon, title: t('nav_url'), desc: t('landing_feat_url'), color: '#ff9f0a' },
    { icon: UserSearch, title: t('nav_username'), desc: t('landing_feat_username'), color: '#a855f7' },
    { icon: MessageSquareWarning, title: t('nav_message'), desc: t('landing_feat_message'), color: '#ef4444' },
    { icon: Wifi, title: t('nav_ip'), desc: t('landing_feat_ip'), color: '#06b6d4' },
    { icon: Globe, title: lang === 'ar' ? 'فحص الدومين' : 'Domain WHOIS', desc: lang === 'ar' ? 'استعلم عن بيانات تسجيل الدومين وسجلات DNS والموقع الجغرافي للسيرفر.' : 'Query domain registration data, DNS records, and server geolocation.', color: '#8b5cf6' },
    { icon: Fingerprint, title: lang === 'ar' ? 'بصمة المتصفح' : 'Browser Fingerprint', desc: lang === 'ar' ? 'كشف البصمة المخفية لجهازك (مواصفات الهاردوير والسوفتوير) التي تستخدم في التتبع.' : 'Reveal your hidden device fingerprint (hardware/software specs) used for seamless tracking.', color: '#ec4899' },
    { icon: Monitor, title: lang === 'ar' ? 'أمان الجهاز' : 'Device Security Check', desc: lang === 'ar' ? 'فحص البورتات المفتوحة وثغرات الشبكة (Shodan) وتقييم أمان المتصفح.' : 'Thoroughly scan your network exposure, open ports, and check public CVE databases via Shodan InternetDB.', color: '#10b981' },
  ];

  const stats = [
    { value: '9+', label: t('landing_stat_tools') },
    { value: 'AES-256', label: t('landing_stat_encryption') },
    { value: 'AI', label: t('landing_stat_ai') },
    { value: '∞', label: t('landing_stat_scans') },
  ];

  return (
    <div className="min-h-screen flex flex-col relative" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Mesh Background */}
      <div className="mesh-bg" />
      <div className="grid-overlay" />

      {/* ===== HERO SECTION ===== */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-6 py-20 text-center">
        {/* Floating Shield */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-8"
        >
          <div className="w-28 h-28 md:w-36 md:h-36 rounded-full flex items-center justify-center relative">
            {/* Outer Pulse Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-pulse-glow" />
            <div className="absolute inset-2 rounded-full border border-accent/20" />
            {/* Shield Icon */}
            <img src="/icon-512.png" alt="JoeScan" className="w-16 h-16 md:w-24 md:h-24 drop-shadow-[0_0_25px_rgba(0,255,0,0.5)] rounded-2xl" />
          </div>
        </motion.div>

        {/* Brand */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex items-center gap-1 mb-6"
        >
          <span className="font-mono text-5xl md:text-7xl font-light text-text-main tracking-tight" dir="ltr">JOE</span>
          <span className="font-mono text-5xl md:text-7xl font-black text-accent tracking-tight" dir="ltr">SCAN</span>
          <div className="w-2 h-2 md:w-3 md:h-3 bg-accent rounded-full ml-1 animate-pulse" />
        </motion.div>

        {/* Tagline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-xl md:text-3xl font-bold text-text-main max-w-2xl mb-4 leading-relaxed"
        >
          {t('landing_hero_title')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="text-text-dim text-base md:text-lg max-w-xl mb-10 leading-relaxed"
        >
          {t('landing_hero_subtitle')}
        </motion.p>

        {/* CTA Button */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          onClick={() => setIsAuthModalOpen(true)}
          disabled={loading}
          className="btn-glow px-10 py-4 text-base md:text-lg flex items-center gap-3 disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-accent-fg/30 border-t-accent-fg rounded-full animate-spin" />
          ) : (
            <>
              <Lock className="w-5 h-5" />
              {t('landing_cta')}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </motion.button>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 flex flex-col items-center text-text-dim/50"
        >
          <span className="text-[10px] uppercase tracking-[0.3em] font-mono mb-2">{t('landing_scroll')}</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </motion.div>
      </section>

      {/* ===== STATS BAR ===== */}
      <section className="relative z-10 w-full max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7 }}
          className="glass-card grid grid-cols-2 md:grid-cols-4 divide-x divide-border-subtle"
        >
          {stats.map((stat, i) => (
            <div key={i} className="p-6 md:p-8 text-center">
              <div className="text-2xl md:text-3xl font-black font-mono text-accent mb-1">{stat.value}</div>
              <div className="text-[11px] md:text-xs text-text-dim uppercase tracking-widest font-semibold">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-text-main mb-4">
            {t('landing_features_title')}
          </h2>
          <p className="text-text-dim max-w-lg mx-auto">
            {t('landing_features_subtitle')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="glass-card p-6 flex flex-col gap-4 group cursor-default"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{
                    backgroundColor: `${feat.color}12`,
                    boxShadow: `0 0 20px ${feat.color}10`,
                  }}
                >
                  <Icon className="w-6 h-6" style={{ color: feat.color }} />
                </div>
                <div>
                  <h3 className="font-bold text-text-main text-sm mb-1.5">{feat.title}</h3>
                  <p className="text-text-dim text-xs leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ===== TRUST / HOW IT WORKS ===== */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-text-main mb-4">
            {t('landing_how_title')}
          </h2>
        </motion.div>

        <div className="flex flex-col md:flex-row gap-6 items-stretch">
          {[
            { step: '01', icon: Lock, title: t('landing_step1_title'), desc: t('landing_step1_desc') },
            { step: '02', icon: Zap, title: t('landing_step2_title'), desc: t('landing_step2_desc') },
            { step: '03', icon: Globe, title: t('landing_step3_title'), desc: t('landing_step3_desc') },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="glass-card p-8 flex-1 text-center flex flex-col items-center gap-4"
              >
                <div className="font-mono text-accent/40 text-5xl font-black">{item.step}</div>
                <Icon className="w-8 h-8 text-accent" />
                <h3 className="font-bold text-text-main text-lg">{item.title}</h3>
                <p className="text-text-dim text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="relative z-10 w-full max-w-3xl mx-auto px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-card border-gradient p-10 md:p-14 text-center"
        >
          <img src="/icon-512.png" alt="JoeScan" className="w-14 h-14 mx-auto mb-5 drop-shadow-[0_0_20px_rgba(0,255,0,0.4)] rounded-xl" />
          <h2 className="text-2xl md:text-3xl font-bold text-text-main mb-3">
            {t('landing_final_title')}
          </h2>
          <p className="text-text-dim mb-8 max-w-md mx-auto">
            {t('landing_final_subtitle')}
          </p>
          <button
            onClick={() => setIsAuthModalOpen(true)}
            disabled={loading}
            className="btn-glow px-10 py-4 text-base flex items-center gap-3 mx-auto disabled:opacity-50"
          >
            <Lock className="w-5 h-5" />
            {t('landing_cta')}
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-subtle px-6 py-6 text-center">
        <div className="font-mono text-[11px] text-text-dim/60 uppercase tracking-widest">
          {t('footer_encryption')}
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}

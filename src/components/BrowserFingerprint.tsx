import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { Fingerprint, Loader2, ShieldCheck, AlertTriangle, ArrowRight, ShieldAlert, Cpu, Globe, Crosshair, Network, Monitor, Chrome, Laptop, Lock, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateReportPDF } from '../lib/generatePDF';
import MiniHistory from './MiniHistory';

interface FingerprintResult {
  hash: string;
  hardware: {
    cores: number;
    memory: number | string;
    screen: string;
    colorDepth: number;
    platform: string;
    vendor: string;
  };
  software: {
    os: string;
    browser: string;
    language: string;
    timezone: string;
    cookiesEnabled: boolean;
    doNotTrack: string | null;
  };
  network: {
    ip: string;
    city: string;
    country: string;
    isp: string;
    org: string;
  };
  canvas: string;
  webgl: string;
}

export default function BrowserFingerprint() {
  const { lang, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FingerprintResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const getCanvasFingerprint = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 'Unsupported';
      
      canvas.width = 200;
      canvas.height = 50;
      
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('JoeScan FP', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('JoeScan FP', 4, 17);
      
      return canvas.toDataURL().slice(-50); // Get last 50 chars as crude hash
    } catch {
      return 'Error';
    }
  };

  const getWebGLFingerprint = () => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'Unsupported';
      
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) return 'No Debug Extension';
      
      return (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    } catch {
      return 'Error';
    }
  };

  const generateSimpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  };

  const runAnalysis = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. Get Client-Side data
      const nav = navigator as any;
      
      const hardware = {
        cores: nav.hardwareConcurrency || 0,
        memory: nav.deviceMemory ? `${nav.deviceMemory}GB+` : 'Unknown',
        screen: `${window.screen.width}x${window.screen.height}`,
        colorDepth: window.screen.colorDepth,
        platform: nav.platform,
        vendor: nav.vendor || 'Unknown',
      };

      const software = {
        os: nav.userAgent.match(/\(([^)]+)\)/)?.[1] || 'Unknown',
        browser: nav.userAgent,
        language: nav.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        cookiesEnabled: nav.cookieEnabled,
        doNotTrack: nav.doNotTrack || (window as any).doNotTrack || 'Unspecified',
      };

      const canvasFp = getCanvasFingerprint();
      const webglFp = getWebGLFingerprint();

      // 2. Fetch Network Data (IP & Geo) using free API
      let networkData = {
        ip: 'Unknown',
        city: 'Unknown',
        country: 'Unknown',
        isp: 'Unknown',
        org: 'Unknown'
      };

      try {
        const res = await fetch('http://ip-api.com/json/');
        if (res.ok) {
          const data = await res.json();
          networkData = {
            ip: data.query,
            city: data.city,
            country: data.country,
            isp: data.isp,
            org: data.org
          };
        }
      } catch (err) {
        console.warn('IP fetch failed:', err);
      }

      // 3. Generate combined Fingerprint Hash
      const rawString = `${hardware.cores}|${hardware.screen}|${software.os}|${software.timezone}|${canvasFp}|${webglFp}`;
      const fingerprintHash = `JS-${generateSimpleHash(rawString).toUpperCase()}`;

      const finalResult: FingerprintResult = {
        hash: fingerprintHash,
        hardware,
        software,
        network: networkData,
        canvas: canvasFp,
        webgl: webglFp
      };

      setResult(finalResult);
      setHistoryKey(k => k + 1);

      // Save to Firebase History
      try {
        const user = auth.currentUser;
        if (user) {
          await addDoc(collection(db, 'scans'), {
            userId: user.uid,
            type: 'browser_fingerprint',
            target: fingerprintHash,
            riskLevel: 'Medium', // Fingerprinting inherently holds medium privacy risk
            securityScore: 60,
            reportText: `OS: ${software.os}, Browser: ${software.browser}, IP: ${networkData.ip}`,
            createdAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.warn('History save failed:', e);
      }
    } catch (err: any) {
      setError(lang === 'ar' ? 'فشل في توليد البصمة بسبب خطأ في المتصفح.' : 'Failed to generate fingerprint due to browser block.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!result) return;
    const scanData = {
      target: result.hash,
      type: 'browser_fingerprint',
      riskLevel: 'Medium' as 'Medium',
      reportText: `Device Fingerprint Analysis:\n\nOS: ${result.software.os}\nScreen: ${result.hardware.screen}\nTimezone: ${result.software.timezone}\nIP: ${result.network.ip}\nLocation: ${result.network.city}, ${result.network.country}\nISP: ${result.network.isp}\nWebGL: ${result.webgl}`,
    };
    generateReportPDF(scanData, 'browser_fingerprint', lang);
  };

  return (
    <div className="w-full flex w-full flex-col max-w-4xl mx-auto gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/3" />
        
        <div className="flex flex-col gap-2">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-2 border border-accent/20 shadow-[0_0_15px_rgba(var(--accent-rgb),0.2)]">
            <Fingerprint className="w-6 h-6 text-accent" />
          </div>
          <h2 className="text-2xl font-bold font-mono tracking-tight">
            {lang === 'ar' ? 'بصمة المتصفح (Browser Fingerprint)' : 'Browser Fingerprinting'}
          </h2>
          <p className="text-text-dim text-sm max-w-2xl leading-relaxed">
            {lang === 'ar' 
              ? 'يُظهر هذا الفحص كيف يُمكن لمواقع الويب تتبعك حتى بدون ملفات تعريف الارتباط (Cookies). نقوم بجمع بيانات الجهاز، نظام التشغيل، والـ Canvas لإنشاء بصمة فريدة لجهازك.' 
              : 'Discover how websites can track you across the web even without cookies. This tool generates a unique hash based on your hardware, software, and network characteristics.'}
          </p>
        </div>

        {!result && !loading && (
          <div className="flex justify-center py-6">
            <button
              onClick={runAnalysis}
              className="btn-glow px-8 py-3 rounded-lg font-bold flex items-center gap-3 text-lg"
            >
              <Fingerprint className="w-5 h-5" />
              {lang === 'ar' ? 'بدء فحص البصمة' : 'Generate Fingerprint'}
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-bg-surface border-t-accent animate-spin" />
              <Fingerprint className="w-6 h-6 text-accent absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            </div>
            <p className="text-text-dim font-mono text-sm animate-pulse tracking-widest uppercase">
              {lang === 'ar' ? 'جاري استخراج البصمة...' : 'EXTRACTING FINGERPRINT...'}
            </p>
          </div>
        )}

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-lg bg-error/10 border border-error/20 flex gap-3 text-error">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </motion.div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center p-6 glass-card border-l-4 border-l-caution">
              <div>
                <h3 className="text-sm font-mono uppercase tracking-widest text-text-dim mb-1">
                  {lang === 'ar' ? 'معرف البصمة الفريد' : 'UNIQUE FINGERPRINT HASH'}
                </h3>
                <div className="text-3xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent to-caution">
                  {result.hash}
                </div>
              </div>
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 bg-bg-surface hover:bg-bg-elevated border border-border-subtle hover:border-accent/50 rounded-lg flex items-center gap-2 transition-all font-mono text-sm"
              >
                <Download className="w-4 h-4" />
                {lang === 'ar' ? 'تصدير PDF' : 'Export PDF'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden">
                <ShieldAlert className="w-32 h-32 text-accent/5 absolute top-4 right-4 -z-10" />
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-dim flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-accent" />
                  {lang === 'ar' ? 'الهاردوير (الأجهزة)' : 'Hardware Profile'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoCard label={lang === 'ar' ? 'المعالج (Cores)' : 'CPU Cores'} value={result.hardware.cores.toString()} />
                  <InfoCard label={lang === 'ar' ? 'الذاكرة (RAM)' : 'Memory'} value={result.hardware.memory.toString()} />
                  <InfoCard label={lang === 'ar' ? 'أبعاد الشاشة' : 'Resolution'} value={result.hardware.screen} />
                  <InfoCard label={lang === 'ar' ? 'عمق الألوان' : 'Color Depth'} value={`${result.hardware.colorDepth}-bit`} />
                </div>
              </div>

              <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden">
                <Chrome className="w-32 h-32 text-accent/5 absolute top-4 right-4 -z-10" />
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-dim flex items-center gap-2">
                  <Globe className="w-4 h-4 text-accent" />
                  {lang === 'ar' ? 'السوفتوير (البرمجيات)' : 'Software Profile'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <InfoCard label={lang === 'ar' ? 'نظام التشغيل' : 'OS'} value={result.software.os} />
                  <InfoCard label={lang === 'ar' ? 'التوقيت' : 'Timezone'} value={result.software.timezone} />
                  <InfoCard label={lang === 'ar' ? 'اللغة' : 'Language'} value={result.software.language} />
                  <InfoCard label={lang === 'ar' ? 'ملفات الارتباط' : 'Cookies'} value={result.software.cookiesEnabled ? 'Enabled' : 'Disabled'} />
                </div>
              </div>

              <div className="glass-card p-6 flex flex-col gap-4 lg:col-span-2">
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-dim flex items-center gap-2">
                  <Network className="w-4 h-4 text-accent" />
                  {lang === 'ar' ? 'تفاصيل الشبكة' : 'Network & WebGL'}
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <InfoCard label="IP Address" value={result.network.ip} />
                  <InfoCard label="ISP" value={result.network.isp} />
                  <InfoCard label="Location" value={`${result.network.city}, ${result.network.country}`} />
                  <InfoCard label="WebGL Vendor" value={result.webgl.split(' ')[0]} />
                </div>
              </div>
            </div>
            
            <div className="glass-card p-4 border-l-2 border-l-accent bg-accent/5 text-sm leading-relaxed text-text-dim">
              <span className="text-accent font-bold">Privacy Note: </span>
              {lang === 'ar' 
                ? 'البصمة الخاصة بك تستخدمها الإعلانات ومواقع التتبع لتحديد هويتك من بين ملايين المستخدمين في العالم دون استخدام الكوكيز، وذلك من خلال دمج تفاصيل جاهزك ومتصفحك وكرت الشاشة.' 
                : 'Your browser fingerprint is used by advertising and tracking networks to uniquely identify you across millions of web users without needing cookies, by combining your distinct device hardware, screen, and WebGL specs.'}
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      <MiniHistory scanType="browser_fingerprint" refreshKey={historyKey} />
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-surface p-3 rounded-lg border border-border-subtle break-words">
      <div className="text-[10px] uppercase font-mono tracking-wider text-text-dim mb-1">{label}</div>
      <div className="text-sm font-semibold truncate" title={value}>{value}</div>
    </div>
  );
}

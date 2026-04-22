import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { Link, Loader2, ShieldCheck, AlertTriangle, ArrowRight, Globe, Search, Lock, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import MiniHistory from './MiniHistory';

interface ParsedInfo {
  hostname: string;
  isHttp: boolean;
  isShortened: boolean;
  hasTracking: boolean;
}

export default function UrlAnalyzer() {
  const { lang, t } = useLanguage();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setParsed(null);

    try {
      let targetUrl = url.trim();
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'http://' + targetUrl;
      }

      let urlObj: URL;
      try {
        urlObj = new URL(targetUrl);
      } catch {
        throw new Error("Invalid URL format.");
      }

      const info: ParsedInfo = {
        hostname: urlObj.hostname,
        isHttp: urlObj.protocol === 'http:',
        isShortened: /bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly/i.test(urlObj.hostname),
        hasTracking: urlObj.searchParams.has('utm_source') || urlObj.searchParams.has('fbclid') || urlObj.searchParams.has('gclid'),
      };

      setParsed(info);

      if (auth.currentUser) {
        await addDoc(collection(db, 'scans'), {
          userId: auth.currentUser.uid,
          target: url,
          type: 'url',
          riskLevel: 'N/A',
          reportText: 'URL parsed: ' + info.hostname,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze URL.");
    } finally {
      setLoading(false);
    }
  };

  const warnings: { text: string; color: string }[] = [];
  if (parsed) {
    if (parsed.isHttp) warnings.push({ text: lang === 'ar' ? 'الرابط لا يستخدم تشفير HTTPS الآمن' : 'Unencrypted HTTP — data sent in plaintext', color: 'text-error' });
    if (parsed.isShortened) warnings.push({ text: lang === 'ar' ? 'رابط مختصر قد يخفي وجهة خبيثة' : 'Shortened link — real destination hidden', color: 'text-caution' });
    if (parsed.hasTracking) warnings.push({ text: lang === 'ar' ? 'يحتوي على كود تتبع للمستخدم' : 'Contains user tracking parameters', color: 'text-caution' });
  }

  return (
    <div className="w-full flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-base border border-border-subtle p-6 rounded-xl shadow-lg relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Link className="w-32 h-32" />
        </div>
        
        <h2 className="text-xl font-bold font-mono tracking-tight uppercase mb-2 text-text-main flex items-center gap-2">
          <Link className="w-5 h-5 text-accent" /> {t('url_title')}
        </h2>
        <p className="text-text-dim mb-6 text-sm">
          {t('url_desc')}
        </p>

        <form onSubmit={handleScan} className="flex gap-2 relative z-10 w-full max-w-2xl">
          <div className="relative flex-1">
            <input 
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('url_placeholder')}
              className="w-full bg-bg-surface border border-border-subtle rounded-lg pl-4 pr-10 py-3 text-text-main focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono"
              dir="ltr"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !url.trim()}
            className="bg-accent text-accent-fg px-6 py-3 rounded-lg font-bold tracking-wider uppercase hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center min-w-[120px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('audit')}
          </button>
        </form>
        {error && <p className="text-error text-sm mt-3">{error}</p>}
      </motion.div>

      <AnimatePresence mode="wait">
        {parsed && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full border border-accent/30 rounded-xl overflow-hidden p-6 bg-bg-base"
          >
            {/* URL Metadata — real deterministic facts */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-accent/10 rounded-full">
                <Globe className="w-8 h-8 text-accent" />
              </div>
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-1">
                  {lang === 'ar' ? 'النطاق المستهدف' : 'Target Hostname'}
                </h3>
                <div className="text-xl font-black text-text-main tracking-tight font-mono">{parsed.hostname}</div>
              </div>
            </div>

            {/* Real facts: SSL status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              <div className="bg-bg-surface p-3 rounded-lg flex items-center gap-3 border border-border-subtle">
                <Lock className={cn("w-5 h-5", parsed.isHttp ? "text-error" : "text-[#0f0]")} />
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim">SSL / HTTPS</p>
                  <p className="text-sm font-semibold text-text-main">
                    {parsed.isHttp 
                      ? (lang === 'ar' ? 'غير مشفر (HTTP)' : 'Unsecure HTTP') 
                      : (lang === 'ar' ? 'مشفر (HTTPS)' : 'Encrypted HTTPS')}
                  </p>
                </div>
              </div>
              <div className="bg-bg-surface p-3 rounded-lg flex items-center gap-3 border border-border-subtle">
                <Link className={cn("w-5 h-5", parsed.isShortened ? "text-caution" : "text-[#0f0]")} />
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim">{lang === 'ar' ? 'نوع الرابط' : 'Link Type'}</p>
                  <p className="text-sm font-semibold text-text-main">
                    {parsed.isShortened 
                      ? (lang === 'ar' ? 'رابط مختصر (مشبوه)' : 'Shortened URL (Suspicious)') 
                      : (lang === 'ar' ? 'رابط مباشر' : 'Direct URL')}
                  </p>
                </div>
              </div>
            </div>

            {/* Real warnings */}
            {warnings.length > 0 && (
              <div className="mb-6 space-y-2">
                {warnings.map((w, i) => (
                  <div key={i} className={cn("flex items-center gap-2 text-sm font-medium", w.color)}>
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{w.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Honest description */}
            <p className="text-sm text-text-dim mb-6 leading-relaxed">
              {lang === 'ar'
                ? 'البيانات أعلاه حقائق تقنية مستخرجة من بنية الرابط. اضغط على أدوات الفحص بالأسفل للتحقق من سمعة الرابط في قواعد بيانات أمنية عالمية.'
                : 'The data above are technical facts extracted from the URL structure. Click the investigation tools below to verify reputation against global security databases.'}
            </p>

            {/* OSINT Deep Links */}
            <h4 className="font-bold uppercase tracking-widest opacity-80 mb-4 flex items-center gap-2 text-accent text-xs">
              <Search className="w-4 h-4" /> {lang === 'ar' ? 'أدوات التحقيق العميق' : 'Deep Investigation Tools'}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
              <a 
                href={`https://urlscan.io/search/#${encodeURIComponent(`page.domain:"${parsed.hostname}"`)}`} 
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-bg-surface p-4 rounded-lg hover:bg-bg-surface/80 transition font-mono border border-border-subtle hover:border-[#1DA1F2] group"
              >
                <Camera className="w-6 h-6 text-[#1DA1F2] opacity-70 group-hover:opacity-100 transition" />
                <div>
                  <p className="text-[10px] tracking-widest text-text-dim">SANDBOX PREVIEW</p>
                  <p className="text-sm font-semibold text-text-main">UrlScan.io</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto opacity-30 group-hover:opacity-70 transition" />
              </a>

              <a 
                href={`https://www.virustotal.com/gui/search/${encodeURIComponent(parsed.hostname)}`} 
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-bg-surface p-4 rounded-lg hover:bg-bg-surface/80 transition font-mono border border-border-subtle hover:border-[#0f0] group"
              >
                <AlertTriangle className="w-6 h-6 text-[#0f0] opacity-70 group-hover:opacity-100 transition" />
                <div>
                  <p className="text-[10px] tracking-widest text-text-dim">MALWARE REPUTATION</p>
                  <p className="text-sm font-semibold text-text-main">VirusTotal</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto opacity-30 group-hover:opacity-70 transition" />
              </a>

              <a 
                href={`https://transparencyreport.google.com/safe-browsing/search?url=${encodeURIComponent(url)}`} 
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 bg-bg-surface p-4 rounded-lg hover:bg-bg-surface/80 transition font-mono border border-border-subtle hover:border-[#F4B400] group"
              >
                <ShieldCheck className="w-6 h-6 text-[#F4B400] opacity-70 group-hover:opacity-100 transition" />
                <div>
                  <p className="text-[10px] tracking-widest text-text-dim">BLACKLIST CHECK</p>
                  <p className="text-sm font-semibold text-text-main">Google Safe Browsing</p>
                </div>
                <ArrowRight className="w-4 h-4 ml-auto opacity-30 group-hover:opacity-70 transition" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MiniHistory scanType="url" />
    </div>
  );
}

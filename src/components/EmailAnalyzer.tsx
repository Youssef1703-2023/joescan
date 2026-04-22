import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { analyzeEmailExposure, translateReport } from '../lib/gemini';
import { ShieldAlert, ShieldCheck, Shield, Loader2, ArrowRight, Check, X, Share2, CheckCircle2, RefreshCw, Download, Twitter, Facebook, Link as LinkIcon, Settings2, SlidersHorizontal, Search, Star, Database, GlobeLock, FileSearch, HardDrive, Trash2, Eye } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateReportPDF } from '../lib/generatePDF';
import MiniHistory from './MiniHistory';

interface ScanResult {
  id: string;
  emailScanned: string;
  type?: string;
  target?: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  reportText: string;
  actionPlan: string;
  securityScore?: number;
  scoreFactors?: string[];
  scoreImprovement?: string[];
  breaches?: { name: string; date: string; dataExposed: string; recordCount?: string }[];
  createdAt: any;
  language?: string;
}

const COMMON_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'icloud.com', 'aol.com', 'proton.me', 'protonmail.com', 'live.com',
  'msn.com', 'me.com', 'mac.com'
];

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function normalizeEmail(rawEmail: string): string {
  let clean = rawEmail.trim().toLowerCase();
  const parts = clean.split('@');
  if (parts.length !== 2) return clean;
  
  const local = parts[0];
  const domain = parts[1];
  
  if (COMMON_DOMAINS.includes(domain)) return clean;

  let closestDomain = domain;
  let minDist = 3; // Max distance to auto-correct
  
  for (const d of COMMON_DOMAINS) {
    const dist = levenshteinDistance(domain, d);
    if (dist > 0 && dist < minDist) {
      minDist = dist;
      closestDomain = d;
    }
  }

  return `${local}@${closestDomain}`;
}

export default function EmailAnalyzer() {
  const { lang, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [activeScan, setActiveScan] = useState<ScanResult | null>(null);
  const [displayScan, setDisplayScan] = useState<ScanResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showScanSettings, setShowScanSettings] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [importantEmails, setImportantEmails] = useState<string[]>([]);
  const [scanSensitivity, setScanSensitivity] = useState<'low'|'medium'|'high'>('medium');
  const [scanDatabases, setScanDatabases] = useState({
    havaIBeenPwned: true,
    pwnedList: false,
    darkWeb: true,
    breachCompilation: false
  });
  const { addNotification } = useNotifications();
  const [watchedEmails, setWatchedEmails] = useState<string[]>([]);

  const toggleWatch = (emailTarget: string) => {
    const isWatched = watchedEmails.includes(emailTarget);
    if (isWatched) {
      setWatchedEmails(prev => prev.filter(e => e !== emailTarget));
    } else {
      setWatchedEmails(prev => [...prev, emailTarget]);
      addNotification({
        title: 'Monitor Activated',
        message: `${emailTarget} has been added to the continuous monitoring queue. You will be alerted of new breaches.`,
        type: 'success',
        linkTab: 'email'
      });
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (!activeScan) {
      setDisplayScan(null);
      return;
    }

    const handleTranslation = async () => {
      let shouldTranslate = false;
      let sourceLang = activeScan.language;

      if (sourceLang) {
        shouldTranslate = sourceLang !== lang;
      } else {
        // Fallback for legacy scans that do not have a stored language
        const hasArabic = /[\u0600-\u06FF]{5,}/.test(activeScan.reportText);
        sourceLang = hasArabic ? 'ar' : 'en';
        shouldTranslate = sourceLang !== lang;
      }

      if (shouldTranslate) {
        setIsTranslating(true);
        setDisplayScan({ ...activeScan }); // Show the raw version instantly before translation
        try {
          const resp = await translateReport(activeScan.reportText, activeScan.actionPlan, activeScan.scoreFactors || [], activeScan.scoreImprovement || [], lang);
          if (isMounted) {
            setDisplayScan({
              ...activeScan,
              reportText: resp.reportText,
              actionPlan: resp.actionPlan,
              scoreFactors: resp.scoreFactors || activeScan.scoreFactors,
              scoreImprovement: resp.scoreImprovement || activeScan.scoreImprovement,
              language: lang
            });
          }
        } catch (err) {
          console.error("Translation fail:", err);
        } finally {
          if (isMounted) setIsTranslating(false);
        }
      } else {
        setDisplayScan(activeScan);
      }
    };

    handleTranslation();
    return () => { isMounted = false; };
  }, [activeScan, lang]);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'scans'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ScanResult[];
      
      const emailResults = results.filter(r => !r.type || r.type === 'email').map(r => ({
        ...r,
        emailScanned: r.emailScanned || r.target || ''
      }));

      setScans(emailResults);
      if (emailResults.length > 0 && !activeScan) {
        // If we don't have an active scan, set the newest one as active
        setActiveScan(prev => prev ? prev : emailResults[0]);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'scans');
    });

    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

  const handleDeleteScan = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'scans', id));
      if (activeScan?.id === id) {
        setActiveScan(null);
        setDisplayScan(null);
      }
    } catch (err) {
      console.error("Failed to delete scan:", err);
    }
  };

  const handleClearAllScans = async () => {
    if (!auth.currentUser || scans.length === 0) return;
    try {
      const batch = writeBatch(db);
      scans.forEach(scan => {
        batch.delete(doc(db, 'scans', scan.id));
      });
      await batch.commit();
      setActiveScan(null);
      setDisplayScan(null);
    } catch (err) {
      console.error("Failed to clear history:", err);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Aggressively clean up trailing spaces/typos before validation
    const cleanedEmail = normalizeEmail(email);
    if (cleanedEmail !== email) setEmail(cleanedEmail);

    // Client-side email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanedEmail)) {
      setError(t('email_invalid_format'));
      return;
    }
    
    setLoading(true);
    setError(null);
    setShowScanSettings(false);
    try {
      // 1. Actually verify the Domain via public DNS Google before anything else
      // This stops completely fake domains like `hello@heloo.com` dead in their tracks.
      const domain = cleanedEmail.split('@')[1];
      try {
        const dnsResp = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
        const dnsData = await dnsResp.json();
        
        // If Google DNS returns Status 0 (NOERROR) but has NO Answer array containing an MX record...
        // OR it flat out fails, it's not a real email domain.
        if (dnsData.Status !== 0 || !dnsData.Answer || dnsData.Answer.length === 0) {
           setError(t('email_invalid_domain'));
           setLoading(false);
           return;
        }
      } catch (dnsErr) {
        // If we get blocked entirely, fallback safely to letting it pass rather than breaking functionality
        console.log("DNS Check failed/blocked:", dnsErr);
      }

      // 2. Perform exposure AI search
      const analysis = await analyzeEmailExposure(cleanedEmail, lang, scanSensitivity, scanDatabases);
      
      const newScan = {
        userId: auth.currentUser!.uid,
        emailScanned: cleanedEmail,
        type: 'email',
        target: cleanedEmail,
        riskLevel: analysis.riskLevel,
        reportText: analysis.reportText,
        actionPlan: analysis.actionPlan,
        securityScore: analysis.securityScore,
        scoreFactors: analysis.scoreFactors,
        scoreImprovement: analysis.scoreImprovement,
        breaches: analysis.breaches || [],
        createdAt: serverTimestamp(),
        language: lang
      };
      
      const docRef = await addDoc(collection(db, 'scans'), newScan);
      // Optimistically set active scan since onSnapshot might take a tick
      setActiveScan({ id: docRef.id, ...newScan } as ScanResult);
      setEmail('');
    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('exhausted') || msg.includes('rate_limit')) {
        setError(lang === 'ar' 
          ? '⚠️ خادم الذكاء الاصطناعي مشغول حالياً. استنى دقيقة وجرب تاني.'
          : '⚠️ AI server is currently busy. Wait a minute and try again.'
        );
      } else {
        setError(lang === 'ar' ? 'حصل خطأ أثناء التحليل. جرب تاني.' : 'An error occurred during analysis. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    if (level === 'Low') return { neon: 'text-accent', border: 'border-accent', bg: 'bg-accent/10', hex: 'var(--accent)' };
    if (level === 'Medium') return { neon: 'text-warning', border: 'border-warning', bg: 'bg-warning/10', hex: 'var(--warning)' };
    return { neon: 'text-error', border: 'border-error', bg: 'bg-error/10', hex: 'var(--error)' };
  };

  const getRiskIcon = (level: string) => {
    if (level === 'Low') return <ShieldCheck className="w-8 h-8 md:w-12 md:h-12 text-accent" />;
    if (level === 'Medium') return <ShieldAlert className="w-8 h-8 md:w-12 md:h-12 text-warning" />;
    return <ShieldAlert className="w-8 h-8 md:w-12 md:h-12 text-error" />;
  };

  const translatedRiskLevel = (level: string) => {
    if (level === 'Low') return t('risk_low');
    if (level === 'Medium') return t('risk_medium');
    return t('risk_high');
  };

  const handleShare = async () => {
    if (!displayScan) return;
    
    const currentUrl = window.location.href;
    const shareText = `${t('share_title')}\n\n${t('email_label')}: ${displayScan.emailScanned}\n${t('risk_label')}: ${translatedRiskLevel(displayScan.riskLevel)}\n${t('security_score_title')}: ${displayScan.securityScore}/100\n\n${t('part_of')}`;
    
    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${currentUrl}`);
        setShareCopied(true);
        setShowShareMenu(false);
        setTimeout(() => setShareCopied(false), 2000);
      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    };

    const isIframe = window.self !== window.top;

    try {
      const shareData = { title: t('share_title'), text: shareText, url: currentUrl };
      
      if (!isIframe && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        setShowShareMenu(!showShareMenu);
      }
    } catch (err) {
      console.warn("Native share aborted or failed. Showing menu:", err);
      setShowShareMenu(!showShareMenu);
    }
  };

  const executeCopyLink = async () => {
    if (!displayScan) return;
    const currentUrl = window.location.href;
    const shareText = `${t('share_title')}\n\n${t('email_label')}: ${displayScan.emailScanned}\n${t('risk_label')}: ${translatedRiskLevel(displayScan.riskLevel)}\n${t('security_score_title')}: ${displayScan.securityScore}/100\n\n${t('part_of')}`;
    try {
      await navigator.clipboard.writeText(`${shareText}\n${currentUrl}`);
      setShareCopied(true);
      setShowShareMenu(false);
      setTimeout(() => setShareCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const getShareLinks = () => {
    if (!displayScan) return { currentUrl: '', shareText: '' };
    const currentUrl = window.location.href;
    const shareText = `${t('share_title')}\n\n${t('email_label')}: ${displayScan.emailScanned}\n${t('risk_label')}: ${translatedRiskLevel(displayScan.riskLevel)}\n${t('security_score_title')}: ${displayScan.securityScore}/100\n\n${t('part_of')}`;
    return { currentUrl, shareText };
  };

  const handleDownloadPdf = async () => {
    if (!displayScan) return;
    setIsDownloading(true);
    try {
      // Delay slightly for UI to catch up if needed
      await new Promise(resolve => setTimeout(resolve, 500));
      generateReportPDF(displayScan, 'email', lang);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleImportantEmail = (e: React.MouseEvent, emailToToggle: string) => {
    e.stopPropagation(); // Prevents triggering the active scan selection
    setImportantEmails(prev => 
      prev.includes(emailToToggle) 
        ? prev.filter(e => e !== emailToToggle)
        : [...prev, emailToToggle]
    );
  };

  const handleExportCsv = () => {
    if (scans.length === 0) return;
    
    const headers = ['Email', 'Risk Level', 'Timestamp', 'Report Snippet'];
    const rows = scans.map(scan => {
      const email = `"${scan.emailScanned.replace(/"/g, '""')}"`;
      const risk = `"${scan.riskLevel}"`;
      const time = scan.createdAt?.toDate ? `"${new Date(scan.createdAt.toDate()).toISOString()}"` : '""';
      const snippet = `"${scan.reportText.substring(0, 100).replace(/"/g, '""').replace(/\n/g, ' ')}..."`;
      return [email, risk, time, snippet].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `JoeScan_History_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto w-full flex flex-col gap-8 flex-1">
      {/* Top Input Area */}
      <section className="w-full max-w-[600px] mb-4">
        <h1 className="text-[28px] font-bold mb-2">{t('hero_title')}</h1>
        <p className="text-text-dim mb-6 text-sm md:text-base">{t('hero_subtitle')}</p>
        
        <div className="relative">
          <form onSubmit={handleAnalyze} className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  setIsFocused(false);
                  if (email) setEmail(normalizeEmail(email));
                }}
                placeholder={t('email_placeholder_detailed')}
                className="w-full bg-bg-surface border border-border-subtle pl-5 pr-12 py-4 rounded-lg text-text-main text-base outline-none focus:border-accent transition-colors shadow-none"
                dir="ltr"
                disabled={loading}
              />
              <button
                type="button"
                className={cn("absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md transition-colors", showScanSettings ? "bg-accent/10 text-accent" : "text-text-dim hover:text-accent hover:bg-bg-base")}
                onClick={() => setShowScanSettings(!showScanSettings)}
                title={t('scan_settings')}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>
            </div>
            
            <button
              type="submit"
              disabled={loading || !email}
              className="bg-accent text-accent-fg font-bold px-8 rounded-lg uppercase tracking-widest transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 min-w-[120px] flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('analyze_button')}
            </button>
          </form>

          <AnimatePresence>
            {showScanSettings && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                className="absolute top-full left-0 right-0 mt-3 bg-bg-surface border border-border-subtle rounded-lg shadow-lg z-20 overflow-hidden"
              >
                <div className="p-5 flex flex-col lg:flex-row gap-6">
                  <div className="flex-1">
                    <h3 className="text-text-main font-bold mb-3 text-sm">{t('scan_sensitivity')}</h3>
                    <div className="flex flex-col gap-2">
                       {['low', 'medium', 'high'].map(level => (
                         <label key={level} className="flex items-center gap-2 cursor-pointer text-sm text-text-dim hover:text-text-main transition-colors">
                            <input 
                              type="radio" 
                              name="sensitivity"
                              value={level}
                              checked={scanSensitivity === level}
                              onChange={() => setScanSensitivity(level as any)}
                              className="accent-accent w-4 h-4"
                            />
                            {level === 'low' ? 'Low (Major breaches only)' : level === 'medium' ? 'Medium (Standard databases)' : 'High (All lists & spam maps)'}
                         </label>
                       ))}
                    </div>
                  </div>
                  <div className="h-px lg:h-auto lg:w-px bg-border-subtle my-2 lg:my-0" />
                  <div className="flex-1">
                    <h3 className="text-text-main font-bold mb-3 text-sm">{t('scan_db_selection')}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                       {[
                         { id: 'havaIBeenPwned', label: 'HaveIBeenPwned', icon: Database, desc: 'Global breach tracker' },
                         { id: 'pwnedList', label: 'PwnedList', icon: FileSearch, desc: 'Stolen credential pastes' },
                         { id: 'darkWeb', label: 'Dark Web Dumps', icon: GlobeLock, desc: 'Deep-web monitoring' },
                         { id: 'breachCompilation', label: 'BreachCompilation 2017', icon: HardDrive, desc: '1.4B archive leak' }
                       ].map((dbInfo) => {
                         const Icon = dbInfo.icon;
                         const isChecked = (scanDatabases as any)[dbInfo.id];
                         return (
                           <div 
                             key={dbInfo.id} 
                             className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border-subtle bg-bg-base hover:border-accent/40 shadow-sm transition-colors cursor-pointer group" 
                             onClick={() => setScanDatabases(prev => ({ ...prev, [dbInfo.id]: !isChecked }))}
                           >
                             <div className="flex items-start gap-3">
                               <div className={cn("p-2 rounded-lg shrink-0 transition-colors", isChecked ? "bg-accent/15 text-accent" : "bg-bg-surface text-text-dim group-hover:text-text-main")}>
                                 <Icon className="w-4 h-4" />
                               </div>
                               <div className="flex flex-col gap-0.5">
                                 <span className="text-sm font-semibold text-text-main leading-tight">{dbInfo.label}</span>
                                 <span className="text-[11px] text-text-dim leading-snug">{dbInfo.desc}</span>
                               </div>
                             </div>
                             <button
                               type="button"
                               role="switch"
                               aria-checked={isChecked}
                               className={cn(
                                 "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-base mt-2",
                                 isChecked ? "bg-accent" : "bg-border-subtle hover:bg-border-subtle/80"
                               )}
                             >
                                <span className="sr-only">Toggle {dbInfo.label}</span>
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#111110] shadow-sm ring-0 transition duration-200 ease-in-out",
                                    isChecked ? "translate-x-4" : "translate-x-0"
                                  )}
                                />
                             </button>
                           </div>
                         );
                       })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <AnimatePresence>
          {(isFocused || (!email && !error)) && !error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-text-dim/70 text-xs mt-2 ml-1"
            >
              {t('email_format_hint')}
            </motion.p>
          )}
        </AnimatePresence>

        {error && <p className="text-error text-sm mt-3 bg-error/10 border border-error/30 p-2 rounded">{error}</p>}
      </section>

      {/* Main Content Area */}
      <div className="flex flex-col md:grid md:grid-cols-[320px_1fr] gap-8 flex-1 items-start">
        {/* Left Column: Risk Card and History */}
        <div className="w-full flex flex-col gap-6">
          {activeScan ? (
            <div className="bg-bg-surface rounded-xl p-8 border border-border-subtle flex flex-col items-center text-center w-full">
              <div 
                className="w-[120px] h-[120px] rounded-full border-[8px] flex items-center justify-center mb-6 transition-all"
                style={{ 
                  borderColor: getRiskColor(activeScan.riskLevel).hex,
                  boxShadow: `0 0 20px ${getRiskColor(activeScan.riskLevel).hex}33`
                }}
              >
                <span className="text-xs uppercase font-extrabold tracking-[2px]" style={{ color: getRiskColor(activeScan.riskLevel).hex }}>
                  {activeScan.riskLevel}
                </span>
              </div>
              <h2 className="text-[32px] font-bold mb-2">
                {activeScan.riskLevel === 'Low' ? t('status_secure') : activeScan.riskLevel === 'Medium' ? t('status_warning') : t('status_risk')}
              </h2>
              <p className="text-text-dim text-[14px] mb-6">
                {activeScan.riskLevel === 'Low' ? t('desc_secure') : t('desc_risk')}
              </p>
              <div className="font-mono text-[14px] truncate w-full px-2" style={{ color: getRiskColor(activeScan.riskLevel).hex }} dir="ltr">
                [!] {activeScan.emailScanned}
              </div>
            </div>
          ) : (
             <div className="bg-bg-surface rounded-xl p-8 border border-border-subtle flex items-center justify-center text-center w-full min-h-[300px]">
                <p className="text-text-dim">{t('no_report')}</p>
             </div>
          )}

          {/* History */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-mono text-text-dim uppercase tracking-wider">{t('history_title')}</h3>
              {scans.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCsv}
                    className="text-xs flex items-center gap-1.5 text-accent hover:text-accent-fg hover:bg-accent/20 px-2 py-1 rounded transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    {t('export_csv')}
                  </button>
                  <button
                    onClick={handleClearAllScans}
                    className="text-xs flex items-center gap-1.5 text-error hover:text-error hover:bg-error/10 px-2 py-1 rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t('clear_all')}
                  </button>
                </div>
              )}
            </div>
            {scans.length > 0 && (
              <>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder={t('search_history')}
                    className="w-full bg-bg-surface border border-border-subtle pl-9 pr-4 py-2 rounded-lg text-text-main text-sm outline-none focus:border-accent transition-colors shadow-none"
                    dir="ltr"
                  />
                </div>
                {importantEmails.length > 0 && (
                  <div className="mb-4 bg-bg-surface border border-border-subtle p-3 rounded-xl border-dashed">
                    <h4 className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-accent text-accent" /> {t('saved_emails')}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                       {importantEmails.map(imEmail => {
                         const scanForEmail = scans.find(s => s.emailScanned === imEmail);
                         return (
                           <button
                             key={imEmail}
                             onClick={() => {
                               if (scanForEmail) setActiveScan(scanForEmail);
                               setEmail(imEmail);
                               window.scrollTo({ top: 0, behavior: 'smooth' });
                             }}
                             className="text-[10px] font-mono bg-accent/5 text-accent hover:bg-accent/20 border border-accent/20 px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors max-w-full"
                             dir="ltr"
                           >
                             <span className="truncate">{imEmail}</span>
                             <button
                               onClick={(e) => { e.stopPropagation(); toggleImportantEmail(e, imEmail); }}
                               className="hover:text-text-main text-text-dim transition-colors shrink-0 p-0.5"
                               title={t('unsave_email')}
                             >
                                <X className="w-2.5 h-2.5" />
                             </button>
                           </button>
                         )
                       })}
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {scans.filter(s => s.emailScanned.toLowerCase().includes(historySearchQuery.toLowerCase())).map(scan => (
                    <div
                      key={scan.id}
                      onClick={() => setActiveScan(scan)}
                      role="button"
                      tabIndex={0}
                    className={cn(
                      "w-full text-start p-3 rounded-lg border transition-all flex flex-col gap-1.5 relative group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      activeScan?.id === scan.id 
                        ? `bg-bg-surface border-[${getRiskColor(scan.riskLevel).hex}] shadow-[0_0_10px_rgba(0,0,0,0.5)]`
                        : "bg-bg-base border-border-subtle hover:bg-bg-surface"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono text-xs text-text-main truncate w-full block text-left" dir="ltr">{scan.emailScanned}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={(e) => toggleImportantEmail(e, scan.emailScanned)}
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity px-2 py-1 flex items-center justify-center gap-1 hover:bg-accent/10 rounded text-[10px] uppercase font-mono tracking-wider"
                          title={importantEmails.includes(scan.emailScanned) ? t('unsave_email') : t('save_email')}
                        >
                           <Star className={cn("w-3 h-3 shrink-0", importantEmails.includes(scan.emailScanned) ? "text-accent fill-accent" : "text-text-dim")} />
                           <span className={cn(importantEmails.includes(scan.emailScanned) ? "text-accent" : "text-text-dim")}>
                              {importantEmails.includes(scan.emailScanned) ? t('saved_verb') : t('save_verb')}
                           </span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteScan(e, scan.id)}
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1.5 flex items-center justify-center hover:bg-error/10 hover:text-error text-text-dim rounded"
                          title={t('delete')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center w-full mt-1">
                      <span className="text-[11px] font-semibold tracking-wider font-mono uppercase" style={{ color: getRiskColor(scan.riskLevel).hex }}>
                        {scan.riskLevel}
                      </span>
                      <span className="text-[10px] text-text-dim/80 font-mono">
                        {scan.createdAt?.toDate ? new Date(scan.createdAt.toDate()).toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' }) : t('just_now')}
                      </span>
                    </div>
                    {scan.reportText && (
                      <div className="text-[10px] text-text-dim line-clamp-2 text-left mt-1 overflow-hidden leading-relaxed pr-2">
                        {scan.reportText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Action Plan / Report Viewer */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full flex flex-col items-center justify-center bg-bg-surface/50 border border-border-subtle rounded-xl p-12 min-h-[400px]"
              >
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <div className="absolute inset-0 border-t-2 border-accent rounded-full animate-spin"></div>
                  <Shield className="w-10 h-10 text-accent opacity-50 absolute inset-0 m-auto animate-pulse" />
                  <div className="absolute inset-2 border-4 border-border-subtle rounded-full opacity-50"></div>
                </div>
                <h3 className="mt-8 font-mono text-lg text-text-main font-bold tracking-widest uppercase">{t('analyzing')}</h3>
                <p className="mt-2 text-text-dim text-sm max-w-[300px] text-center">
                  {t('analyzing_desc')}
                </p>
              </motion.div>
            ) : displayScan && (
              <motion.div
                key={displayScan.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="w-full flex flex-col gap-6 relative"
              >
                {isTranslating && (
                  <div className="absolute -top-3 right-4 rtl:left-4 rtl:right-auto flex items-center gap-2 text-[10px] bg-accent text-accent-fg px-2 py-1 rounded tracking-widest font-bold uppercase z-10 shadow-[0_0_10px_rgba(0,255,0,0.3)]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {t('translating')}
                  </div>
                )}
                <div id="report-content" className="bg-bg-surface/50 border border-border-subtle rounded-xl p-6 md:p-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4 border-b border-border-subtle pb-4">
                    <div>
                      <h2 className="text-xl md:text-2xl font-mono text-text-main mb-2 text-left" dir="ltr">
                        {displayScan.emailScanned}
                      </h2>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleWatch(displayScan.emailScanned)}
                          className={cn(
                            "group relative flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono tracking-widest uppercase transition-all shadow-sm border",
                            watchedEmails.includes(displayScan.emailScanned) 
                              ? "bg-accent/10 border-accent/30 text-accent" 
                              : "bg-bg-base border-border-subtle text-text-dim hover:bg-bg-surface hover:text-text-main"
                          )}
                          title={t('watch_tooltip')}
                        >
                          <Eye className={cn("w-3.5 h-3.5", watchedEmails.includes(displayScan.emailScanned) ? "animate-pulse" : "")} />
                          {watchedEmails.includes(displayScan.emailScanned) ? t('watch_enabled') : t('watch_disabled')}
                        </button>
                      </div>
                      <p className="text-text-dim text-xs font-mono mt-1">
                        {displayScan.createdAt?.toDate ? new Date(displayScan.createdAt.toDate()).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' }) : t('just_now')}
                      </p>
                    </div>
                    {/* Share and Download Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 self-start w-full sm:w-auto">
                      <button
                        onClick={handleDownloadPdf}
                        disabled={isDownloading}
                        className="flex items-center justify-center gap-2 bg-bg-base border border-border-subtle hover:border-accent transition-all pl-3 pr-4 py-2 rounded-lg text-text-main text-xs uppercase tracking-widest font-bold disabled:opacity-50 w-full sm:w-auto"
                      >
                        {isDownloading ? (
                           <Loader2 className="w-4 h-4 text-text-dim animate-spin" />
                        ) : (
                           <Download className="w-4 h-4 text-text-dim" />
                        )}
                        {t('download_report')}
                      </button>
                      <div className="relative w-full sm:w-auto">
                        <button
                          onClick={handleShare}
                          className="flex items-center justify-center gap-2 bg-bg-base border border-border-subtle hover:border-accent transition-all pl-3 pr-4 py-2 rounded-lg text-text-main text-xs uppercase tracking-widest font-bold w-full"
                        >
                          {shareCopied ? (
                             <CheckCircle2 className="w-4 h-4 text-accent" />
                          ) : (
                             <Share2 className="w-4 h-4 text-text-dim" />
                          )}
                          {shareCopied ? t('share_copied') : t('share_report')}
                        </button>
                        
                        {/* Share Menu Dropdown */}
                        <AnimatePresence>
                          {showShareMenu && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className="absolute top-full lg:right-0 rtl:left-0 rtl:right-auto rtl:lg:left-0 rtl:lg:right-auto mt-2 bg-bg-surface border border-border-subtle rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.4)] flex flex-col p-1.5 z-50 min-w-[200px]"
                            >
                              {(() => {
                                const { currentUrl, shareText } = getShareLinks();
                                return (
                                  <>
                                    <button 
                                      onClick={executeCopyLink} 
                                      className="flex items-center gap-3 p-2.5 hover:bg-bg-base rounded-lg text-sm text-text-main transition-colors text-left w-full cursor-pointer"
                                    >
                                       {shareCopied ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <LinkIcon className="w-4 h-4 text-text-dim" />}
                                       <span className="font-medium">{shareCopied ? t('share_copied') : t('copy_link')}</span>
                                    </button>
                                    <div className="h-[1px] w-full bg-border-subtle/50 my-1" />
                                    <a 
                                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(currentUrl)}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="flex items-center gap-3 p-2.5 hover:bg-bg-base rounded-lg text-sm transition-colors text-text-main hover:text-[#1DA1F2] cursor-pointer" 
                                      onClick={() => setShowShareMenu(false)}
                                    >
                                       <Twitter className="w-4 h-4" />
                                       <span className="font-medium">{t('share_twitter')}</span>
                                    </a>
                                    <a 
                                      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="flex items-center gap-3 p-2.5 hover:bg-bg-base rounded-lg text-sm transition-colors text-text-main hover:text-[#1877F2] cursor-pointer" 
                                      onClick={() => setShowShareMenu(false)}
                                    >
                                       <Facebook className="w-4 h-4" />
                                       <span className="font-medium">{t('share_facebook')}</span>
                                    </a>
                                  </>
                                );
                              })()}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {displayScan.securityScore !== undefined && (
                    <div className="bg-bg-base border border-border-subtle rounded-xl p-6 mb-8 flex flex-col md:flex-row items-center md:items-start gap-8">
                      {/* Gauge */}
                      <div className="relative flex items-center justify-center w-32 h-32 flex-shrink-0 group cursor-help">
                        {/* Tooltip */}
                        <div className="absolute -top-16 lg:left-1/2 lg:-translate-x-1/2 w-48 p-2 bg-text-main text-bg-base border border-border-subtle rounded text-xs font-medium text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 shadow-xl pointer-events-none">
                          {t('security_score_tooltip')}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-text-main" />
                        </div>
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="64" cy="64" r="56" stroke="#222" strokeWidth="8" fill="transparent" />
                          <motion.circle
                            cx="64" cy="64" r="56" 
                            stroke={displayScan.securityScore >= 80 ? "var(--accent)" : displayScan.securityScore >= 40 ? "var(--warning)" : "var(--error)"} 
                            strokeWidth="8" fill="transparent"
                            strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 56}
                            initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                            animate={{ strokeDashoffset: (2 * Math.PI * 56) * (1 - displayScan.securityScore / 100) }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center justify-center mt-1">
                          <span className="text-3xl font-mono font-bold text-text-main leading-none">{displayScan.securityScore}</span>
                          <span className="text-[10px] uppercase tracking-widest text-text-dim">/ 100</span>
                        </div>
                      </div>
                      {/* Details */}
                      <div className="flex flex-col gap-4 w-full">
                        <h3 className="text-lg font-bold font-mono text-text-main">{t('security_score_title')}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {displayScan.scoreFactors && displayScan.scoreFactors.length > 0 && (
                            <div className="bg-error/5 border border-error/10 rounded-lg p-3">
                              <h4 className="text-[11px] font-bold uppercase tracking-widest text-error mb-3 flex items-center gap-2">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                {t('score_factors')}
                              </h4>
                              <ul className="flex flex-col gap-2">
                                {(Array.isArray(displayScan.scoreFactors) ? displayScan.scoreFactors : [String(displayScan.scoreFactors)]).map((f, i) => (
                                  <li key={i} className="flex items-start gap-2 text-[13px] text-text-dim text-left">
                                    <X className="w-4 h-4 text-error shrink-0 mt-0.5" />
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {displayScan.scoreImprovement && displayScan.scoreImprovement.length > 0 && (
                            <div className="bg-accent/5 border border-accent/10 rounded-lg p-3">
                              <h4 className="text-[11px] font-bold uppercase tracking-widest text-accent mb-3 flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                {t('score_improvement')}
                              </h4>
                              <ul className="flex flex-col gap-2">
                                {(Array.isArray(displayScan.scoreImprovement) ? displayScan.scoreImprovement : [String(displayScan.scoreImprovement)]).map((f, i) => (
                                  <li key={i} className="flex items-start gap-2 text-[13px] text-text-dim text-left">
                                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                    <span>{f}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {displayScan.breaches && displayScan.breaches.length > 0 && (
                    <div className="bg-error/5 border border-error/20 rounded-xl p-6 mb-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2 text-error">
                        <Database className="w-4 h-4" />
                        {lang === 'ar' ? 'التسريبات المكتشفة' : 'Breaches Detected'}
                        <span className="ml-auto bg-error/10 text-error px-2 py-0.5 rounded-full text-[10px]">
                          {displayScan.breaches.length}
                        </span>
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-error/10">
                              <th className="text-left px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-text-dim">{lang === 'ar' ? 'الخدمة' : 'Service'}</th>
                              <th className="text-left px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-text-dim">{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                              <th className="text-left px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-text-dim">{lang === 'ar' ? 'البيانات المسربة' : 'Data Exposed'}</th>
                              <th className="text-right px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-text-dim">{lang === 'ar' ? 'عدد الحسابات' : 'Records'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {displayScan.breaches.map((breach, idx) => (
                              <tr key={idx} className="border-b border-border-subtle/30 hover:bg-error/5 transition-colors">
                                <td className="px-3 py-2.5 font-semibold text-text-main">{breach.name}</td>
                                <td className="px-3 py-2.5 text-text-dim font-mono text-xs">{breach.date}</td>
                                <td className="px-3 py-2.5">
                                  <div className="flex flex-wrap gap-1">
                                    {breach.dataExposed.split(',').map((d, i) => (
                                      <span key={i} className="bg-bg-surface text-text-dim text-[10px] px-1.5 py-0.5 rounded border border-border-subtle">
                                        {d.trim()}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-right text-text-dim font-mono text-xs">{breach.recordCount || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <h3 className="text-xl font-bold mb-4 font-mono text-text-main">{t('report_overview')}</h3>
                  <div className="text-[15px] leading-relaxed text-text-dim whitespace-pre-wrap">
                    {displayScan.reportText}
                  </div>
                </div>

                <div className="bg-accent/[0.03] border border-dashed border-accent rounded-xl p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <ShieldCheck className="w-6 h-6 text-accent" />
                    <h3 className="text-[20px] text-accent uppercase tracking-[1px] font-bold">
                      {t('your_plan')}
                    </h3>
                  </div>
                  
                  <div className="flex flex-col gap-5">
                    {(() => {
                      const rawActionPlan = displayScan.actionPlan || '';
                      const steps = (typeof rawActionPlan === 'string' ? rawActionPlan.split('\n') : Array.isArray(rawActionPlan) ? rawActionPlan : []).filter(p => typeof p === 'string' && p.trim() !== '');
                      let stepCount = 0;
                      return steps.map((para, i) => {
                        const isStep = /^(?:\d+|\-|[\u0660-\u0669]+)[\.\-]?\s+/.test(para.trim());
                        if (isStep) {
                          stepCount++;
                          const content = para.replace(/^(?:\d+|\-|[\u0660-\u0669]+)[\.\-]?\s+/, '');
                          // Try to extract bold text for headers: **Header**: Text
                          const boldMatch = content.match(/^\*\*(.*?)\*\*(?::?\s(.*))?/);
                          return (
                            <div key={i} className="flex gap-4">
                              <div className="w-7 h-7 bg-accent text-accent-fg rounded flex items-center justify-center font-black flex-shrink-0 text-sm">
                                {stepCount.toString().padStart(2, '0')}
                              </div>
                              <div className="flex flex-col gap-1 mt-[2px]">
                                {boldMatch ? (
                                  <>
                                    <h4 className="text-[16px] font-bold text-text-main">{boldMatch[1]}</h4>
                                    {boldMatch[2] && <p className="text-[14px] text-text-dim leading-relaxed">{boldMatch[2]}</p>}
                                  </>
                                ) : (
                                  <p className="text-[14px] text-text-dim leading-relaxed font-medium">{content}</p>
                                )}
                              </div>
                            </div>
                          );
                        } else {
                          return <p key={i} className="text-text-dim text-[14px]">{para}</p>;
                        }
                      });
                    })()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mini History */}
      <MiniHistory scanType="email" />
    </div>
  );
}

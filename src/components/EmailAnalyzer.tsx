import '../styles/focus-email.css';
import {appAttestationHeaders} from '../lib/appAttestation';
import AdditionalEmailSource from './AdditionalEmailSource';
import {fetchCombinedEmailExposure} from '../lib/combinedEmailExposure';
import {groupEmailEvidence, type EvidenceGroup} from '../lib/emailEvidence';
import React, { useState, useEffect } from 'react';
import { collection, serverTimestamp, query, where, orderBy, onSnapshot, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { saveScan } from '../lib/webhooks';
import { assessEmailBreaches, EmailSourceError, type EmailBreach } from '../lib/emailExposure';
import { consumeScanAttempt, ScanRateLimitError } from '../lib/scanRateLimit';
import { useLanguage } from '../contexts/LanguageContext';
import { analyzeEmailExposure, translateReport } from '../lib/gemini';
import { ShieldAlert, ShieldCheck, Shield, Loader2, ArrowRight, Check, X, Share2, CheckCircle2, RefreshCw, Download, Twitter, Facebook, Link as LinkIcon, Settings2, SlidersHorizontal, Search, Star, Database, GlobeLock, FileSearch, HardDrive, Trash2, Eye, Mail } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateReportPDF } from '../lib/generatePDF';

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
  breaches?: EmailBreach[];
  source?: string;
  checkedAt?: string;
  assessmentVersion?: number;
  evidenceGroups?: EvidenceGroup[];
  sourceStatuses?: {xposedornot:string;leakcheck:string};
  coverageIncomplete?: boolean;
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

export default function EmailAnalyzer({initialValue=""}:{initialValue?:string}={}) {
  const { lang, t } = useLanguage();
  const [email, setEmail] = useState(initialValue);
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
        emailScanned: r.emailScanned || r.target || '',
        ...(r.assessmentVersion !== 3 && r.breaches?.length ? assessEmailBreaches(r.breaches) : {})
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

    try {
      consumeScanAttempt();
    } catch (rateLimitError) {
      if (rateLimitError instanceof ScanRateLimitError) {
        setError('Temporary scan limit reached. Please wait one minute and try again.');
        return;
      }
      throw rateLimitError;
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
      const analysis = await fetchCombinedEmailExposure(cleanedEmail, lang, async()=>{
        const base=import.meta.env.VITE_AI_PROXY_URL;
        if(!base||!auth.currentUser)throw new Error('Source unavailable');
        const response=await fetch(base.replace(/\/+$/,'')+'/email-exposure/extra', {method:'POST',headers:{'Content-Type':'application/json',...(await appAttestationHeaders()), Authorization:'Bearer '+await auth.currentUser.getIdToken()},body:JSON.stringify({email:cleanedEmail,consent:true}),signal:AbortSignal.timeout(25000)});
        if(!response.ok)throw new Error('Source unavailable');
        return response.json();
      });
      
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
        breaches: analysis.breaches,
        source: analysis.source,
        checkedAt: analysis.checkedAt,
        assessmentVersion: analysis.assessmentVersion,
        evidenceGroups: analysis.evidenceGroups,
        sourceStatuses: analysis.sourceStatuses,
        coverageIncomplete: analysis.coverageIncomplete,
        createdAt: serverTimestamp(),
        language: analysis.language
      };
      
      const docRef = await saveScan(newScan);
      // Optimistically set active scan since onSnapshot might take a tick
      setActiveScan({ id: docRef.id, ...newScan } as ScanResult);
      setEmail('');
    } catch (err: any) {
      console.error(err);
      const msg = err.message || '';
      if (err instanceof EmailSourceError) {
        setError(err.message);
      } else if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('exhausted') || msg.includes('rate_limit')) {
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
      await generateReportPDF(displayScan, 'email', lang);
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
    <div className="focus-email max-w-6xl mx-auto w-full min-w-0 flex flex-col gap-8 flex-1">
      {/* Top Input Area */}
      <section className="fe-hero">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] bg-[radial-gradient(ellipse_at_top,rgba(0,255,0,0.08),transparent_65%)]" />
        <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-accent">
          <Mail className="h-3.5 w-3.5" /> JOESCAN / EMAIL CHECK
        </div>
        <div className="mx-auto max-w-3xl text-center">
        <div className="fe-orbit" aria-hidden="true"><Mail size={30}/></div><h1>Email Check<span>Know where you stand.</span></h1>
        <p className="mx-auto mt-4 mb-8 max-w-xl text-text-dim text-sm sm:text-base leading-relaxed">Check if your email appears in known data breaches. See the findings, understand their limits, and choose your next step.</p>
        </div>
        
        <div className="relative mx-auto w-full max-w-3xl">
          <label htmlFor="email-audit-address" className="mb-2 block text-xs font-semibold text-text-main">Email address</label>
          <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-border-subtle bg-bg-base p-2 shadow-[0_12px_40px_rgba(0,0,0,0.15)] focus-within:border-accent/50 transition-colors">
            <div className="relative min-w-0 flex-1">
              <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-accent/70" />
              <input
                id="email-audit-address"
                type="email"
                autoComplete="email"
                spellCheck={false}
                required
                aria-describedby="email-audit-hint"
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
                placeholder="you@example.com"
                className="w-full min-w-0 bg-transparent border-0 pl-12 pr-14 py-4 rounded-xl text-text-main text-base outline-none placeholder:text-text-dim/60"
                dir="ltr"
                disabled={loading}
              />
              <button
                type="button"
                className={cn("absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md transition-colors", showScanSettings ? "bg-accent/10 text-accent" : "text-text-dim hover:text-accent hover:bg-bg-base")}
                onClick={() => setShowScanSettings(!showScanSettings)}
                title="Data source and coverage"
                aria-label="Data source and coverage"
                aria-expanded={showScanSettings}
                aria-controls="email-scan-settings"
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>
            </div>
            
            <button
              type="submit"
              disabled={loading || !email}
              className="bg-accent text-accent-fg font-bold px-6 py-4 rounded-xl text-sm transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 sm:min-w-[160px] flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Checking…</> : <>Check email <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <AnimatePresence>
            {showScanSettings && (
              <motion.div
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                id="email-scan-settings"
                className="relative mt-4 bg-bg-base/70 border border-border-subtle rounded-2xl overflow-hidden"
              >
                <div className="p-5 text-sm text-text-dim leading-relaxed">
                  <h3 className="font-bold text-text-main mb-2">Sources & coverage</h3>
                  <p>Checking sends your email to XposedOrNot and, through JoeScan, LeakCheck Public. Returned metadata is combined in your saved report. Coverage varies and a failed source is reported.</p>
                  <p className="mt-2">Have I Been Pwned is not connected. No match means no match in the checked sources, not a guarantee of safety.</p>
                  <a className="mt-3 inline-block text-accent underline" href="https://xposedornot.com/api_doc" target="_blank" rel="noopener noreferrer">About this data source</a>
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
              id="email-audit-hint"
              className="text-text-dim/70 text-xs mt-3 text-center"
            >
              {t('email_format_hint')}
            </motion.p>
          )}
        </AnimatePresence>

        <p className="mx-auto mt-4 max-w-3xl text-xs text-text-dim">This check uses XposedOrNot and LeakCheck Public using your email. Source metadata is saved with your report. <a href="/privacy" className="text-accent underline">Privacy policy</a></p>
        {error && <p role="alert" className="mx-auto max-w-3xl text-error text-sm mt-4 bg-error/10 border border-error/30 p-3 rounded-xl">{error}</p>}
        <div className="mx-auto mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border-subtle pt-5 text-[11px] text-text-dim">
          <span className="flex items-center gap-2"><Database className="h-3.5 w-3.5 text-accent/70" /> Available breach records</span>
          <span className="flex items-center gap-2"><FileSearch className="h-3.5 w-3.5 text-accent/70" /> Clear exposure report</span>
          <span className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-accent/70" /> Practical next steps</span>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="fe-results flex flex-col xl:grid xl:grid-cols-[250px_minmax(0,1fr)] gap-6 flex-1 items-start">
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
                {activeScan.breaches?.length ? 'Exposure found' : activeScan.coverageIncomplete ? 'Incomplete check' : (activeScan.assessmentVersion || 0) >= 2 ? 'No matches' : 'Rescan needed'}
              </h2>
              <p className="text-text-dim text-[14px] mb-6">
                {activeScan.breaches?.length ? 'Review the listed breaches and take the recommended steps.' : 'Limited provider coverage. This is not a security guarantee.'}
              </p>
              <div className="font-mono text-[14px] truncate w-full px-2" style={{ color: getRiskColor(activeScan.riskLevel).hex }} dir="ltr">
                [!] {activeScan.emailScanned}
              </div>
            </div>
          ) : (
             <div className="fe-no-report bg-bg-surface rounded-xl p-8 border border-border-subtle flex items-center justify-center text-center w-full">
                <p className="text-text-dim">{t('no_report')}</p>
             </div>
          )}

          {/* Previous checks */}
          <section className="fe-history" aria-label="Previous scans">
            <header><span className="fe-section-number">YOUR ACTIVITY</span><div><h3>{lang === 'ar' ? 'الفحوصات السابقة' : 'Previous scans'}</h3><span className="fe-history-count">{scans.length}</span></div></header>
            {scans.length > 0 ? <>
              <label className="fe-history-search"><Search size={14}/><input aria-label={t('search_history')} placeholder={t('search_history')} value={historySearchQuery} onChange={e=>setHistorySearchQuery(e.target.value)} dir="ltr"/></label>
              <div className="fe-history-tools"><button onClick={handleExportCsv}><Download size={13}/>{t('export_csv')}</button><button onClick={handleClearAllScans}><Trash2 size={13}/>{t('clear_all')}</button></div>
              {importantEmails.length > 0 && <div className="fe-saved-emails"><span><Star size={12}/>{t('saved_emails')}</span>{importantEmails.map(value=><div key={value}><button onClick={()=>{const match=scans.find(scan=>scan.emailScanned===value);if(match)setActiveScan(match);setEmail(value)}} title={value}>{value}</button><button aria-label={t('unsave_email') + ': ' + value} onClick={e=>toggleImportantEmail(e,value)}><X size={13}/></button></div>)}</div>}
              <div className="fe-history-list">
                {scans.filter(scan=>scan.emailScanned.toLowerCase().includes(historySearchQuery.toLowerCase())).map(scan=><article key={scan.id} className={'fe-history-card' + (activeScan?.id===scan.id ? ' is-selected' : '')}>
                  <button className="fe-history-open" aria-pressed={activeScan?.id===scan.id} onClick={()=>setActiveScan(scan)}>
                    <span className="fe-history-card-top"><Mail size={14}/><span>{activeScan?.id===scan.id ? (lang==='ar' ? 'التقرير المفتوح' : 'Viewing report') : (lang==='ar' ? 'فتح التقرير' : 'Open report')}</span><ArrowRight size={13}/></span>
                    <strong dir="ltr">{scan.emailScanned}</strong>
                    <span className="fe-history-meta"><span className={'fe-history-risk risk-' + scan.riskLevel?.toLowerCase()}>{scan.riskLevel || 'Not assessed'}</span><time>{scan.createdAt?.toDate ? new Date(scan.createdAt.toDate()).toLocaleString(lang,{dateStyle:'short',timeStyle:'short'}) : t('just_now')}</time></span>
                  </button>
                  <footer><button onClick={e=>toggleImportantEmail(e,scan.emailScanned)} aria-pressed={importantEmails.includes(scan.emailScanned)}><Star size={12} fill={importantEmails.includes(scan.emailScanned) ? 'currentColor' : 'none'}/>{importantEmails.includes(scan.emailScanned) ? t('saved_verb') : t('save_verb')}</button><button aria-label={t('delete') + ': ' + scan.emailScanned} onClick={e=>handleDeleteScan(e,scan.id)}><Trash2 size={13}/></button></footer>
                </article>)}
                {!scans.some(scan=>scan.emailScanned.toLowerCase().includes(historySearchQuery.toLowerCase())) && <p className="fe-history-empty">{lang==='ar' ? 'لا توجد فحوصات مطابقة.' : 'No matching checks.'}</p>}
              </div>
            </> : <p className="fe-history-empty">{lang==='ar' ? 'ستظهر فحوصاتك المحفوظة هنا.' : 'Your saved email checks will appear here.'}</p>}
          </section>
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
            ) : !displayScan ? (<div className="fe-ready"><FileSearch size={32}/><span>YOUR EXPOSURE REPORT</span><h2>A little clarity starts here.</h2><p>Enter your email above to see available breach findings and practical next steps. Your report will appear in this space.</p><div><span>01 / Check sources</span><span>02 / Understand exposure</span><span>03 / Take action</span></div></div>) : displayScan && (
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
                <div id="report-content" className="fe-report-shell">
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

                  <div className="fe-report-summary">
                    <div className="fe-score"><span>SECURITY SCORE</span><strong>{displayScan.securityScore ?? '—'}<small> / 100</small></strong><p>A local assessment, not a security guarantee.</p></div>
                    <div className="fe-verdict"><span>ASSESSMENT</span><h3>{displayScan.coverageIncomplete ? 'Coverage incomplete' : displayScan.riskLevel === 'High' ? 'Review your exposure.' : displayScan.riskLevel === 'Medium' ? 'A closer look is worthwhile.' : 'Review the available findings.'}</h3><p>{displayScan.coverageIncomplete ? 'One or more sources could not complete the check. Review available findings and retry for fuller coverage.' : 'Use the source evidence below to understand what was found and decide what to do next.'}</p><span className="fe-risk-pill">{displayScan.riskLevel} risk estimate</span></div>
                  </div>
                  {displayScan.scoreFactors?.length ? <details className="fe-score-details"><summary>How this assessment was reached</summary><ul>{(Array.isArray(displayScan.scoreFactors) ? displayScan.scoreFactors : [String(displayScan.scoreFactors)]).map((factor,index)=><li key={index}>{factor}</li>)}</ul></details> : null}

                  <div className="fe-report-evidence"><span className="fe-section-number">01 / SOURCE EVIDENCE</span>
                    <h3 className="text-lg font-medium mb-3">{lang === 'ar' ? 'نتائج الفحص' : 'Findings'}</h3>
                    {displayScan.sourceStatuses || displayScan.assessmentVersion === 2 ? (
                      <AdditionalEmailSource embedded email={displayScan.emailScanned} groups={displayScan.evidenceGroups || groupEmailEvidence(displayScan.breaches || [], null)} statuses={displayScan.sourceStatuses || {xposedornot:'complete',leakcheck:'not checked in this historical scan'}} />
                    ) : (
                      <div className="text-sm leading-relaxed text-text-dim whitespace-pre-wrap">{displayScan.reportText}</div>
                    )}
                    <p className="mt-4 text-xs text-text-dim">Coverage varies by provider. HIBP is not connected. The score is a local estimate, not a security guarantee.</p>
                    {!displayScan.assessmentVersion && <p className="mt-2 text-sm text-warning">This older report used previous assessment logic. Run a new check for an updated report.</p>}
                  </div>

                <div className="fe-report-plan mt-6 border-t border-border-subtle pt-6"><span className="fe-section-number">02 / YOUR NEXT STEPS</span>
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

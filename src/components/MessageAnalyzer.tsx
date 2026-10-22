import '../styles/focus-message.css';
import React, { useState } from 'react';
import { serverTimestamp } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { saveScan } from '../lib/webhooks';
import { useLanguage } from '../contexts/LanguageContext';
import { analyzeMessage } from '../lib/gemini';
import {
  adjustSecurityScoreForFloor,
  analyzeMessageSignals,
  combineMessageRisk,
  type MessageSignalCheck,
  type MessageSignalsResult,
} from '../lib/messageSignals';
import { MessageSquareWarning, Loader2, ShieldCheck, AlertTriangle, ArrowRight, ShieldAlert, BrainCircuit, ScanSearch, Activity, Download, CheckCircle, XCircle, Info, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import MiniHistory from './MiniHistory';
import { generateReportPDF } from '../lib/generatePDF';

interface ScanResult {
  riskLevel: 'Low' | 'Medium' | 'High';
  reportText: string;
  actionPlan: string;
  securityScore?: number;
  scoreFactors?: string[];
  scoreImprovement?: string[];
  fraudProbability?: string;
  psychologicalTactics?: string[];
  spoofedContext?: string;
  signals?: MessageSignalsResult;
  floorApplied?: boolean;
}

export default function MessageAnalyzer() {
  const { lang, t } = useLanguage();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [reportTarget, setReportTarget] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const [scanResult, signals] = await Promise.all([
        analyzeMessage(message, lang),
        analyzeMessageSignals(message),
      ]);

      const combined = combineMessageRisk(signals, scanResult?.riskLevel);
      const adjustedScore = adjustSecurityScoreForFloor(
        scanResult?.securityScore,
        combined.finalRisk,
        combined.floorApplied,
      );

      const mergedResult: ScanResult = {
        ...scanResult,
        riskLevel: combined.finalRisk,
        securityScore: adjustedScore,
        signals: combined.signals,
        floorApplied: combined.floorApplied,
      };

      setResult(mergedResult);
      setHistoryKey((k) => k + 1);
      setReportTarget(message.substring(0, 30) + '...');

      if (auth.currentUser) {
        await saveScan({
          userId: auth.currentUser.uid,
          target: message.substring(0, 30) + '...',
          type: 'message',
          riskLevel: combined.finalRisk,
          securityScore: adjustedScore ?? null,
          reportText: scanResult.reportText,
          actionPlan: scanResult.actionPlan,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze message.");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch(level?.toUpperCase()) {
      case 'HIGH': return 'text-error bg-error/10 border-error/20';
      case 'MEDIUM': return 'text-caution bg-caution/10 border-caution/20';
      case 'LOW': return 'text-[#0f0] bg-[#0f0]/10 border-[#0f0]/20';
      default: return 'text-text-dim bg-bg-surface border-border-subtle';
    }
  };

  const renderIcon = (level: string) => {
    switch(level?.toUpperCase()) {
      case 'HIGH': return <ShieldAlert className="w-12 h-12 text-error" />;
      case 'MEDIUM': return <AlertTriangle className="w-12 h-12 text-caution" />;
      case 'LOW': return <ShieldCheck className="w-12 h-12 text-[#0f0]" />;
      default: return <MessageSquareWarning className="w-12 h-12 text-text-dim" />;
    }
  };

  const statusIcon = (status: MessageSignalCheck['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'warn': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'fail': return <XCircle className="w-5 h-5 text-red-400" />;
      case 'info': return <Info className="w-5 h-5 text-blue-400" />;
      case 'unknown': return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const signalChecks = result?.signals?.checks || [];

  return (
    <div className="focus-message w-full max-w-6xl mx-auto min-w-0 flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fm-hero scan-hero bg-bg-base border border-border-subtle p-6 rounded-xl shadow-lg relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <MessageSquareWarning className="w-32 h-32" />
        </div>
        
        <span className="fm-eyebrow">JOESCAN / MESSAGE PHISHING</span><h2 className="scan-title text-xl font-bold font-mono tracking-tight uppercase mb-2 text-text-main flex items-center gap-2">
          <MessageSquareWarning className="w-5 h-5 text-accent" /> {t('message_title')}
        </h2>
        <p className="text-text-dim mb-6 text-sm">
          {lang === 'ar' ? 'راجع الرسالة قبل الرد. افهم علامات التصيد ومحاولات الضغط وانتحال الهوية.' : 'Pause before you reply. Look for phishing signals, pressure tactics and impersonation.'}
        </p>

        <form onSubmit={handleScan} className="flex flex-col gap-3 relative z-10 w-full max-w-2xl">
          <div className="fm-input-head"><label htmlFor="message-check-text">{lang === "ar" ? "نص الرسالة" : "Message text"}</label><button type="button" disabled={loading || !message} onClick={()=>setMessage('')}>{lang === "ar" ? "مسح" : "Clear"}</button></div>
          <textarea id="message-check-text" disabled={loading} 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('message_placeholder')}
            className="w-full bg-bg-surface border border-border-subtle rounded-lg p-4 text-text-main focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono min-h-[120px] resize-y"
            dir="auto"
          />
          <button 
            type="submit" 
            disabled={loading || !message.trim()}
            className="bg-accent text-accent-fg px-6 py-3 self-start rounded-lg font-bold tracking-wider uppercase hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center min-w-[120px]"
          >
            {loading ? <><Loader2 className="w-5 h-5 animate-spin" />{lang === 'ar' ? 'جارٍ التحليل…' : 'Checking…'}</> : <>{lang === 'ar' ? 'فحص الرسالة' : 'Check message'}<ArrowRight size={15}/></>}
          </button>
        </form>
        <p className="fm-note">{lang === "ar" ? "احذف المعلومات الحساسة قبل إرسال النص للتحليل. النتائج تقييم أولي وليست تأكيدًا لهوية المرسل." : "Remove sensitive details before submitting text for analysis. Findings are an initial assessment, not verification of the sender."}</p>
        {error && <p role="alert" className="text-error text-sm mt-3">{error}</p>}
      </motion.div>

      {!result && !loading && <div className="fm-ready"><MessageSquareWarning size={23}/><div><h3>{lang === 'ar' ? 'وضوح أكثر، قبل الخطوة التالية.' : 'A clearer picture before your next move.'}</h3><p>{lang === 'ar' ? 'ستظهر علامات الاشتباه والتوصيات هنا بعد الفحص.' : 'The assessment, suspicious signals and recommended actions will appear here.'}</p></div></div>}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-5"
          >
            <div
              className={cn(
                "fm-report w-full border rounded-xl overflow-hidden p-6 transition-all",
                getRiskColor(result.riskLevel)
              )}
            >
              <div className="flex flex-col md:flex-row gap-6 md:items-start items-center text-center md:text-left">
                <div className="shrink-0 p-4 bg-bg-base/50 rounded-full backdrop-blur-md">
                  {renderIcon(result.riskLevel)}
                </div>
                <div className="flex-1 space-y-4 w-full">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="font-mono text-xs uppercase tracking-widest opacity-80 mb-1">{t('risk_assessed')}</h3>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-2xl font-black uppercase tracking-tight">{result.riskLevel} {t('exposure').toUpperCase()}</div>
                        {typeof result.securityScore === 'number' && (
                          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-bg-base/60 border border-[currentColor]/20">
                            {lang === 'ar' ? `درجة الأمان: ${result.securityScore}/100` : `SCORE: ${result.securityScore}/100`}
                          </span>
                        )}
                        {result.floorApplied && (
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-bg-base/70 border border-[currentColor]/25">
                            {lang === 'ar' ? 'تم رفع مستوى الخطر بناءً على مؤشرات مؤكدة' : 'Deterministic Risk Floor Active'}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!result || isExporting) return;
                        setIsExporting(true);
                        try {
                          await generateReportPDF({ ...result, target: reportTarget }, 'message', lang);
                        } finally {
                          setIsExporting(false);
                        }
                      }}
                      disabled={isExporting}
                      className="flex items-center gap-2 bg-text-main text-bg-base hover:bg-opacity-90 px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold transition-all disabled:opacity-50"
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <Download className="w-4 h-4" />}
                      {lang === 'ar' ? (isExporting ? 'جاري التحميل...' : 'تحميل التقرير') : (isExporting ? 'Downloading...' : 'Download Report')}
                    </button>
                  </div>

                  <div className="fm-summary text-sm opacity-90 leading-relaxed font-medium">
                    {result.reportText}
                  </div>

                  {(result.fraudProbability || result.psychologicalTactics || result.spoofedContext) && (
                    <div className="fm-signals pt-4 border-t border-[currentColor]/10 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {result.fraudProbability && (
                        <div className="bg-bg-base/40 p-3 rounded-lg">
                          <Activity className="w-4 h-4 mb-2 opacity-70" />
                          <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">{t('scam_confidence')}</p>
                          <p className="text-sm font-semibold truncate" title={result.fraudProbability}>{result.fraudProbability}</p>
                        </div>
                      )}
                      {result.psychologicalTactics && result.psychologicalTactics.length > 0 && (
                        <div className="bg-bg-base/40 p-3 rounded-lg col-span-1 md:col-span-2 flex flex-col justify-center">
                          <div className="flex items-center gap-2 mb-2">
                            <BrainCircuit className="w-4 h-4 opacity-70" />
                            <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">{t('psy_triggers')}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(Array.isArray(result.psychologicalTactics) ? result.psychologicalTactics : [String(result.psychologicalTactics)]).map((tactic, idx) => (
                              <span key={idx} className="bg-bg-base px-2 py-0.5 rounded text-xs border border-[currentColor]/20">
                                {tactic}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.spoofedContext && (
                        <div className="bg-bg-base/40 p-3 rounded-lg col-span-1 md:col-span-3">
                          <div className="flex items-center gap-2 mb-1">
                            <ScanSearch className="w-4 h-4 opacity-70" />
                            <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">{t('spoofing_vectors')}</p>
                          </div>
                          <p className="text-sm font-semibold">{result.spoofedContext}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="fm-actions bg-bg-base/40 rounded-lg p-4 mt-2">
                    <h4 className="font-bold text-xs uppercase tracking-widest opacity-80 mb-3 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4" /> {t('action_plan')}
                    </h4>
                    <ul className="space-y-2 text-sm opacity-90">
                      {(result.actionPlan || '').split(/\r?\n|\\n/).filter(Boolean).map((step, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-mono opacity-50">{i + 1}.</span>
                          <span>{step.replace(/^\d+[.)]\s*/, '')}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Deterministic Signals List (styled like UrlAnalyzer checks) ── */}
            {signalChecks.length > 0 && (
              <div className="fl-checks bg-bg-base border border-border-subtle rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-widest text-text-dim flex items-center gap-2">
                    <Search className="w-3.5 h-3.5" />
                    {lang === 'ar'
                      ? `مؤشرات الرسالة والروابط (${signalChecks.length} فحص)`
                      : `Deterministic Message Signals (${signalChecks.length} checks)`}
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-text-dim">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />{' '}
                      {signalChecks.filter((c) => c.status === 'fail').length} {lang === 'ar' ? 'خطير' : 'FAIL'}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />{' '}
                      {signalChecks.filter((c) => c.status === 'warn').length} {lang === 'ar' ? 'تحذير' : 'WARN'}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />{' '}
                      {signalChecks.filter((c) => c.status === 'pass').length} {lang === 'ar' ? 'آمن' : 'PASS'}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-border-subtle/50">
                  {signalChecks.map((check) => (
                    <div
                      key={check.id}
                      className={cn(
                        'px-5 py-4 flex gap-4 hover:bg-bg-surface/30 transition-colors',
                        check.status === 'fail' && 'bg-red-500/5',
                        check.status === 'warn' && 'bg-amber-500/5',
                      )}
                    >
                      <div className="mt-0.5 shrink-0">{statusIcon(check.status)}</div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-text-main mb-1">
                          {lang === 'ar' ? check.nameAr : check.name}
                        </h4>
                        <p className="text-xs text-text-dim leading-relaxed">
                          {lang === 'ar' ? check.detailAr : check.detail}
                        </p>
                      </div>
                      <div className="shrink-0 self-center">
                        <span
                          className={cn(
                            'text-[10px] font-mono font-bold px-2 py-0.5 rounded',
                            check.status === 'pass' && 'bg-emerald-500/10 text-emerald-400',
                            check.status === 'warn' && 'bg-amber-500/10 text-amber-400',
                            check.status === 'fail' && 'bg-red-500/10 text-red-400',
                            check.status === 'info' && 'bg-blue-500/10 text-blue-400',
                            check.status === 'unknown' && 'bg-blue-500/10 text-blue-400',
                          )}
                        >
                          {check.status === 'unknown'
                            ? lang === 'ar'
                              ? 'غير متاح'
                              : 'UNAVAILABLE'
                            : check.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <MiniHistory scanType="message" refreshKey={historyKey} />
    </div>
  );
}

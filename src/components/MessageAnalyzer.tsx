import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { analyzeMessage } from '../lib/gemini';
import { MessageSquareWarning, Loader2, ShieldCheck, AlertTriangle, ArrowRight, ShieldAlert, BrainCircuit, ScanSearch, Activity, Download } from 'lucide-react';
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
}

export default function MessageAnalyzer() {
  const { lang, t } = useLanguage();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const scanResult = await analyzeMessage(message, lang);
      setResult(scanResult);

      if (auth.currentUser) {
        await addDoc(collection(db, 'scans'), {
          userId: auth.currentUser.uid,
          target: message.substring(0, 30) + '...',
          type: 'message',
          riskLevel: scanResult.riskLevel,
          securityScore: scanResult.securityScore ?? null,
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

  return (
    <div className="w-full flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-base border border-border-subtle p-6 rounded-xl shadow-lg relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <MessageSquareWarning className="w-32 h-32" />
        </div>
        
        <h2 className="text-xl font-bold font-mono tracking-tight uppercase mb-2 text-text-main flex items-center gap-2">
          <MessageSquareWarning className="w-5 h-5 text-accent" /> {t('message_title')}
        </h2>
        <p className="text-text-dim mb-6 text-sm">
          {t('message_desc')}
        </p>

        <form onSubmit={handleScan} className="flex flex-col gap-3 relative z-10 w-full max-w-2xl">
          <textarea 
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
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('audit')}
          </button>
        </form>
        {error && <p className="text-error text-sm mt-3">{error}</p>}
      </motion.div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "w-full border rounded-xl overflow-hidden p-6 transition-all",
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
                    <div className="text-2xl font-black uppercase tracking-tight">{result.riskLevel} {t('exposure').toUpperCase()}</div>
                  </div>
                  <button
                    onClick={() => generateReportPDF({ ...result, target: message.substring(0, 30) + '...' }, 'message', lang)}
                    className="flex items-center gap-2 bg-text-main text-bg-base hover:bg-opacity-90 px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold transition-all"
                  >
                    <Download className="w-4 h-4" /> Download Report
                  </button>
                </div>

                <div className="text-sm opacity-90 leading-relaxed font-medium">
                  {result.reportText}
                </div>

                {(result.fraudProbability || result.psychologicalTactics || result.spoofedContext) && (
                  <div className="pt-4 border-t border-[currentColor]/10 grid grid-cols-1 md:grid-cols-3 gap-4">
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

                <div className="bg-bg-base/40 rounded-lg p-4 mt-2">
                  <h4 className="font-bold text-xs uppercase tracking-widest opacity-80 mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" /> {t('action_plan')}
                  </h4>
                  <ul className="space-y-2 text-sm opacity-90">
                    {(result.actionPlan || '').split('\\n').filter(Boolean).map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono opacity-50">{i + 1}.</span>
                        <span>{step.replace(/^\\d+\\.\\s*/, '')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MiniHistory scanType="message" />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { motion, AnimatePresence } from 'motion/react';
import { History, ChevronDown, ChevronUp, Shield } from 'lucide-react';

interface ScanRecord {
  id: string;
  target: string;
  riskLevel: string;
  securityScore?: number;
  createdAt: Date;
}

interface Props {
  scanType: string;
  refreshKey?: number; // increment to trigger refresh
}

export default function MiniHistory({ scanType, refreshKey = 0 }: Props) {
  const { lang } = useLanguage();
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!auth.currentUser) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'scans'),
          where('userId', '==', auth.currentUser.uid),
          where('type', '==', scanType),
          orderBy('createdAt', 'desc'),
          limit(5),
        );
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            target: data.target || data.emailScanned || 'Unknown',
            riskLevel: data.riskLevel || 'Low',
            securityScore: data.securityScore,
            createdAt: data.createdAt?.toDate() || new Date(),
          };
        });
        setRecords(results);
      } catch (e) {
        console.warn('Mini history fetch failed:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [scanType, refreshKey]);

  const getRiskBadge = (risk: string) => {
    const r = (risk || '').toLowerCase();
    if (r === 'high') return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: '● HIGH' };
    if (r === 'medium') return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', label: '● MEDIUM' };
    return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: '● LOW' };
  };

  const getRelativeTime = (date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return lang === 'ar' ? 'الآن' : 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${lang === 'ar' ? 'مضت' : 'ago'}`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${lang === 'ar' ? 'مضت' : 'ago'}`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ${lang === 'ar' ? 'مضت' : 'ago'}`;
    return date.toLocaleDateString();
  };

  if (loading || records.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card overflow-hidden mt-6"
    >
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-bg-surface/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <History className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="text-xs font-mono uppercase tracking-widest text-text-dim font-semibold">
            {lang === 'ar' ? `آخر ${records.length} عمليات فحص` : `Last ${records.length} Scans`}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-text-dim" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-dim" />
        )}
      </button>

      {/* Records */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border-subtle divide-y divide-border-subtle/50">
              {records.map((record) => {
                const badge = getRiskBadge(record.riskLevel);
                return (
                  <div
                    key={record.id}
                    className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-bg-surface/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${badge.text.replace('text-', 'bg-')}`} />
                      <span className="font-mono text-sm text-text-main truncate" dir="ltr">
                        {scanType === 'password' ? '••••••••' : record.target}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                      </span>
                      {record.securityScore !== undefined && (
                        <span className="text-xs font-mono text-text-dim w-8 text-right">
                          {record.securityScore}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-text-dim/60 w-16 text-right">
                        {getRelativeTime(record.createdAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Database, Shield, Trash2, Download, Search, Filter,
  ChevronLeft, ChevronRight, Mail, KeyRound, Smartphone,
  Link as LinkIcon, UserSearch, MessageSquareWarning, Wifi, Globe, Fingerprint, FileText
} from 'lucide-react';
import IntelligenceReport from './IntelligenceReport';

interface ScanHistory {
  id: string;
  type: string;
  target: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  securityScore?: number;
  createdAt: Date;
}

export default function ScanHistory() {
  const { lang, t } = useLanguage();
  const [scans, setScans] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [selectedReport, setSelectedReport] = useState<ScanHistory | null>(null);

  const fetchScans = async () => {
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      const historyQuery = query(
        collection(db, 'scans'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc'),
      );

      const snapshot = await getDocs(historyQuery);
      const results = snapshot.docs.map((snapshotDoc) => {
        const data = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          type: data.type || 'email',
          target: data.target || data.emailScanned || 'Unknown',
          riskLevel: data.riskLevel,
          securityScore: data.securityScore,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      }) as ScanHistory[];

      setScans(results);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا السجل؟' : 'Are you sure you want to delete this record?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'scans', id));
      setScans(scans.filter((scan) => scan.id !== id));
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleExportCSV = () => {
    if (scans.length === 0) return;

    const headers = ['Type', 'Target', 'Risk Level', 'Score', 'Date'];
    const csvContent = [
      headers.join(','),
      ...scans.map((scan) => `"${scan.type}","${scan.target}","${scan.riskLevel}","${scan.securityScore || 'N/A'}","${scan.createdAt.toLocaleString()}"`),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `joescan_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'password': return <KeyRound className="w-4 h-4" />;
      case 'phone': return <Smartphone className="w-4 h-4" />;
      case 'url': return <LinkIcon className="w-4 h-4" />;
      case 'username': return <UserSearch className="w-4 h-4" />;
      case 'social_osint': return <Globe className="w-4 h-4" />;
      case 'message': return <MessageSquareWarning className="w-4 h-4" />;
      case 'ip': return <Wifi className="w-4 h-4" />;
      case 'domain': return <Globe className="w-4 h-4" />;
      case 'browser_fingerprint': return <Fingerprint className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'email': return t('nav_email');
      case 'password': return t('nav_password');
      case 'phone': return t('nav_phone');
      case 'url': return t('nav_url');
      case 'username': return t('nav_username');
      case 'social_osint': return t('nav_social' as never);
      case 'message': return t('nav_message');
      case 'ip': return t('nav_ip');
      case 'domain': return lang === 'ar' ? 'فحص الدومين' : 'Domain WHOIS';
      case 'browser_fingerprint': return lang === 'ar' ? 'بصمة المتصفح' : 'Browser Fingerprint';
      default: return type;
    }
  };

  const getRiskStyles = (risk: string) => {
    switch (risk?.toUpperCase()) {
      case 'HIGH': return 'bg-error/10 text-error border-error/20';
      case 'MEDIUM': return 'bg-caution/10 text-caution border-caution/20';
      case 'LOW': return 'bg-[#0f0]/10 text-[#0f0] border-[#0f0]/20';
      default: return 'bg-border-subtle/50 text-text-dim border-border-subtle';
    }
  };

  const filteredScans = scans.filter((scan) => {
    const matchesSearch = scan.target.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || scan.type === typeFilter;
    const matchesRisk = riskFilter === 'all' || (scan.riskLevel || 'low').toLowerCase() === riskFilter.toLowerCase();
    return matchesSearch && matchesType && matchesRisk;
  });

  const totalPages = Math.ceil(filteredScans.length / itemsPerPage);
  const currentScans = filteredScans.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const filterTypes = ['all', 'email', 'password', 'phone', 'url', 'username', 'social_osint', 'message', 'ip', 'domain', 'browser_fingerprint'];
  const filterRisks = ['all', 'low', 'medium', 'high'];

  return (
    <div className="w-full flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6"
      >
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Database className="w-6 h-6 text-accent" />
            {t('scan_history_title')}
          </h2>
          <p className="text-text-dim mt-1 text-sm">{t('history_subtitle')}</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={scans.length === 0}
          className="btn-glow px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-50 disabled:grayscale"
        >
          <Download className="w-4 h-4" />
          {t('action_export')}
        </button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-4 flex flex-col md:flex-row gap-4 justify-between"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-text-dim absolute top-1/2 -translate-y-1/2 left-3 rtl:left-auto rtl:right-3" />
          <input
            type="text"
            placeholder={t('search_scans')}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full bg-bg-base border border-border-subtle rounded-lg py-2 pl-10 pr-4 rtl:pl-4 rtl:pr-10 focus:outline-none focus:border-accent/50 text-sm"
          />
        </div>

        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          <div className="flex items-center gap-2 bg-bg-base border border-border-subtle rounded-lg px-2">
            <Filter className="w-3 h-3 text-text-dim" />
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="bg-transparent border-none outline-none py-2 pr-4 text-sm font-medium cursor-pointer"
            >
              {filterTypes.map((typeOption) => (
                <option key={typeOption} value={typeOption} className="bg-bg-base">
                  {typeOption === 'all' ? t('filter_all') : getTypeLabel(typeOption)}
                </option>
              ))}
            </select>
          </div>

          <select
            value={riskFilter}
            onChange={(e) => { setRiskFilter(e.target.value); setCurrentPage(1); }}
            className="bg-bg-base border border-border-subtle rounded-lg px-4 py-2 outline-none text-sm font-medium cursor-pointer"
          >
            {filterRisks.map((riskOption) => (
              <option key={riskOption} value={riskOption} className="bg-bg-base">
                {riskOption === 'all' ? t('filter_risk') : t(`status_badge_${riskOption}` as never)}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card overflow-hidden"
      >
        {loading ? (
          <div className="p-16 flex justify-center text-text-dim">
            <Shield className="w-10 h-10 animate-pulse" />
          </div>
        ) : filteredScans.length === 0 ? (
          <div className="p-16 text-center text-text-dim flex flex-col items-center">
            <Database className="w-12 h-12 mb-4 opacity-50" />
            <p className="font-medium text-lg">{t('no_history_found')}</p>
          </div>
        ) : (
          <div>
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-border-subtle bg-bg-base/50 text-xs font-mono uppercase tracking-widest text-text-dim font-bold">
              <div className="col-span-2">Type</div>
              <div className="col-span-4">Target</div>
              <div className="col-span-2">Risk</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-border-subtle">
              <AnimatePresence>
                {currentScans.map((scan) => (
                  <motion.div
                    key={scan.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 md:grid md:grid-cols-12 gap-4 items-center flex flex-col hover:bg-bg-base/50 transition-colors"
                  >
                    <div className="col-span-2 flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-text-dim font-semibold self-start md:self-auto w-full md:w-auto mb-2 md:mb-0">
                      <div className="p-1.5 bg-bg-elevated border border-border-subtle rounded shrink-0">
                        {getIcon(scan.type)}
                      </div>
                      {getTypeLabel(scan.type)}
                    </div>

                    <div className="col-span-4 font-semibold text-sm break-all w-full md:w-auto mb-2 md:mb-0">
                      {scan.type === 'password' ? '********' : scan.target}
                    </div>

                    <div className="col-span-2 flex items-center w-full md:w-auto mb-2 md:mb-0">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded border ${getRiskStyles(scan.riskLevel || 'Low')}`}>
                        {t(`status_badge_${(scan.riskLevel || 'Low').toLowerCase()}` as never)}
                      </span>
                      {scan.securityScore !== undefined && (
                        <span className="ml-2 text-xs font-mono opacity-70 border-l border-border-subtle pl-2">
                          {scan.securityScore}
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 text-xs text-text-dim w-full md:w-auto mb-2 md:mb-0 tabular-nums">
                      {scan.createdAt.toLocaleDateString()}
                    </div>

                    <div className="col-span-2 flex justify-end gap-2 w-full md:w-auto border-t border-border-subtle md:border-none pt-3 md:pt-0">
                      <button
                        onClick={() => setSelectedReport(scan)}
                        className="text-text-dim hover:text-accent hover:bg-accent/10 p-2 rounded-lg transition-colors border border-transparent hover:border-accent/20"
                        title={lang === 'ar' ? 'تصدير تقرير' : 'Generate Dossier'}
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(scan.id)}
                        className="text-text-dim hover:text-error hover:bg-error/10 p-2 rounded-lg transition-colors border border-transparent hover:border-error/20"
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </motion.div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 py-4">
          <button
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="p-2 glass-surface rounded-lg disabled:opacity-50 hover:bg-bg-elevated transition-colors"
          >
            <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
          </button>
          <span className="font-mono text-sm tracking-widest">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="p-2 glass-surface rounded-lg disabled:opacity-50 hover:bg-bg-elevated transition-colors"
          >
            <ChevronRight className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>
      )}
      {/* Intelligence Report Modal */}
      {selectedReport && (
        <IntelligenceReport 
          scan={selectedReport as any} 
          onClose={() => setSelectedReport(null)} 
        />
      )}
    </div>
  );
}

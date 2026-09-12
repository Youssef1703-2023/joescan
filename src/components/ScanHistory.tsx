import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { PASSWORD_SCAN_TARGET } from '../lib/scanLabels';
import '../styles/focus-history.css';
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
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const copy = (en: string, ar: string) => lang === 'ar' ? ar : en;
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
          target: data.type === 'password' ? PASSWORD_SCAN_TARGET : data.target || data.emailScanned || 'Unknown',
          riskLevel: data.riskLevel,
          securityScore: data.securityScore,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      }) as ScanHistory[];

      setScans(results);
    } catch (error) {
      setError(copy('Your history could not be loaded. Please try again.', 'تعذر تحميل السجل. حاول مرة أخرى.'));
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
      setScans(previous => previous.filter((scan) => scan.id !== id));
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleExportCSV = () => {
    if (scans.length === 0) return;

    const cell = (value: unknown) => { const text = String(value ?? 'N/A'); return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"'; };
    const headers = ['Type', 'Target', 'Risk Level', 'Score', 'Date'];
    const csvContent = [
      headers.join(','),
      ...scans.map(scan => [scan.type, scan.target, scan.riskLevel || 'Unknown', scan.securityScore, scan.createdAt.toLocaleString()].map(cell).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `joescan_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const risk = (scan: ScanHistory) => ['low','medium','high'].includes(scan.riskLevel?.toLowerCase()) ? scan.riskLevel.toLowerCase() : 'unknown';

  const filteredScans = scans.filter((scan) => {
    const matchesSearch = scan.target.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || scan.type === typeFilter;
    const matchesRisk = riskFilter === 'all' || risk(scan) === riskFilter;
    return matchesSearch && matchesType && matchesRisk;
  });

  const totalPages = Math.max(1, Math.ceil(filteredScans.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const currentScans = filteredScans.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const filterTypes = ['all', ...new Set(['email', 'password', 'url', ...scans.map(scan => scan.type)])];
  const filterRisks = ['all', 'low', 'medium', 'high', 'unknown'];

  const clearFilters = () => { setSearchQuery(''); setTypeFilter('all'); setRiskFilter('all'); setCurrentPage(1); };
  const filtered = searchQuery !== '' || typeFilter !== 'all' || riskFilter !== 'all';
  const riskLabel = (value: string) => value === 'unknown' ? copy('Not assessed', 'غير مُقيّم') : t(('status_badge_' + value) as never);
  return (
    <section className="focus-history" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="fh-heading">
        <div><span className="fh-eyebrow">JOESCAN / {copy('YOUR WORKSPACE', 'مساحة عملك')}</span><h1>{copy('Scan history.', 'سجل الفحوصات.')}</h1><p>{copy('A clearer view of what you’ve checked. Pick up where you left off.', 'صورة أوضح لفحوصاتك السابقة. تابع من حيث توقفت.')}</p></div>
        <button className="fh-export" onClick={handleExportCSV} disabled={loading || !scans.length}><Download size={16}/>{copy('Export all CSV', 'تصدير الكل CSV')}</button>
      </header>
      <div className="fh-overview">
        <div><span>{copy('Saved checks', 'فحوصات محفوظة')}</span><strong>{loading || (error && !scans.length) ? '—' : scans.length}<small>{copy('in your history', 'في سجلك')}</small></strong></div>
        <div><span>{copy('High risk findings', 'نتائج عالية الخطورة')}</span><strong className="fh-amber">{loading || (error && !scans.length) ? '—' : scans.filter(scan => risk(scan) === 'high').length}<small>{copy('worth reviewing', 'تستحق المراجعة')}</small></strong></div>
        <div className="fh-private"><Shield size={23}/><div><b>{copy('Your checks. Your record.', 'فحوصاتك وسجلك.')}</b><p>{copy('Revisit a report or remove a saved check at any time.', 'راجع تقريرًا أو احذف فحصًا محفوظًا في أي وقت.')}</p></div></div>
      </div>
      <div className="fh-library">
        <div className="fh-library-title"><h2>{copy('Your reports', 'تقاريرك')}</h2><span>{copy('Most recent first', 'الأحدث أولًا')}</span></div>
        <div className="fh-filters">
          <label className="fh-search"><Search size={18}/><input aria-label={copy('Search scans', 'البحث في الفحوصات')} placeholder={copy('Search an email, URL or target…', 'ابحث عن إيميل أو رابط أو هدف…')} value={searchQuery} onChange={e => {setSearchQuery(e.target.value);setCurrentPage(1)}} /></label>
          <label className="fh-select"><Filter size={15}/><select aria-label={copy('Tool filter', 'تصفية الأداة')} value={typeFilter} onChange={e => {setTypeFilter(e.target.value);setCurrentPage(1)}}>{filterTypes.map(type => <option key={type} value={type}>{type === 'all' ? copy('All tools', 'كل الأدوات') : getTypeLabel(type)}</option>)}</select></label>
          <select className="fh-risk-filter" aria-label={copy('Risk filter', 'تصفية الخطورة')} value={riskFilter} onChange={e => {setRiskFilter(e.target.value);setCurrentPage(1)}}>{filterRisks.map(value => <option key={value} value={value}>{value === 'all' ? copy('All risk levels', 'كل مستويات الخطورة') : riskLabel(value)}</option>)}</select>
        </div>
        {filtered && <div className="fh-filter-note"><span>{filteredScans.length} {copy('matching checks', 'فحوصات مطابقة')}</span><button onClick={clearFilters}>{copy('Clear filters', 'مسح الفلاتر')}</button></div>}
        {error && <div className="fh-error" role="alert">{error}<button onClick={fetchScans}>{copy('Try again', 'حاول مجددًا')}</button></div>}
        {loading ? <div className="fh-empty" role="status"><Database size={30}/><h3>{copy('Loading your history…', 'جارٍ تحميل سجلك…')}</h3></div> : !filteredScans.length ? <div className="fh-empty"><Database size={32}/><h3>{error ? copy('History unavailable', 'السجل غير متاح') : filtered ? copy('No matching checks', 'لا توجد فحوصات مطابقة') : copy('Your story starts with a check.', 'ابدأ بفحصك الأول.')}</h3><p>{error ? copy('Retry to retrieve your saved checks.', 'حاول مجددًا لاسترجاع فحوصاتك.') : filtered ? copy('Try another search or clear your filters.', 'جرّب بحثًا آخر أو امسح الفلاتر.') : copy('Your saved checks will appear here after you use a tool.', 'ستظهر فحوصاتك المحفوظة هنا بعد استخدام إحدى الأدوات.')}</p></div> : <>
          <div className="fh-columns" aria-hidden="true"><span>{copy('CHECK / TARGET', 'الفحص / الهدف')}</span><span>{copy('RISK / SCORE', 'الخطورة / النتيجة')}</span><span>{copy('DATE', 'التاريخ')}</span><span>{copy('REPORT', 'التقرير')}</span></div>
          <div className="fh-rows">{currentScans.map(scan => <article key={scan.id} className="fh-row">
            <div className="fh-target"><span className="fh-icon">{getIcon(scan.type)}</span><div><b dir="auto">{scan.target}</b><span>{getTypeLabel(scan.type)}</span></div></div>
            <div className="fh-risk"><span className={'fh-badge fh-' + risk(scan)}>{riskLabel(risk(scan))}</span>{typeof scan.securityScore === 'number' && <small>{scan.securityScore}<span> / 100</span></small>}</div>
            <time dateTime={scan.createdAt.toISOString()}>{scan.createdAt.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {day:'numeric', month:'short',year:'numeric'})}<small>{scan.createdAt.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', {hour:'2-digit',minute:'2-digit'})}</small></time>
            <div className="fh-actions"><button onClick={() => setSelectedReport(scan)}><FileText size={15}/>{copy('Report', 'التقرير')}</button><button className="fh-delete" aria-label={copy('Delete check: ', 'حذف الفحص: ') + scan.target} disabled={deleting === scan.id} onClick={() => handleDelete(scan.id)}><Trash2 size={16}/></button></div>
          </article>)}</div>
        </>}
        {!loading && filteredScans.length > 0 && <footer className="fh-pagination"><span>{copy('Showing', 'عرض')} {(page-1)*itemsPerPage+1}–{Math.min(page*itemsPerPage, filteredScans.length)} / {filteredScans.length}</span><div><button aria-label={copy('Previous page', 'الصفحة السابقة')} disabled={page === 1} onClick={() => setCurrentPage(page-1)}><ChevronLeft size={18}/></button><span>{page} / {totalPages}</span><button aria-label={copy('Next page', 'الصفحة التالية')} disabled={page === totalPages} onClick={() => setCurrentPage(page+1)}><ChevronRight size={18}/></button></div></footer>}
      </div>
      <p className="fh-footnote">{copy('Results reflect the information available at the time of each check.', 'تعكس النتائج المعلومات المتاحة وقت إجراء كل فحص.')}</p>
      {selectedReport && <IntelligenceReport scan={selectedReport as any} onClose={() => setSelectedReport(null)}/>}
    </section>
  );
}

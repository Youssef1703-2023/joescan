import { useState, useEffect, useId } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { History, ChevronDown, ArrowUpRight } from 'lucide-react';
import '../styles/focus-recent-scans.css';

interface ScanRecord { id: string; target: string; riskLevel: string; securityScore?: number; createdAt: Date | null; }
interface Props { scanType: string; refreshKey?: number; }

export default function MiniHistory({ scanType, refreshKey = 0 }: Props) {
  const { lang } = useLanguage();
  const copy = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [retry, setRetry] = useState(0);
  const listId = useId();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    let active = true;
    setRecords([]); setExpanded(false); setFailed(false);
    if (!uid) { setLoading(false); return; }
    setLoading(true);
    const fetchHistory = async () => {
      try {
        const q = query(collection(db, 'scans'), where('userId', '==', uid), where('type', '==', scanType), orderBy('createdAt', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(item => {
          const data = item.data();
          const date = data.createdAt?.toDate?.();
          return {
            id: item.id,
            target: scanType === 'password' ? 'Password check' : String(data.target || data.emailScanned || 'Unknown target'),
            riskLevel: ['low','medium','high'].includes(String(data.riskLevel).toLowerCase()) ? String(data.riskLevel).toLowerCase() : 'unknown',
            securityScore: typeof data.securityScore === 'number' && Number.isFinite(data.securityScore) ? data.securityScore : undefined,
            createdAt: date instanceof Date && Number.isFinite(date.getTime()) ? date : null,
          };
        });
        if (active) setRecords(results);
      } catch { if (active) setFailed(true); }
      finally { if (active) setLoading(false); }
    };
    void fetchHistory();
    return () => { active = false; };
  }, [scanType, refreshKey, uid, retry]);

  if (!uid) return null;
  const riskLabel = (risk: string) => ({high:copy('High','مرتفع'),medium:copy('Medium','متوسط'),low:copy('Low','منخفض'),unknown:copy('Not assessed','غير مُقيّم')})[risk];
  return <section className="focus-recent" dir={lang === 'ar' ? 'rtl' : 'ltr'} aria-label={copy('Recent scans','الفحوصات الأخيرة')}>
    <header><div><History size={17}/><h3>{copy('Recent scans','الفحوصات الأخيرة')}</h3></div><a href="/history">{copy('View history','عرض السجل')}<ArrowUpRight size={14}/></a></header>
    {loading ? <p className="fr-state" role="status">{copy('Loading saved checks…','جارٍ تحميل الفحوصات…')}</p> : failed ? <div className="fr-state" role="alert">{copy('Recent checks could not be loaded.','تعذر تحميل الفحوصات الأخيرة.')}<button onClick={()=>setRetry(value=>value+1)}>{copy('Try again','حاول مجددًا')}</button></div> : records.length === 0 ? <p className="fr-state">{copy('Your saved checks will appear here.','ستظهر فحوصاتك المحفوظة هنا.')}</p> : <>
      <div id={listId} className="fr-list">{records.slice(0, expanded ? 5 : 3).map(record=><article key={record.id} className="fr-row"><div className="fr-target"><span className="fr-dot"/><div><strong dir="auto">{record.target}</strong><time dateTime={record.createdAt?.toISOString()}>{record.createdAt ? record.createdAt.toLocaleString(lang, {dateStyle:'medium', timeStyle:'short'}) : copy('Date unavailable','التاريخ غير متاح')}</time></div></div><div className="fr-result"><span className={'fr-risk fr-' + record.riskLevel}>{riskLabel(record.riskLevel)}</span>{record.securityScore !== undefined && <span className="fr-score">{record.securityScore}<small> / 100</small></span>}</div></article>)}</div>
      {records.length > 3 && <button className="fr-expand" aria-expanded={expanded} aria-controls={listId} onClick={()=>setExpanded(value=>!value)}>{expanded ? copy('Show less','عرض أقل') : copy('Show '+(records.length-3)+' more','عرض '+(records.length-3)+' إضافية')}<ChevronDown size={14} style={{transform:expanded?'rotate(180deg)':undefined}}/></button>}
    </>}
  </section>;
}

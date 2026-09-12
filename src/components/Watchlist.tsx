import React, { useState, useEffect, useRef } from 'react';
import '../styles/focus-watchlist.css';
import { Target, Plus, Trash2, AlertTriangle, ShieldCheck, Activity, Globe, Mail, Smartphone, Wifi, RefreshCw, Clock, Info } from 'lucide-react';
import { db, auth, getUserTier, SubscriptionTier } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  fetchWatchlistState,
  syncWatchlist,
  sweepWatchlistNow,
  TargetStatus,
  WatchlistFinding,
  WatchlistTargetType,
  WatchlistFrequency,
  SyncTargetInput,
} from '../lib/watchlist';

interface WatchlistTarget {
  id: string;
  type: WatchlistTargetType;
  value: string;
  status: TargetStatus;
  lastChecked: Date | null;
  lastError: string | null;
  threatDetails?: string;
  nextDueAt?: number | null;
  schedule?: {
    frequency: WatchlistFrequency;
    time?: string;
    day?: string;
  };
}

const TIER_TARGET_LIMITS: Record<SubscriptionTier, number> = {
  free: 1,
  pro: 50,
  enterprise: 200,
};

export default function Watchlist() {
  const { lang } = useLanguage();
  const copy = (en: string, ar: string) => lang === 'ar' ? ar : en;
  const [runtimeUnavailable, setRuntimeUnavailable] = useState(false);
  const [search, setSearch] = useState('');
  const { notifications, addNotification } = useNotifications();

  const [targets, setTargets] = useState<WatchlistTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<SubscriptionTier>('free');
  const [lastSweptAt, setLastSweptAt] = useState<Date | null>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Add new target state
  const [isAdding, setIsAdding] = useState(false);
  const [newTargetValue, setNewTargetValue] = useState('');
  const [newTargetType, setNewTargetType] = useState<WatchlistTargetType>('ip');

  // Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleFreq, setScheduleFreq] = useState<WatchlistFrequency>('daily');
  const [scheduleTime, setScheduleTime] = useState('12:00');
  const [scheduleDay, setScheduleDay] = useState('Monday');

  const processedFindingIdsRef = useRef<Set<string>>(new Set());

  const fetchWatchlist = async () => {
    if (!auth.currentUser) { setLoading(false); setErrorMessage('Sign in to view your watchlist.'); return; }
    setLoading(true);
    setErrorMessage('');
    try {
      // 1. Fetch user tier
      const tier = await getUserTier(auth.currentUser.uid);
      setUserTier(tier);

      // 2. Fetch user's Firestore watchlist docs (source of user-owned IDs & list)
      const q = query(
        collection(db, 'watchlist'),
        where('userId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const firestoreItems = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as any[];

      // 3. Fetch authoritative DO runtime state
      let doState: any = null;
      try {
        doState = await fetchWatchlistState();
        if (doState.lastSweptAt) {
          setLastSweptAt(new Date(doState.lastSweptAt));
        }
      } catch (doErr) {
        setRuntimeUnavailable(true);
      }

      const doTargetsMap = new Map<string, any>();
      if (doState && Array.isArray(doState.targets)) {
        for (const dt of doState.targets) {
          doTargetsMap.set(dt.id, dt);
          // Also index by type:value as fallback
          doTargetsMap.set(`${dt.type}:${dt.value}`, dt);
        }
      }

      // 4. Merge Firestore list with DO runtime state
      const mergedTargets: WatchlistTarget[] = firestoreItems.map(item => {
        const doInfo = doTargetsMap.get(item.id) || doTargetsMap.get(`${item.type}:${item.value}`);

        let targetStatus: TargetStatus = 'evaluating';
        if (item.type === 'email') {
          targetStatus = 'on_demand';
        } else if (item.type === 'phone') {
          targetStatus = 'unsupported';
        } else if (doInfo && doInfo.status) {
          targetStatus = doInfo.status;
        }

        let lastChecked: Date | null = null;
        if (doInfo && doInfo.lastChecked) {
          lastChecked = new Date(doInfo.lastChecked);
        }

        return {
          id: item.id,
          type: item.type,
          value: item.value,
          status: targetStatus,
          lastChecked,
          lastError: doInfo?.lastError || null,
          threatDetails: doInfo?.threatDetails || undefined,
          nextDueAt: doInfo?.nextDueAt || null,
          schedule: item.schedule || { frequency: 'daily' },
        };
      });

      setTargets(mergedTargets);

      // 5. In-app notifications for findings
      if (doState && Array.isArray(doState.findings)) {
        for (const finding of doState.findings as WatchlistFinding[]) {
          if (!processedFindingIdsRef.current.has(finding.id)) {
            processedFindingIdsRef.current.add(finding.id);

            // Check if notification already exists in context
            const alreadyExists = notifications.some(n => n.message.includes(finding.detail));
            if (!alreadyExists) {
              const notifType = finding.severity === 'critical' || finding.severity === 'high' ? 'alert' : 'info';
              addNotification({
                title: `Watchlist Finding: ${finding.kind.replace(/_/g, ' ').toUpperCase()}`,
                message: finding.detail,
                type: notifType,
              }).catch(err => console.warn('Could not add notification:', err));
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching watchlist:', err);
      setErrorMessage(err?.message || 'Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleInitiateAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetValue.trim() || !auth.currentUser) return;
    setErrorMessage('');

    const maxAllowed = TIER_TARGET_LIMITS[userTier] || 1;
    if (targets.length >= maxAllowed) {
      setErrorMessage(
        `Target limit reached: ${userTier.toUpperCase()} tier is limited to ${maxAllowed} target(s). Upgrade for more.`
      );
      setIsScheduleModalOpen(true);
      return;
    }

    setIsScheduleModalOpen(true);
  };

  const confirmAddTarget = async () => {
    try {
      setErrorMessage('');
      const maxAllowed = TIER_TARGET_LIMITS[userTier] || 1;
      if (targets.length >= maxAllowed) {
        throw new Error(
          `Target limit reached: ${userTier.toUpperCase()} tier is limited to ${maxAllowed} target(s). Upgrade to JoeScan Pro for up to 50 targets.`
        );
      }

      setIsAdding(true);
      if (!auth.currentUser) {
        throw new Error('User not authenticated.');
      }

      const tempId = `tgt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newTargetInput: SyncTargetInput = {
        id: tempId,
        type: newTargetType,
        value: newTargetValue.trim(),
        frequency: scheduleFreq,
        scheduleTime: scheduleTime,
        scheduleDay: scheduleFreq === 'weekly' ? scheduleDay : undefined,
      };

      // 1. Prepare sync array with existing targets + new target
      const existingSyncInputs: SyncTargetInput[] = targets.map(t => ({
        id: t.id,
        type: t.type,
        value: t.value,
        frequency: t.schedule?.frequency || 'daily',
        scheduleTime: t.schedule?.time,
        scheduleDay: t.schedule?.day,
      }));

      const fullSyncList = [...existingSyncInputs, newTargetInput];

      // 2. Await DO sync FIRST (authoritative rejection on limit / invalid / stale)
      await syncWatchlist(fullSyncList);

      // 3. Write to Firestore only after DO accepted
      const firestoreData = {
        userId: auth.currentUser.uid,
        type: newTargetType,
        value: newTargetValue.trim(),
        createdAt: serverTimestamp(),
        lastConfirmedAt: Date.now(),
        schedule: {
          frequency: scheduleFreq,
          time: scheduleTime || '12:00',
          day: scheduleFreq === 'weekly' ? scheduleDay : null,
        },
      };

      const docRef = await addDoc(collection(db, 'watchlist'), firestoreData);

      // Re-sync with actual Firestore ID for consistency
      newTargetInput.id = docRef.id;
      const updatedFullList = [...existingSyncInputs, newTargetInput];
      await syncWatchlist(updatedFullList).catch(() => {});

      setNewTargetValue('');
      setIsScheduleModalOpen(false);

      // Reload merged state
      await fetchWatchlist();
    } catch (err: any) {
      console.error('Error adding target:', err);
      setErrorMessage(err?.message || 'Failed to add target.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setLoading(true);
      // 1. Prepare remaining targets list for DO sync
      const remainingSyncInputs: SyncTargetInput[] = targets
        .filter(t => t.id !== id)
        .map(t => ({
          id: t.id,
          type: t.type,
          value: t.value,
          frequency: t.schedule?.frequency || 'daily',
          scheduleTime: t.schedule?.time,
          scheduleDay: t.schedule?.day,
        }));

      // 2. Await DO mutation
      await syncWatchlist(remainingSyncInputs);

      // 3. Delete from Firestore
      await deleteDoc(doc(db, 'watchlist', id));

      // 4. Update local state
      setTargets(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      console.error('Error deleting target:', err);
      setErrorMessage(err?.message || 'Failed to delete target');
    } finally {
      setLoading(false);
    }
  };

  const handleSweepNow = async () => {
    try {
      setIsSweeping(true);
      setErrorMessage('');
      await sweepWatchlistNow();
      await fetchWatchlist();
    } catch (err: any) {
      console.error('Sweep error:', err);
      setErrorMessage(err?.message || 'Sweep execution failed');
    } finally {
      setIsSweeping(false);
    }
  };

  const getIcon = (type: WatchlistTargetType) => {
    switch (type) {
      case 'ip':
        return <Wifi className="w-5 h-5 text-cyan-500" />;
      case 'domain':
        return <Globe className="w-5 h-5 text-purple-500" />;
      case 'email':
        return <Mail className="w-5 h-5 text-green-500" />;
      case 'phone':
        return <Smartphone className="w-5 h-5 text-blue-500" />;
      default:
        return <Target className="w-5 h-5 text-text-main" />;
    }
  };


  const scheduled = (target: WatchlistTarget) => target.type === 'ip' || target.type === 'domain';
  const statusLabel = (target: WatchlistTarget) => {
    if (target.type === 'email') return copy('On demand', 'عند الطلب');
    if (target.type === 'phone') return copy('Not supported', 'غير مدعوم');
    if (runtimeUnavailable) return copy('Status unavailable', 'الحالة غير متاحة');
    return ({threat_detected:copy('Needs attention','تحتاج مراجعة'),baseline_established:copy('Baseline recorded','تم تسجيل الحالة الأساسية'),clean:copy('No new findings','لا نتائج جديدة'),monitoring:copy('Monitoring','قيد المتابعة'),stale_unconfirmed:copy('Confirmation expired','انتهى التأكيد'),evaluating:copy('Awaiting check','بانتظار الفحص')} as Record<string,string>)[target.status] || copy('Not assessed','غير مُقيّم');
  };
  const date = (value: Date | null) => value ? value.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Cairo'}) : copy('Not checked yet','لم يُفحص بعد');
  const visibleTargets = targets.filter(target => target.value.toLowerCase().includes(search.toLowerCase()));
  const addingScheduled = newTargetType === 'ip' || newTargetType === 'domain';
  const busy = loading || isSweeping || isAdding;
  return <section className="focus-watchlist" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <header className="fw-header"><div><span className="fw-eyebrow">JOESCAN / {copy('YOUR WORKSPACE','مساحة عملك')}</span><h1>{copy('Live watchlist.','قائمة المتابعة.')}</h1><p>{copy('Keep an eye on what matters. Review changes to your IP addresses and domains in one place.','تابع ما يهمك. راجع التغييرات في عناوين IP والنطاقات من مكان واحد.')}</p></div><button className="fw-secondary" onClick={fetchWatchlist} disabled={busy}><RefreshCw size={16}/>{copy('Refresh status','تحديث الحالة')}</button></header>
    <div className="fw-summary"><div><span>{copy('Saved items','عناصر محفوظة')}</span><strong>{loading ? '—' : targets.length}<small>/ {TIER_TARGET_LIMITS[userTier]}</small></strong><p>{userTier} {copy('plan','خطة')}</p></div><div><span>{copy('Needs attention','تحتاج مراجعة')}</span><strong className="fw-warm">{loading || runtimeUnavailable ? '—' : targets.filter(t => t.status === 'threat_detected').length}</strong><p>{copy('Review the latest findings','راجع أحدث النتائج')}</p></div><div className="fw-last"><Clock size={21}/><div><span>{copy('Last sweep','آخر فحص')}</span><b>{runtimeUnavailable ? copy('Unavailable','غير متاح') : date(lastSweptAt)}</b><p>{copy('Schedule & times: Africa/Cairo','الجدولة والتوقيت: أفريقيا / القاهرة')}</p></div></div></div>
    {errorMessage && <div className="fw-notice fw-error" role="alert">{errorMessage}</div>}
    {runtimeUnavailable && <div className="fw-notice" role="status">{copy('Your saved items are available, but current monitoring status could not be retrieved. Refresh to try again.','عناصرك المحفوظة متاحة، لكن تعذر استرجاع حالة المتابعة الحالية. جرّب التحديث.')}</div>}
    <div className="fw-layout"><aside className="fw-add"><div className="fw-add-icon"><Plus size={23}/></div><h2>{copy('Add to your watchlist','أضف لقائمة المتابعة')}</h2><p>{copy('Choose an item, then set how often to check it.','اختر عنصرًا، ثم حدد موعد فحصه.')}</p>
      <form onSubmit={handleInitiateAdd}><label htmlFor="fw-type">{copy('Item type','نوع العنصر')}</label><select id="fw-type" disabled={isScheduleModalOpen || busy} value={newTargetType} onChange={e=>setNewTargetType(e.target.value as WatchlistTargetType)}><option value="ip">IPv4 address</option><option value="domain">Domain</option><option value="email">Email · On demand</option><option value="phone" disabled>Phone · Not supported</option></select><label htmlFor="fw-value">{copy('Address or identifier','العنوان أو المعرّف')}</label><input id="fw-value" type={newTargetType === 'email' ? 'email' : 'text'} required disabled={isScheduleModalOpen || busy} value={newTargetValue} onChange={e=>setNewTargetValue(e.target.value)} placeholder={newTargetType === 'ip' ? 'e.g. 8.8.8.8' : newTargetType === 'domain' ? 'e.g. example.com' : 'you@example.com'}/>
      {!isScheduleModalOpen && <button className="fw-primary" disabled={busy || !newTargetValue.trim()} type="submit"><Plus size={16}/>{copy('Continue','متابعة')}</button>}</form>
      {isScheduleModalOpen && <div className="fw-schedule"><h3>{addingScheduled ? copy('Choose your schedule','اختر الجدول') : copy('Save for on-demand checks','احفظ للفحص عند الطلب')}</h3>{addingScheduled ? <><label htmlFor="fw-frequency">{copy('Frequency','التكرار')}</label><select id="fw-frequency" disabled={isAdding} value={scheduleFreq} onChange={e=>setScheduleFreq(e.target.value as WatchlistFrequency)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select>{scheduleFreq === 'weekly' && <><label htmlFor="fw-day">{copy('Day','اليوم')}</label><select id="fw-day" disabled={isAdding} value={scheduleDay} onChange={e=>setScheduleDay(e.target.value)}>{['Monday','Wednesday','Friday','Sunday'].map(day=><option key={day}>{day}</option>)}</select></>}<label htmlFor="fw-time">{copy('Time · Africa/Cairo','الوقت · أفريقيا / القاهرة')}</label><input id="fw-time" type="time" required disabled={isAdding} value={scheduleTime} onChange={e=>setScheduleTime(e.target.value)}/></> : <p>{copy('Email checks run on demand. Saving an email does not enable background monitoring.','فحص الإيميل يتم عند الطلب. حفظ الإيميل لا يفعّل متابعة في الخلفية.')}</p>}<div className="fw-confirm"><button className="fw-secondary" disabled={isAdding} onClick={()=>setIsScheduleModalOpen(false)}>{copy('Back','رجوع')}</button><button className="fw-primary" disabled={isAdding || (addingScheduled && !scheduleTime)} onClick={confirmAddTarget}>{isAdding ? copy('Saving…','جارٍ الحفظ…') : copy('Save item','حفظ العنصر')}</button></div></div>}
      <div className="fw-explainer"><Info size={16}/><p>{copy('IP and domain checks can be scheduled. Emails are checked on demand; phone monitoring is not supported.','يمكن جدولة فحص IP والنطاقات. الإيميل يُفحص عند الطلب، ومتابعة الهاتف غير مدعومة.')}</p></div>
    </aside><div className="fw-list"><div className="fw-list-heading"><div><h2>{copy('Your watchlist','قائمة متابعتك')}</h2><p>{copy('Changes worth a closer look.','تغييرات تستحق نظرة أقرب.')}</p></div><button className="fw-secondary" onClick={handleSweepNow} disabled={busy || !targets.some(scheduled)}><Activity size={16}/>{isSweeping ? copy('Checking…','جارٍ الفحص…') : copy('Check now','افحص الآن')}</button></div>
      <input className="fw-search" aria-label={copy('Search watchlist','البحث في قائمة المتابعة')} placeholder={copy('Search your saved items…','ابحث في العناصر المحفوظة…')} value={search} onChange={e=>setSearch(e.target.value)}/>
      {loading ? <div className="fw-empty" role="status"><RefreshCw size={28}/><h3>{copy('Loading your watchlist…','جارٍ تحميل القائمة…')}</h3></div> : !visibleTargets.length ? <div className="fw-empty"><Target size={35}/><h3>{errorMessage ? copy('Watchlist unavailable','القائمة غير متاحة') : search ? copy('No matching items','لا توجد عناصر مطابقة') : copy('Start with one important item.','ابدأ بعنصر يهمك.')}</h3><p>{errorMessage ? copy('Refresh status to try loading again.','حدّث الحالة لإعادة المحاولة.') : search ? copy('Try another address or clear your search.','جرّب عنوانًا آخر أو امسح البحث.') : copy('Add an IP address or domain to follow changes over time.','أضف عنوان IP أو نطاقًا لمتابعة التغييرات مع الوقت.')}</p></div> : visibleTargets.map(target=><article className={'fw-card ' + (target.status === 'threat_detected' && !runtimeUnavailable ? 'fw-attention' : '')} key={target.id}><div className="fw-card-head"><span className="fw-item-icon">{getIcon(target.type)}</span><div><h3 dir="auto">{target.value}</h3><span>{target.type.toUpperCase()} · {scheduled(target) ? (target.schedule?.frequency === 'weekly' ? copy('Weekly checks','فحوصات أسبوعية') : copy('Daily checks','فحوصات يومية')) : copy('Saved item','عنصر محفوظ')}</span></div><button aria-label={copy('Remove item: ','حذف العنصر: ') + target.value} disabled={busy} onClick={()=>handleDelete(target.id)}><Trash2 size={16}/></button></div><div className="fw-card-state"><span className="fw-badge">{statusLabel(target)}</span>{scheduled(target) && <span>{copy('Last checked: ','آخر فحص: ')}{runtimeUnavailable ? '—' : date(target.lastChecked)}</span>}</div>{scheduled(target) && !!target.nextDueAt && !runtimeUnavailable && <p className="fw-next">{copy('Next check: ','الفحص التالي: ')}{date(new Date(target.nextDueAt))}</p>}{target.type === 'email' && <p className="fw-next">{copy('On-demand checks only. No scheduled background monitoring.','فحص عند الطلب فقط. لا توجد متابعة مجدولة في الخلفية.')}</p>}{target.type === 'phone' && <p className="fw-next">{copy('Monitoring is not supported for this item.','المتابعة غير مدعومة لهذا العنصر.')}</p>}{target.threatDetails && <p className="fw-detail">{target.threatDetails}</p>}{target.lastError && <p className="fw-detail fw-warm">{copy('Last check issue: ','مشكلة آخر فحص: ')}{target.lastError}</p>}</article>)}
      <p className="fw-footnote">{copy('Scheduled checks run periodically. An unchanged result is not a guarantee of security.','تُجرى الفحوصات المجدولة دوريًا. عدم تغير النتيجة ليس ضمانًا للأمان.')}</p>
    </div></div>
  </section>;
}

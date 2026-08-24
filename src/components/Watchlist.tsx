import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  const { lang, t } = useLanguage();
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
    if (!auth.currentUser) return;
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
        console.warn('Could not fetch DO state, falling back to local metadata:', doErr);
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

  const renderStatusBadge = (target: WatchlistTarget) => {
    if (target.type === 'email') {
      return (
        <div className="px-3 py-1 rounded flex items-center gap-1.5 text-[10px] font-mono tracking-wider uppercase font-medium bg-bg-elevated text-text-dim border border-border-subtle">
          <Info className="w-3 h-3 text-text-dim" />
          On Demand (Client)
        </div>
      );
    }

    if (target.type === 'phone') {
      return (
        <div className="px-3 py-1 rounded flex items-center gap-1.5 text-[10px] font-mono tracking-wider uppercase font-medium bg-bg-elevated text-text-dim border border-border-subtle">
          <Info className="w-3 h-3 text-amber-500" />
          Unsupported
        </div>
      );
    }

    switch (target.status) {
      case 'threat_detected':
        return (
          <div className="px-3 py-1.5 rounded flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase font-bold bg-error/10 text-error border border-error/50 glow-low-error">
            <AlertTriangle className="w-3 h-3" />
            Threat Detected
          </div>
        );
      case 'baseline_established':
        return (
          <div className="px-3 py-1.5 rounded flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <ShieldCheck className="w-3 h-3" />
            Baseline Set
          </div>
        );
      case 'clean':
      case 'monitoring':
        return (
          <div className="px-3 py-1.5 rounded flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase font-bold bg-accent/10 text-accent border border-accent/20">
            <ShieldCheck className="w-3 h-3" />
            Clean / Monitored
          </div>
        );
      case 'stale_unconfirmed':
        return (
          <div className="px-3 py-1.5 rounded flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            Lease Expired
          </div>
        );
      case 'evaluating':
      default:
        return (
          <div className="px-3 py-1.5 rounded flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase font-bold bg-bg-elevated text-text-dim border border-border-subtle">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Evaluating
          </div>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="glass-card p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 justify-between relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-error/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-bg-surface border border-border-subtle flex items-center justify-center shrink-0 relative">
            <div className="absolute inset-0 rounded-2xl border border-error/50 animate-pulse-glow" style={{ animationDuration: '3s' }} />
            <Target className="w-10 h-10 text-error" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black mb-2" data-text={lang === 'ar' ? 'المراقبة المجدولة للتهديدات' : 'Scheduled Threat Watchlist'}>
              {lang === 'ar' ? 'المراقبة المجدولة للتهديدات' : 'Scheduled Threat Watchlist'}
            </h1>
            <p className="text-text-dim max-w-xl text-sm leading-relaxed">
              {lang === 'ar'
                ? 'مسوحات يومية مجدولة لعناوين IP والنطاقات للكشف التلقائي عن المنافذ المفتوحة وتغيرات DNS وانتهاء الصلاحية. تفحص الإيميلات عند الطلب.'
                : 'Automated daily scheduled sweeps for IP and domain assets to detect newly opened ports, DNS changes, and domain expiry. Email breach checks run on demand.'}
            </p>
          </div>
        </div>

        {/* Global Schedule State Badge */}
        <div className="relative z-10 flex flex-col items-end gap-2 text-xs font-mono">
          <div className="flex items-center gap-2 bg-bg-surface/80 border border-border-subtle px-3 py-1.5 rounded-lg text-text-dim">
            <Clock className="w-3.5 h-3.5 text-accent" />
            <span>Last Swept: {lastSweptAt ? lastSweptAt.toLocaleString() : 'Never checked'}</span>
          </div>
          <div className="text-[10px] text-text-dim">Schedule timezone: Africa/Cairo</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Target Panel */}
        <div className="glass-card p-6 h-fit sticky top-24">
          <h3 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-4">Command: Add Target</h3>
          <form onSubmit={handleInitiateAdd} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-text-dim">{lang === 'ar' ? 'نوع الهدف' : 'Asset Type'}</label>
              <select
                value={newTargetType}
                onChange={e => setNewTargetType(e.target.value as WatchlistTargetType)}
                className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              >
                <option value="ip">IPv4 Address (Scheduled Daily)</option>
                <option value="domain">Domain Name (Scheduled Daily)</option>
                <option value="email">Email Address (On-Demand Only)</option>
                <option value="phone">Phone Number (Unsupported)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-text-dim">{lang === 'ar' ? 'البيانات' : 'Identifier'}</label>
              <input
                type="text"
                required
                value={newTargetValue}
                onChange={e => setNewTargetValue(e.target.value)}
                placeholder={newTargetType === 'ip' ? 'e.g. 192.168.1.1' : newTargetType === 'domain' ? 'e.g. example.com' : 'e.g. user@domain.com'}
                className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isAdding || !newTargetValue.trim()}
              className="w-full btn-glow py-3 rounded-lg flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> {lang === 'ar' ? 'إضافة للمراقبة' : 'DEPLOY SENSOR'}
            </button>
          </form>
        </div>

        {/* Watchlist Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2 px-2">
            <div className="flex items-center gap-2 text-xs font-mono text-text-dim tracking-widest">
              <Activity className="w-4 h-4 text-accent animate-pulse" />
              {targets.length} / {TIER_TARGET_LIMITS[userTier]} {lang === 'ar' ? 'أهداف نشطة' : 'ACTIVE SENSORS'} ({userTier.toUpperCase()})
            </div>
            <button
              onClick={handleSweepNow}
              disabled={isSweeping || loading}
              className="flex items-center gap-2 text-xs font-mono hover:text-accent transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSweeping ? 'animate-spin' : ''}`} />
              {lang === 'ar' ? 'مسح الآن' : 'SWEEP ALL'}
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 bg-error/10 border border-error/50 text-error text-xs rounded-lg font-mono">
              {errorMessage}
            </div>
          )}

          <AnimatePresence>
            {targets.length === 0 && !loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-12 flex flex-col items-center justify-center text-center opacity-60">
                <Target className="w-16 h-16 text-text-dim mb-4" />
                <p className="font-mono text-sm uppercase tracking-widest">{lang === 'ar' ? 'لا يوجد أهداف مراقبة' : 'Sensor Array Empty'}</p>
                <p className="text-xs text-text-dim mt-2 max-w-sm">Deploy your first sensor by adding an asset to the watchlist.</p>
              </motion.div>
            )}

            {targets.map(target => (
              <motion.div
                key={target.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`glass-card p-4 border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-500 ${
                  target.status === 'threat_detected'
                    ? 'border-error shadow-[0_0_15px_rgba(255,0,0,0.15)] bg-error/5'
                    : target.status === 'evaluating'
                    ? 'border-accent/40 bg-accent/5'
                    : 'border-border-subtle/50 hover:border-border-subtle'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-bg-base border border-border-subtle flex items-center justify-center shrink-0">
                    {getIcon(target.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{target.value}</span>
                      <span className="text-[9px] uppercase tracking-widest bg-bg-elevated px-1.5 py-0.5 rounded text-text-dim">{target.type}</span>
                      {target.type === 'email' && (
                        <span className="text-[9px] text-text-dim italic">(checked on demand, not scheduled)</span>
                      )}
                      {target.type === 'phone' && (
                        <span className="text-[9px] text-amber-400 italic">(monitoring not supported)</span>
                      )}
                    </div>
                    <div className="text-[10px] text-text-dim font-mono tracking-widest uppercase mt-1 flex flex-wrap items-center gap-3">
                      <span>Checked: {target.lastChecked ? target.lastChecked.toLocaleString() : 'Never checked'}</span>
                      {target.nextDueAt && (target.type === 'ip' || target.type === 'domain') && (
                        <span>Next sweep: {new Date(target.nextDueAt).toLocaleTimeString()}</span>
                      )}
                      {target.threatDetails && (
                        <span className={`normal-case tracking-normal truncate max-w-[280px] block border-l pl-2 ${target.status === 'threat_detected' ? 'text-error border-error/30' : 'text-text-dim border-border-subtle'}`}>
                          {target.threatDetails}
                        </span>
                      )}
                      {target.lastError && (
                        <span className="text-amber-400 normal-case tracking-normal truncate max-w-[240px] block border-l border-amber-400/30 pl-2">
                          Error: {target.lastError}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0 justify-between sm:justify-end border-t sm:border-none border-border-subtle pt-3 sm:pt-0">
                  {/* Status Badge */}
                  {renderStatusBadge(target)}

                  <button onClick={() => handleDelete(target.id)} className="p-2 hover:bg-error/10 hover:text-error rounded transition-colors text-text-dim" title="Remove Sensor">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Schedule Configuration Modal */}
      <AnimatePresence>
        {isScheduleModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="glass-card max-w-md w-full p-6 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-accent/50" />
              <h2 className="text-xl font-bold mb-2 font-mono uppercase tracking-widest flex items-center gap-2">
                <Target className="w-5 h-5 text-accent" />
                Configure Sweep Schedule
              </h2>
              <p className="text-sm text-text-dim mb-4">
                Configure background sweep schedule for <span className="text-white font-bold">{newTargetValue}</span>.
              </p>

              {newTargetType === 'email' && (
                <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs rounded-lg">
                  Notice: Email breach monitoring runs on-demand from your browser to preserve free-tier rate allowances. Background scheduled sweeps are not active for emails.
                </div>
              )}

              {newTargetType === 'phone' && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-lg">
                  Notice: Automated phone monitoring is currently unsupported on the free tier.
                </div>
              )}

              {(newTargetType === 'ip' || newTargetType === 'domain') && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-text-dim">Frequency</label>
                    <select
                      value={scheduleFreq}
                      onChange={e => setScheduleFreq(e.target.value as WatchlistFrequency)}
                      className="w-full bg-bg-surface border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent outline-none"
                    >
                      <option value="daily">Daily Scheduled Sweep</option>
                      <option value="weekly">Weekly Scheduled Sweep</option>
                    </select>
                  </div>

                  <div className="flex gap-4">
                    {scheduleFreq === 'weekly' && (
                      <div className="space-y-1 flex-1">
                        <label className="text-[10px] font-mono uppercase text-text-dim">Day</label>
                        <select
                          value={scheduleDay}
                          onChange={e => setScheduleDay(e.target.value)}
                          className="w-full bg-bg-surface border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent outline-none"
                        >
                          <option value="Monday">Monday</option>
                          <option value="Wednesday">Wednesday</option>
                          <option value="Friday">Friday</option>
                          <option value="Sunday">Sunday</option>
                        </select>
                      </div>
                    )}
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-mono uppercase text-text-dim">Time (Africa/Cairo)</label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        className="w-full bg-bg-surface border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="mt-4 p-3 bg-error/10 border border-error/50 text-error text-xs rounded-lg font-mono">
                  ERROR: {errorMessage}
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="flex-1 py-3 bg-bg-elevated text-text-main rounded-lg text-sm font-bold uppercase hover:bg-bg-surface transition-colors border border-border-subtle hover:border-text-dim"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAddTarget}
                  disabled={isAdding}
                  className="flex-1 btn-glow py-3 rounded-lg text-sm font-bold uppercase disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAdding ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Confirm Deploy'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

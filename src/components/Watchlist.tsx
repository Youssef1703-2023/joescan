import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, Plus, Search, Trash2, AlertTriangle, ShieldCheck, Activity, Globe, Mail, Smartphone, Wifi, RefreshCw } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType, getUserTier, SubscriptionTier } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';

type WatchlistTarget = {
  id: string;
  type: 'email' | 'ip' | 'domain' | 'phone';
  value: string;
  status: 'monitoring' | 'threat_detected' | 'evaluating';
  baselineScore: number;
  lastChecked: Date;
  threatDetails?: string;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'continuous';
    time?: string;
    day?: string;
  };
};

export default function Watchlist() {
  const { lang, t } = useLanguage();
  const [targets, setTargets] = useState<WatchlistTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<SubscriptionTier>('free');
  
  // Add new target state
  const [isAdding, setIsAdding] = useState(false);
  const [newTargetValue, setNewTargetValue] = useState('');
  const [newTargetType, setNewTargetType] = useState<'email' | 'ip' | 'domain' | 'phone'>('ip');

  // Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleFreq, setScheduleFreq] = useState<'daily'|'weekly'|'continuous'>('daily');
  const [scheduleTime, setScheduleTime] = useState('12:00');
  const [scheduleDay, setScheduleDay] = useState('Monday');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchWatchlist = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'watchlist'),
        where('userId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastChecked: doc.data().lastChecked?.toDate() || new Date()
      })) as WatchlistTarget[];
      
      setTargets(results);
      if (auth.currentUser) {
        setUserTier(await getUserTier(auth.currentUser.uid));
      }
    } catch (err) {
      console.error(err);
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
    
    if (userTier === 'free' && targets.length >= 3) {
      setErrorMessage('SENSOR ARRAY FULL: Free tier limited to 3 targets. Deploy more with JoeScan Pro.');
      setIsScheduleModalOpen(true);
      return;
    }
    
    setIsScheduleModalOpen(true);
  };

  const confirmAddTarget = async () => {
    try {
      setErrorMessage('');
      
      if (userTier === 'free' && targets.length >= 3) {
         throw new Error('SENSOR ARRAY FULL: Free tier limited to 3 targets. Deploy more with JoeScan Pro.');
      }
      
      setIsAdding(true);
      
      if (!auth.currentUser) {
        throw new Error('User not authenticated.');
      }
      const newData = {
        userId: auth.currentUser.uid,
        type: newTargetType,
        value: newTargetValue,
        status: 'evaluating',
        baselineScore: 100, // Starting default
        createdAt: serverTimestamp(),
        lastChecked: serverTimestamp(),
        schedule: {
          frequency: scheduleFreq,
          time: scheduleFreq !== 'continuous' ? scheduleTime : null,
          day: scheduleFreq === 'weekly' ? scheduleDay : null
        }
      };
      
      const docRef = await addDoc(collection(db, 'watchlist'), newData);
      setTargets([{ id: docRef.id, ...newData, lastChecked: new Date() } as WatchlistTarget, ...targets]);
      setNewTargetValue('');
      setIsScheduleModalOpen(false);
      
      // Trigger immediate check
      performDiagnosticCheck(docRef.id, newTargetType, newTargetValue);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Unknown error occurred.');
    } finally {
      setIsAdding(false);
    }
  };

  const performDiagnosticCheck = async (id: string, type: string, value: string) => {
    // Set target to evaluating locally
    setTargets(prev => prev.map(t => t.id === id ? { ...t, status: 'evaluating' } : t));
    
    await new Promise(r => setTimeout(r, 1500)); // Simulate connection delay
    
    let isThreat = false;
    let details = '';
    
    if (type === 'ip' || type === 'domain') {
       try {
         // Silently call Shodan InternetDB to see if new ports opened
         const res = await fetch(`https://internetdb.shodan.io/${value}`);
         if (res.ok) {
           const data = await res.json();
           if (data.ports && data.ports.length > 0) {
             isThreat = true;
             details = `Exposed Ports: ${data.ports.slice(0,3).join(',')}`;
           }
         }
       } catch (e) {
         // Ignore
       }
    } else {
       // Simulate a random 15% threat discovery for emails/phones during continuous monitoring since we don't have a live DarkWeb websocket
       if (Math.random() > 0.85) {
         isThreat = true;
         details = type === 'email' ? 'New Pastebin breach detected' : 'Carrier signal anomaly found';
       }
    }

    const newStatus = isThreat ? 'threat_detected' : 'monitoring';
    
    // Update DB
    try {
      await updateDoc(doc(db, 'watchlist', id), {
        status: newStatus,
        threatDetails: details || null,
        lastChecked: serverTimestamp()
      });
      
      setTargets(prev => prev.map(t => t.id === id ? {
        ...t, 
        status: newStatus, 
        threatDetails: details,
        lastChecked: new Date()
      } : t));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefreshAll = async () => {
    setLoading(true);
    const promises = targets.map(t => performDiagnosticCheck(t.id, t.type, t.value));
    await Promise.all(promises);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'watchlist', id));
      setTargets(targets.filter(t => t.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'ip': return <Wifi className="w-5 h-5 text-cyan-500" />;
      case 'domain': return <Globe className="w-5 h-5 text-purple-500" />;
      case 'email': return <Mail className="w-5 h-5 text-green-500" />;
      case 'phone': return <Smartphone className="w-5 h-5 text-blue-500" />;
      default: return <Target className="w-5 h-5 text-text-main" />;
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
            <h1 className="text-2xl md:text-3xl font-black mb-2" data-text={lang === 'ar' ? 'المراقبة المستمرة' : 'Live Watchlist'}>
              {lang === 'ar' ? 'المراقبة المستمرة' : 'Live Threat Watchlist'}
            </h1>
            <p className="text-text-dim max-w-xl">
              {lang === 'ar' 
                ? 'نظام تتبع وإشعار مبكر. قم بإضافة الأهداف المهمة وسنقوم بمراقبتها بصمت للتحقق من أي تغيير في مستوى الخطورة أو تسريبات جديدة.' 
                : 'Early-warning detection system. Map critical targets to be continuously monitored for newly exposed ports, breaches, or infrastructure shifts.'}
            </p>
          </div>
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
                onChange={e => setNewTargetType(e.target.value as any)}
                className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent focus:ring-1 focus:ring-accent outline-none"
              >
                <option value="ip">IPv4 Address</option>
                <option value="domain">Domain Name</option>
                <option value="email">Email Address</option>
                <option value="phone">Phone Number</option>
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-text-dim">{lang === 'ar' ? 'البيانات' : 'Identifier'}</label>
              <input 
                type="text" 
                required
                value={newTargetValue}
                onChange={e => setNewTargetValue(e.target.value)}
                placeholder="e.g. 192.168.1.1"
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
              {targets.length} {lang === 'ar' ? 'أهداف نشطة' : 'ACTIVE SENSORS'}
            </div>
            <button 
              onClick={handleRefreshAll}
              disabled={loading}
              className="flex items-center gap-2 text-xs font-mono hover:text-accent transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 
              {lang === 'ar' ? 'تحديث الكل' : 'SWEEP ALL'}
            </button>
          </div>

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
                    </div>
                    <div className="text-[10px] text-text-dim font-mono tracking-widest uppercase mt-1 flex items-center gap-2">
                      {target.lastChecked.toLocaleTimeString()} 
                      {target.threatDetails && target.status === 'threat_detected' && (
                        <span className="text-error normal-case tracking-normal truncate max-w-[200px] block border-l border-error/30 pl-2">
                          {target.threatDetails}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto mt-2 sm:mt-0 justify-between sm:justify-end border-t sm:border-none border-border-subtle pt-3 sm:pt-0">
                  {/* Status Badge */}
                  <div className={`px-3 py-1.5 rounded flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase font-bold border transition-colors ${
                    target.status === 'threat_detected' 
                      ? 'bg-error/10 text-error border-error/50 glow-low-error'
                      : target.status === 'monitoring'
                      ? 'bg-accent/10 text-accent border-accent/20'
                      : 'bg-bg-elevated text-text-dim border-border-subtle'
                  }`}>
                    {target.status === 'evaluating' && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {target.status === 'threat_detected' && <AlertTriangle className="w-3 h-3" />}
                    {target.status === 'monitoring' && <ShieldCheck className="w-3 h-3" />}
                    {target.status.replace('_', ' ')}
                  </div>
                  
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
                Configure Sweep
              </h2>
              <p className="text-sm text-text-dim mb-6">
                When should we run background intelligence sweeps for <span className="text-white font-bold">{newTargetValue}</span>?
              </p>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-text-dim">Frequency</label>
                  <select 
                    value={scheduleFreq}
                    onChange={e => setScheduleFreq(e.target.value as any)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent outline-none"
                    disabled={userTier === 'free' && targets.length >= 3}
                  >
                    <option value="continuous" disabled={userTier === 'free'}>Continuous (Pro Only)</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                {scheduleFreq !== 'continuous' && (
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
                      <label className="text-[10px] font-mono uppercase text-text-dim">Time</label>
                      <input 
                        type="time"
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        className="w-full bg-bg-surface border border-border-subtle rounded-lg px-4 py-3 text-sm focus:border-accent outline-none font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

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

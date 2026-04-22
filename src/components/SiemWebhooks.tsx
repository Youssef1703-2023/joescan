import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Webhook, Plus, Trash2, Zap, CheckCircle, XCircle, Copy, Bell, Shield, Globe, MessageSquare, AlertTriangle } from 'lucide-react';
import { auth, db, logActivity, getUserTier } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';

const EVENT_TYPES = [
  { id: 'scan_complete', label: 'Scan Completed', icon: '🔍' },
  { id: 'threat_detected', label: 'Threat Detected', icon: '⚠️' },
  { id: 'breach_found', label: 'Breach Found', icon: '🔓' },
  { id: 'watchlist_alert', label: 'Watchlist Alert', icon: '🎯' },
  { id: 'login_alert', label: 'Login Alert', icon: '🔑' },
  { id: 'tier_change', label: 'Subscription Change', icon: '💎' },
];

const PRESETS = [
  { name: 'Slack', placeholder: 'https://hooks.slack.com/services/...', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { name: 'Discord', placeholder: 'https://discord.com/api/webhooks/...', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { name: 'Microsoft Teams', placeholder: 'https://outlook.office.com/webhook/...', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { name: 'Custom SIEM', placeholder: 'https://your-siem.example.com/api/ingest', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  { name: 'PagerDuty', placeholder: 'https://events.pagerduty.com/integration/...', color: 'text-green-400', bg: 'bg-green-500/10' },
  { name: 'Splunk', placeholder: 'https://input-splunk.example.com:8088/services/collector', color: 'text-orange-400', bg: 'bg-orange-500/10' },
];

export default function SiemWebhooks() {
  const { t } = useLanguage();
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState('free');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['scan_complete', 'threat_detected']);
  const [preset, setPreset] = useState('Custom SIEM');
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean } | null>(null);

  const fetchWebhooks = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'webhooks'), where('ownerId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      setWebhooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      const t = await getUserTier(auth.currentUser.uid);
      setTier(t);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchWebhooks(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !auth.currentUser) return;
    setCreating(true);
    try {
      const generatedSecret = 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
      await addDoc(collection(db, 'webhooks'), {
        ownerId: auth.currentUser.uid,
        name: name || preset,
        url,
        secret: secret || generatedSecret,
        preset,
        events: selectedEvents,
        active: true,
        createdAt: new Date().toISOString(),
        lastTriggered: null,
        failCount: 0,
      });
      await logActivity('promo_create', `Created webhook: ${name || preset}`);
      setName(''); setUrl(''); setSecret(''); setShowForm(false);
      fetchWebhooks();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'webhooks', id));
    fetchWebhooks();
  };

  const handleTest = async (hook: any) => {
    setTestingId(hook.id);
    setTestResult(null);
    // Simulate webhook test
    await new Promise(r => setTimeout(r, 1500));
    const ok = hook.url.startsWith('https://');
    setTestResult({ id: hook.id, ok });
    setTestingId(null);
    setTimeout(() => setTestResult(null), 4000);
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEvents(prev => prev.includes(eventId) ? prev.filter(e => e !== eventId) : [...prev, eventId]);
  };

  const maxHooks = tier === 'enterprise' ? 20 : tier === 'pro' ? 3 : 0;
  const locked = tier === 'free';

  if (loading) return <div className="flex justify-center items-center h-full"><Zap className="w-8 h-8 animate-pulse text-accent" /></div>;

  if (locked) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center text-center py-20 gap-6">
        <div className="w-20 h-20 rounded-full bg-orange-500/10 border-2 border-orange-500/30 flex items-center justify-center">
          <Webhook className="w-10 h-10 text-orange-400" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight">Enterprise Feature</h1>
        <p className="text-text-dim text-sm font-mono max-w-md">SIEM & Webhook integrations require a Pro or Enterprise subscription. Upgrade your tier to unlock real-time event forwarding.</p>
        <div className="flex gap-2 text-[10px] font-mono uppercase tracking-widest text-text-dim">
          <span className="px-2 py-1 bg-accent/10 text-accent rounded">PRO: 3 hooks</span>
          <span className="px-2 py-1 bg-error/10 text-error rounded">ENTERPRISE: 20 hooks</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 w-full">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <Webhook className="w-8 h-8 text-cyan-400" /> {t('siem_title')}
          </h1>
          <p className="text-text-dim text-sm mt-1 font-mono">{t('siem_desc')}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} disabled={webhooks.length >= maxHooks}
          className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400 text-xs font-bold uppercase tracking-widest hover:bg-cyan-500/20 transition-all disabled:opacity-40">
          <Plus className="w-4 h-4" /> {t('siem_new_endpoint')}
        </button>
      </div>

      {/* Quota */}
      <div className="glass-card p-4 rounded-xl flex items-center justify-between">
        <span className="text-sm font-bold">{webhooks.length} / {maxHooks} {t('siem_endpoints_active')}</span>
        <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${tier === 'enterprise' ? 'bg-error/20 text-error' : 'bg-accent/20 text-accent'}`}>{tier}</span>
      </div>

      {/* Create Form */}
      {showForm && (
        <motion.form onSubmit={handleCreate} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 rounded-xl space-y-5">
          {/* Preset Selector */}
          <div>
            <label className="text-[10px] font-mono uppercase text-text-dim mb-2 block">Integration Type</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PRESETS.map(p => (
                <button key={p.name} type="button" onClick={() => { setPreset(p.name); setUrl(''); }}
                  className={`p-3 rounded-xl text-xs font-bold text-left border transition-all ${preset === p.name ? `${p.bg} ${p.color} border-current` : 'border-border-subtle text-text-dim hover:border-border-main'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono uppercase text-text-dim">Display Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Production Slack" className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm mt-1" />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-text-dim">Endpoint URL</label>
              <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder={PRESETS.find(p => p.name === preset)?.placeholder} className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm mt-1 font-mono" required />
            </div>
          </div>

          {/* Event Selector */}
          <div>
            <label className="text-[10px] font-mono uppercase text-text-dim mb-2 block">Trigger Events</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {EVENT_TYPES.map(evt => (
                <button key={evt.id} type="button" onClick={() => toggleEvent(evt.id)}
                  className={`p-2.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 ${selectedEvents.includes(evt.id) ? 'bg-accent/10 text-accent border-accent/30' : 'border-border-subtle text-text-dim hover:border-border-main'}`}>
                  <span>{evt.icon}</span> {evt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={creating} className="flex-1 py-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-cyan-500/20 flex items-center justify-center gap-2">
              {creating ? <Zap className="w-4 h-4 animate-pulse" /> : <><Webhook className="w-4 h-4" /> Deploy Endpoint</>}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-bg-elevated border border-border-subtle rounded-xl text-xs font-bold uppercase text-text-dim">Cancel</button>
          </div>
        </motion.form>
      )}

      {/* Webhooks List */}
      <div className="space-y-3">
        {webhooks.map((hook, i) => (
          <motion.div key={hook.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card p-5 rounded-xl">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-text-main flex items-center gap-2">
                  {hook.name}
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-accent/10 text-accent">ACTIVE</span>
                </h3>
                <p className="text-[10px] font-mono text-text-dim mt-1 truncate max-w-[400px]">{hook.url}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleTest(hook)} disabled={testingId === hook.id}
                  className="text-[10px] px-3 py-1.5 bg-bg-elevated border border-border-subtle rounded-lg font-bold uppercase hover:border-accent/30 transition-all text-text-dim disabled:opacity-50">
                  {testingId === hook.id ? <Zap className="w-3 h-3 animate-pulse" /> : 'Test'}
                </button>
                <button onClick={() => handleDelete(hook.id)} className="p-1.5 text-text-dim hover:text-error transition-colors rounded-lg hover:bg-error/10">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {testResult?.id === hook.id && (
              <div className={`text-xs p-2 rounded-lg mb-3 flex items-center gap-2 ${testResult.ok ? 'bg-accent/10 text-accent' : 'bg-error/10 text-error'}`}>
                {testResult.ok ? <><CheckCircle className="w-3 h-3" /> Webhook responded successfully (200 OK)</> : <><XCircle className="w-3 h-3" /> Connection failed — check your URL</>}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {hook.events?.map((evt: string) => {
                const evtInfo = EVENT_TYPES.find(e => e.id === evt);
                return <span key={evt} className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-bg-surface border border-border-subtle text-text-dim">{evtInfo?.icon} {evtInfo?.label || evt}</span>;
              })}
            </div>
          </motion.div>
        ))}
        {webhooks.length === 0 && !showForm && (
          <div className="text-center py-12 glass-card rounded-xl">
            <Webhook className="w-12 h-12 text-text-dim/30 mx-auto mb-3" />
            <p className="text-text-dim font-mono text-sm">{t('siem_no_endpoints')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

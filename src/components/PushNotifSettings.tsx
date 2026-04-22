import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellOff, BellRing, Check, X, Shield, AlertTriangle, Mail, Key, Globe, Zap } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type NotifCategory = 'breach_alert' | 'watchlist_hit' | 'scan_complete' | 'security_update' | 'login_alert' | 'weekly_report';

const CATEGORIES: { id: NotifCategory; label: string; desc: string; icon: any; color: string }[] = [
  { id: 'breach_alert', label: 'Breach Alerts', desc: 'New data breaches involving your monitored assets', icon: AlertTriangle, color: 'text-error' },
  { id: 'watchlist_hit', label: 'Watchlist Hits', desc: 'When a watchlist item appears in new intelligence', icon: Shield, color: 'text-orange-400' },
  { id: 'scan_complete', label: 'Scan Complete', desc: 'When a scan finishes processing', icon: Check, color: 'text-accent' },
  { id: 'security_update', label: 'Security Updates', desc: 'Platform security advisories and patches', icon: Globe, color: 'text-cyan-400' },
  { id: 'login_alert', label: 'Login Alerts', desc: 'Unusual login activity on your account', icon: Key, color: 'text-purple-400' },
  { id: 'weekly_report', label: 'Weekly Summary', desc: 'Weekly security posture report digest', icon: Mail, color: 'text-blue-400' },
];

// Check if browser supports notifications
const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

export function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return Promise.resolve(false);
  return Notification.requestPermission().then(p => p === 'granted');
}

export function sendBrowserNotification(title: string, body: string, icon?: string) {
  if (!notificationsSupported) return;
  if (Notification.permission !== 'granted') return;
  const notif = new Notification(title, {
    body,
    icon: icon || '/joescan-icon.png',
    badge: '/joescan-icon.png',
    tag: 'joescan-' + Date.now(),
    silent: false,
  });
  notif.onclick = () => { window.focus(); notif.close(); };
}

export default function PushNotifSettings() {
  const [permission, setPermission] = useState<NotificationPermission>(
    notificationsSupported ? Notification.permission : 'denied'
  );
  const [prefs, setPrefs] = useState<Record<NotifCategory, boolean>>({
    breach_alert: true, watchlist_hit: true, scan_complete: true,
    security_update: true, login_alert: true, weekly_report: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, 'notifPrefs', auth.currentUser.uid)).then(snap => {
      if (snap.exists()) setPrefs(snap.data() as any);
    }).catch(() => {});
  }, []);

  const handleEnable = async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
    if (granted) {
      sendBrowserNotification('JoeScan Notifications', 'Push notifications enabled successfully! 🛡️');
    }
  };

  const toggleCategory = (cat: NotifCategory) => {
    setPrefs(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'notifPrefs', auth.currentUser.uid), prefs);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleTest = () => {
    setTesting(true);
    sendBrowserNotification(
      '⚠️ Breach Alert — JoeScan',
      'New breach detected: 2.3M records from ExampleDB. Check your dashboard for details.',
    );
    setTimeout(() => setTesting(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Permission Status */}
      <div className={`glass-card p-5 rounded-xl flex items-center justify-between ${permission === 'granted' ? 'border-accent/20' : 'border-orange-500/20'}`}>
        <div className="flex items-center gap-4">
          {permission === 'granted' ? (
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center"><BellRing className="w-6 h-6 text-accent" /></div>
          ) : (
            <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center"><BellOff className="w-6 h-6 text-orange-400" /></div>
          )}
          <div>
            <h3 className="font-bold text-text-main">
              {permission === 'granted' ? 'Push Notifications Active' : 'Push Notifications Disabled'}
            </h3>
            <p className="text-xs text-text-dim mt-0.5">
              {permission === 'granted'
                ? 'You will receive real-time alerts for your enabled categories.'
                : 'Enable browser notifications to receive real-time security alerts.'}
            </p>
          </div>
        </div>
        {permission !== 'granted' ? (
          <button onClick={handleEnable} className="px-4 py-2.5 bg-accent/10 border border-accent/20 rounded-xl text-accent text-xs font-bold uppercase tracking-widest hover:bg-accent/20 transition-all flex items-center gap-2">
            <Bell className="w-4 h-4" /> Enable
          </button>
        ) : (
          <button onClick={handleTest} disabled={testing} className="px-4 py-2.5 bg-bg-elevated border border-border-subtle rounded-xl text-text-dim text-xs font-bold uppercase tracking-widest hover:border-accent/30 transition-all flex items-center gap-2 disabled:opacity-50">
            <Zap className="w-4 h-4" /> {testing ? 'Sent!' : 'Test'}
          </button>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-2">
        <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-3">Notification Categories</h4>
        {CATEGORIES.map((cat, i) => {
          const Icon = cat.icon;
          return (
            <motion.div key={cat.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="flex items-center justify-between p-4 bg-bg-surface border border-border-subtle/50 rounded-xl hover:border-border-main transition-all">
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${cat.color}`} />
                <div>
                  <div className="text-sm font-bold text-text-main">{cat.label}</div>
                  <div className="text-[10px] text-text-dim">{cat.desc}</div>
                </div>
              </div>
              <button onClick={() => toggleCategory(cat.id)}
                className={`w-11 h-6 rounded-full transition-all relative ${prefs[cat.id] ? 'bg-accent' : 'bg-bg-elevated border border-border-subtle'}`}>
                <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm absolute top-[3px] transition-all ${prefs[cat.id] ? 'right-[3px]' : 'left-[3px]'}`}
                  style={{ width: 18, height: 18 }} />
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 bg-accent/10 border border-accent/20 text-accent rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent/20 transition-all flex items-center justify-center gap-2">
        {saving ? <Zap className="w-4 h-4 animate-pulse" /> : saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Bell className="w-4 h-4" /> Save Preferences</>}
      </button>
    </div>
  );
}

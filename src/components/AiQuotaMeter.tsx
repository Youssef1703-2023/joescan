import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Zap, Key, RefreshCw, Clock, ShieldCheck, Sparkles, AlertCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { auth } from '../lib/firebase';

interface QuotaState {
  used: number;
  limit: number;
  tier: 'free' | 'pro' | 'enterprise';
  day: string;
  resetsAt: string;
  retryAfter: number;
}

export default function AiQuotaMeter() {
  const { lang } = useLanguage();
  const isRtl = lang === 'ar';

  const [hasCustomKey, setHasCustomKey] = useState<boolean>(false);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Check if personal key is configured in local storage
  const checkCustomKey = useCallback(() => {
    try {
      const s = localStorage.getItem('joe_api_settings');
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed.groqKey || parsed.openrouterKey) {
          setHasCustomKey(true);
          return true;
        }
      }
    } catch {}
    setHasCustomKey(false);
    return false;
  }, []);

  const fetchQuota = useCallback(async (isManualRefresh = false) => {
    if (checkCustomKey()) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const proxyUrl = import.meta.env.VITE_AI_PROXY_URL;
    if (!proxyUrl) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isManualRefresh) setRefreshing(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const quotaEndpoint = proxyUrl.replace(/\/+$/, '') + '/quota';

      const res = await fetch(quotaEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data: QuotaState = await res.json();
      setQuota(data);
    } catch (err: any) {
      console.warn('[AiQuotaMeter] Failed to fetch quota:', err);
      setError(err?.message || 'Failed to load quota');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [checkCustomKey]);

  useEffect(() => {
    checkCustomKey();
    fetchQuota();

    // Listen for AI usage updates dispatched when analysis / chat completes
    const handleUsageUpdated = () => {
      fetchQuota();
    };

    // Listen for storage changes (e.g. user toggled API key in Settings)
    const handleStorageChange = () => {
      checkCustomKey();
      fetchQuota();
    };

    window.addEventListener('joescan_ai_usage_updated', handleUsageUpdated);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('joescan_ai_usage_updated', handleUsageUpdated);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [checkCustomKey, fetchQuota]);

  // If user configured a personal API key, show BYO-key badge
  if (hasCustomKey) {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className="glass-card p-4 rounded-xl border border-accent/30 bg-accent/5 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden group shadow-[0_0_15px_rgba(0,255,0,0.05)]"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-text-main">
                {isRtl ? 'مفتاح API خاص مفعّل' : 'Personal API Key Active'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/20 text-accent font-bold uppercase border border-accent/30">
                {isRtl ? 'استخدام غير محدود' : 'Unlimited'}
              </span>
            </div>
            <p className="text-xs text-text-dim mt-0.5 font-mono">
              {isRtl
                ? 'أنت تستخدم مفتاحك الخاص — يتم تجاوز حصة المنصة اليومية بالكامل.'
                : 'Using your own API key — platform rate limits and daily quotas are bypassed.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const tier = quota?.tier || 'free';
  const limit = quota?.limit ?? (tier === 'pro' ? 150 : tier === 'enterprise' ? 2000 : 10);
  const used = quota?.used ?? 0;
  const remaining = Math.max(0, limit - used);
  const percentage = Math.min(100, Math.round((used / limit) * 100));

  const tierName = tier === 'enterprise'
    ? (isRtl ? 'مؤسسي (Enterprise)' : 'Enterprise')
    : tier === 'pro'
    ? (isRtl ? 'احترافي (Pro)' : 'Pro')
    : (isRtl ? 'مجاني (Free)' : 'Free');

  const getBarColor = () => {
    if (percentage >= 90) return 'bg-error shadow-[0_0_10px_rgba(255,59,59,0.5)]';
    if (percentage >= 70) return 'bg-caution shadow-[0_0_10px_rgba(255,159,10,0.5)]';
    return 'bg-accent shadow-[0_0_10px_rgba(0,255,0,0.5)]';
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="glass-card p-4 md:p-5 rounded-xl border border-border-subtle hover:border-accent/30 transition-all bg-bg-surface/50 backdrop-blur-md relative overflow-hidden group shadow-lg"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-text-main">
                {isRtl ? 'رصيد الذكاء الاصطناعي اليومي' : 'Daily AI Analysis Quota'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-bg-elevated border border-border-subtle text-accent font-bold uppercase">
                {tierName} ({limit}/day)
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold text-text-main">
            {loading ? '...' : `${used} / ${limit}`} <span className="text-text-dim text-[11px] font-normal">{isRtl ? 'طلب' : 'requests'}</span>
          </span>
          <button
            onClick={() => fetchQuota(true)}
            disabled={refreshing || loading}
            title={isRtl ? 'تحديث الرصيد' : 'Refresh quota balance'}
            className="p-1.5 rounded-lg bg-bg-elevated hover:bg-accent/10 border border-border-subtle text-text-dim hover:text-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-accent' : ''}`} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-bg-elevated rounded-full overflow-hidden border border-border-subtle/50 relative z-10 mb-2.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full transition-all ${getBarColor()}`}
        />
      </div>

      {/* Footer Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] font-mono text-text-dim relative z-10">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-accent shrink-0" />
          <span>
            {isRtl
              ? 'يتجدد يومياً الساعة 00:00 بتوقيت القاهرة (Africa/Cairo)'
              : 'Resets daily at 00:00 Cairo time (Africa/Cairo)'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] opacity-75">
          <span>
            {isRtl
              ? 'ملاحظة: يمكنك استخدام مفتاحك الخاص من الإعدادات بدون أي حدود للمنصة.'
              : 'Tip: Personal API keys in Settings bypass platform quotas.'}
          </span>
        </div>
      </div>
    </div>
  );
}

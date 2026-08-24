import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Activity, MapPin, Radio, RefreshCw, AlertCircle, ShieldAlert, Server, Cpu, ExternalLink } from 'lucide-react';
import { fetchThreatFeed, ThreatIndicator, ThreatFeedResponse } from '../lib/threatFeed';

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

export default function ThreatMap() {
  const [feedData, setFeedData] = useState<ThreatFeedResponse | null>(null);
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<ThreatIndicator | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await fetchThreatFeed();
      setFeedData(data);
      setIndicators(data.indicators || []);
    } catch (err: any) {
      console.warn('[ThreatMap 2D] Failed to fetch feed:', err);
      setError(err?.message || 'Failed to load threat feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
    const interval = setInterval(() => {
      if (!isPaused) {
        loadFeed(true);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [loadFeed, isPaused]);

  const onlineCount = indicators.filter(i => i.status === 'online').length;
  const offlineCount = indicators.filter(i => i.status === 'offline').length;
  const uniqueCountries = new Set(indicators.map(i => i.country).filter(Boolean)).size;

  // 2D World Map Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const toXY = (lat: number, lng: number) => {
      const x = ((lng + 180) / 360) * canvas.width;
      const y = ((90 - lat) / 180) * canvas.height;
      return { x, y };
    };

    let pulseTick = 0;

    const draw = () => {
      if (canvas.width === 0 || canvas.height === 0) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      pulseTick += 0.05;
      ctx.fillStyle = 'rgba(6, 11, 20, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = 'rgba(0, 255, 170, 0.04)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < canvas.width; i += 45) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 45) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
      }

      // Plot indicators on 2D map
      indicators.forEach((ind) => {
        const [lat, lng] = ind.coordinates;
        const { x, y } = toXY(lat, lng);
        const isCritical = ind.status === 'online';
        const color = isCritical ? '#ef4444' : '#f97316';
        const pulse = Math.sin(pulseTick + lat) * 0.5 + 0.5;

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, (isCritical ? 8 : 5) * (0.8 + 0.4 * pulse), 0, Math.PI * 2);
        ctx.fillStyle = isCritical ? 'rgba(239, 68, 68, 0.3)' : 'rgba(249, 115, 22, 0.2)';
        ctx.fill();

        // Dot
        ctx.beginPath();
        ctx.arc(x, y, isCritical ? 3 : 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillText(ind.country, x + 5, y + 3);
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [indicators]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 w-full">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <Globe className="w-8 h-8 text-cyan-400" /> Global Threat Map
          </h1>
          <p className="text-text-dim text-sm mt-1 font-mono">
            Live geographic distribution of verified Botnet C2 servers and malicious host infrastructure.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => loadFeed(true)}
            disabled={loading}
            className="p-2 rounded-xl border border-border-subtle text-text-dim hover:text-accent hover:border-accent/30 transition-all flex items-center gap-1 text-xs font-mono"
            title="Refresh feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${
              isPaused ? 'border-accent/30 text-accent bg-accent/10' : 'border-error/30 text-error bg-error/10'
            }`}
          >
            {isPaused ? '▶ Resume Feed' : '⏸ Pause Feed'}
          </button>
        </div>
      </div>

      {/* Attribution & Honest Framing Banner */}
      <div className="glass-card p-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
        <div className="flex items-center gap-2 text-cyan-300">
          <Activity className="w-4 h-4 animate-pulse" />
          <span>
            {feedData?.source || 'abuse.ch Feodo Tracker'} • {feedData?.description || 'Active Botnet C2 infrastructure'}
          </span>
        </div>
        <div className="text-text-dim text-[11px]">
          {feedData?.updatedAt ? `Updated ${new Date(feedData.updatedAt).toLocaleTimeString()}` : 'Live data'}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-card p-4 rounded-xl border border-error/30 bg-error/10 text-error flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadFeed(false)}
            className="px-3 py-1 bg-error/20 hover:bg-error/30 rounded-lg text-xs font-bold font-mono uppercase"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Tracked', value: indicators.length, color: 'text-cyan-400' },
          { label: 'Online C2 Nodes', value: onlineCount, color: 'text-error' },
          { label: 'Offline / Historic', value: offlineCount, color: 'text-orange-400' },
          { label: 'Countries Involved', value: uniqueCountries, color: 'text-yellow-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 rounded-xl text-center">
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-text-dim">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Map Canvas */}
      <div className="glass-card rounded-xl overflow-hidden relative" style={{ height: '400px' }}>
        <canvas ref={canvasRef} className="w-full h-full" style={{ background: 'radial-gradient(ellipse at center, #0a1120 0%, #030712 100%)' }} />
        <div className="absolute top-3 left-3 text-[9px] font-mono text-accent/50 uppercase tracking-widest flex items-center gap-2 bg-bg-base/80 px-2 py-1 rounded border border-border-subtle backdrop-blur-md">
          <Radio className="w-3 h-3 animate-pulse text-accent" /> Verified Host Indicators
        </div>
      </div>

      {/* Live Indicator Feed */}
      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" /> Malicious Infrastructure Indicators ({indicators.length})
        </h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
          {indicators.slice(0, 25).map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setSelectedIndicator(t)}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-surface border border-border-subtle/50 text-xs cursor-pointer hover:border-border-main transition-all"
            >
              <div className={`p-1.5 rounded-md shrink-0 ${t.status === 'online' ? 'bg-error/10 text-error' : 'bg-orange-500/10 text-orange-400'}`}>
                <Server className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text-main font-mono">{t.ip}:{t.port || '80'}</span>
                  <span
                    className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                    style={{
                      color: t.status === 'online' ? severityColors.critical : severityColors.high,
                      backgroundColor: `${t.status === 'online' ? severityColors.critical : severityColors.high}20`,
                    }}
                  >
                    {t.status}
                  </span>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                    {t.malware}
                  </span>
                </div>
                <p className="text-text-dim truncate text-[11px] mt-0.5">
                  {t.countryName} ({t.country}) {t.asName ? `• ${t.asName}` : ''}
                </p>
              </div>
              <span className="text-text-dim/50 text-[10px] font-mono shrink-0">
                {t.firstSeen ? new Date(t.firstSeen).toLocaleDateString() : ''}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Threat Detail Modal */}
      <AnimatePresence>
        {selectedIndicator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedIndicator(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="glass-card max-w-md w-full p-6 rounded-2xl space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${selectedIndicator.status === 'online' ? 'bg-error/10 text-error' : 'bg-orange-500/10 text-orange-400'}`}>
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-mono">
                      {selectedIndicator.ip}:{selectedIndicator.port || '80'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                        style={{
                          color: selectedIndicator.status === 'online' ? severityColors.critical : severityColors.high,
                          backgroundColor: `${selectedIndicator.status === 'online' ? severityColors.critical : severityColors.high}20`,
                        }}
                      >
                        {selectedIndicator.status}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                        {selectedIndicator.malware}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedIndicator(null)} className="text-text-dim hover:text-text-main text-lg">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-bg-surface p-3 rounded-lg border border-border-subtle">
                  <div className="text-[10px] font-mono uppercase text-text-dim mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-cyan-400" /> Location
                  </div>
                  <div className="font-bold text-text-main">{selectedIndicator.countryName}</div>
                  <div className="text-text-dim font-mono text-[10px]">{selectedIndicator.country}</div>
                </div>
                <div className="bg-bg-surface p-3 rounded-lg border border-border-subtle">
                  <div className="text-[10px] font-mono uppercase text-text-dim mb-1 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-cyan-400" /> Network / ASN
                  </div>
                  <div className="font-bold text-text-main truncate">{selectedIndicator.asName || 'N/A'}</div>
                  <div className="text-text-dim font-mono text-[10px]">AS{selectedIndicator.asNumber || 'N/A'}</div>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center border-t border-border-subtle text-[11px] font-mono">
                <a
                  href={`https://feodotracker.abuse.ch/browse/host/${selectedIndicator.ip}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  Inspect on abuse.ch <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => setSelectedIndicator(null)}
                  className="px-4 py-2 bg-bg-surface border border-border-subtle rounded-lg text-text-main hover:bg-bg-elevated font-bold uppercase text-[10px]"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

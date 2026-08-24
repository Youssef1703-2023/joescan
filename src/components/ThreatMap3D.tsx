import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Activity, MapPin, Radio, RotateCcw, ZoomIn, ZoomOut, RefreshCw, AlertCircle, ShieldAlert, Server, Cpu, ExternalLink, Filter } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { fetchThreatFeed, ThreatIndicator, ThreatFeedResponse } from '../lib/threatFeed';

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
};

export default function ThreatMap3D() {
  const { t, lang } = useLanguage();
  const isAr = lang === 'ar';

  const [feedData, setFeedData] = useState<ThreatFeedResponse | null>(null);
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<ThreatIndicator | null>(null);
  const [filterMalware, setFilterMalware] = useState<string>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const rotRef = useRef(0);

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const data = await fetchThreatFeed();
      setFeedData(data);
      setIndicators(data.indicators || []);
    } catch (err: any) {
      console.warn('[ThreatMap3D] Failed to fetch feed:', err);
      setError(err?.message || 'Failed to load threat intelligence feed.');
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
    }, 60000); // 1-minute feed refresh
    return () => clearInterval(interval);
  }, [loadFeed, isPaused]);

  // Filtered indicators
  const displayedIndicators = indicators.filter(ind => {
    if (filterMalware === 'all') return true;
    return ind.malware.toLowerCase() === filterMalware.toLowerCase();
  });

  const malwareFamilies: string[] = Array.from(new Set(indicators.map(i => i.malware).filter(Boolean)));
  const onlineCount = indicators.filter(i => i.status === 'online').length;
  const offlineCount = indicators.filter(i => i.status === 'offline').length;
  const uniqueCountries = new Set(indicators.map(i => i.country).filter(Boolean)).size;

  // 3D Globe Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width / window.devicePixelRatio;
    const H = () => canvas.height / window.devicePixelRatio;

    const toRad = (d: number) => (d * Math.PI) / 180;

    const latLngTo3D = (lat: number, lng: number, r: number) => {
      const phi = toRad(90 - lat);
      const theta = toRad(lng + rotRef.current);
      return {
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.cos(phi),
        z: r * Math.sin(phi) * Math.sin(theta),
      };
    };

    const project = (x: number, y: number, z: number) => {
      const cx = W() / 2;
      const cy = H() / 2;
      const fov = 600;
      const scale = fov / (fov + z);
      return {
        px: cx + x * scale * zoom,
        py: cy + y * scale * zoom,
        scale,
        visible: z < fov * 0.8,
      };
    };

    let pulseTick = 0;

    const draw = () => {
      const w = W(), h = H();
      if (w === 0 || h === 0) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      // Background
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
      bgGrad.addColorStop(0, '#0a101d');
      bgGrad.addColorStop(1, '#030712');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      if (!isPaused) {
        rotRef.current += 0.12;
      }
      pulseTick += 0.05;

      const R = Math.min(w, h) * 0.32 * zoom;

      // Draw globe sphere
      const globeGrad = ctx.createRadialGradient(
        w / 2 - R * 0.2,
        h / 2 - R * 0.2,
        R * 0.1,
        w / 2,
        h / 2,
        R
      );
      globeGrad.addColorStop(0, 'rgba(0, 255, 170, 0.06)');
      globeGrad.addColorStop(0.7, 'rgba(0, 255, 170, 0.02)');
      globeGrad.addColorStop(1, 'rgba(0, 255, 170, 0.0)');
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R, 0, Math.PI * 2);
      ctx.fillStyle = globeGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 255, 170, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Latitude lines
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 255, 170, 0.04)';
        for (let lng = 0; lng <= 360; lng += 4) {
          const p = latLngTo3D(lat, lng, R);
          const { px, py, visible } = project(p.x, p.y, p.z);
          if (!visible) continue;
          if (lng === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Longitude lines
      for (let lng = 0; lng < 360; lng += 30) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 255, 170, 0.04)';
        for (let lat = -90; lat <= 90; lat += 4) {
          const p = latLngTo3D(lat, lng, R);
          const { px, py, visible } = project(p.x, p.y, p.z);
          if (!visible) continue;
          if (lat === -90) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Plot real threat indicators by country location
      displayedIndicators.forEach((ind) => {
        const [lat, lng] = ind.coordinates;
        const p = latLngTo3D(lat, lng, R);
        const { px, py, scale, visible } = project(p.x, p.y, p.z);
        if (!visible) return;

        const isCritical = ind.status === 'online';
        const color = isCritical ? '#ef4444' : '#f97316';
        const pulse = Math.sin(pulseTick + lat) * 0.5 + 0.5;

        // Outer glow
        const glowRadius = Math.max(1, (isCritical ? 10 : 6) * scale * (0.8 + 0.4 * pulse));
        const glow = ctx.createRadialGradient(px, py, 0, px, py, glowRadius);
        glow.addColorStop(0, isCritical ? 'rgba(239, 68, 68, 0.6)' : 'rgba(249, 115, 22, 0.5)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.beginPath();
        ctx.arc(px, py, glowRadius, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Core marker dot
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, (isCritical ? 3 : 2) * scale), 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Country code label if zoomed in
        if (scale > 0.55 && zoom >= 1) {
          ctx.font = `${Math.max(8, 10 * scale)}px monospace`;
          ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * scale})`;
          ctx.fillText(ind.country, px + 6, py + 3);
        }
      });

      // Watermark / Status Header
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(0, 255, 170, 0.35)';
      ctx.fillText('JOESCAN THREAT INTELLIGENCE • BOTNET C2 INFRASTRUCTURE', 14, 20);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [displayedIndicators, zoom, isPaused]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    rotRef.current += dx * 0.3;
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 w-full" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <Globe className="w-8 h-8 text-cyan-400" /> {t('threat_title')}
          </h1>
          <p className="text-text-dim text-sm mt-1 font-mono">
            {isAr
              ? 'خريطة تفاعلية ثلاثية الأبعاد للبنية التحتية للخوادم الخبيثة وخوادم التحكم (Botnet C2) المستخرجة من خلاصات استخبارات التهديدات الفعلية.'
              : 'Interactive 3D visualization of malicious Botnet C2 infrastructure and host indicators from live threat feeds.'}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={() => loadFeed(true)}
            disabled={loading}
            className="p-2 rounded-xl border border-border-subtle text-text-dim hover:text-accent hover:border-accent/30 transition-all flex items-center gap-1 text-xs font-mono"
            title="Refresh feed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.2))}
            className="p-2 rounded-xl border border-border-subtle text-text-dim hover:text-accent hover:border-accent/30 transition-all"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.6, z - 0.2))}
            className="p-2 rounded-xl border border-border-subtle text-text-dim hover:text-accent hover:border-accent/30 transition-all"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setZoom(1); rotRef.current = 0; }}
            className="p-2 rounded-xl border border-border-subtle text-text-dim hover:text-accent hover:border-accent/30 transition-all"
            title="Reset rotation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${
              isPaused ? 'border-accent/30 text-accent bg-accent/10' : 'border-error/30 text-error bg-error/10'
            }`}
          >
            {isPaused ? `▶ ${t('threat_resume')}` : `⏸ ${t('threat_pause')}`}
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
          {feedData?.updatedAt ? `Updated ${new Date(feedData.updatedAt).toLocaleTimeString()}` : 'Live data'} • Plotted by country centroid
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

      {/* Real Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: isAr ? 'إجمالي المؤشرات' : 'Total Indicators', value: indicators.length, color: 'text-cyan-400' },
          { label: isAr ? 'خوادم نشطة (Online)' : 'Online C2 Servers', value: onlineCount, color: 'text-error' },
          { label: isAr ? 'خوادم متوقفة (Offline)' : 'Offline / Historical', value: offlineCount, color: 'text-orange-400' },
          { label: isAr ? 'دول متأثرة' : 'Countries', value: uniqueCountries, color: 'text-yellow-400' },
          { label: isAr ? 'عائلات برمجيات خبيثة' : 'Malware Families', value: malwareFamilies.length, color: 'text-green-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 rounded-xl text-center">
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-text-dim">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 3D Globe Visualizer */}
      <div
        className="glass-card rounded-2xl overflow-hidden relative"
        style={{ height: '500px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <canvas ref={canvasRef} className="w-full h-full" style={{ cursor: isDragging ? 'grabbing' : 'grab' }} />
        <div className="absolute top-4 left-4 text-[9px] font-mono text-accent/50 uppercase tracking-widest flex items-center gap-2 bg-bg-base/80 px-2.5 py-1 rounded-md backdrop-blur-md border border-border-subtle">
          <Radio className="w-3 h-3 animate-pulse text-accent" /> {t('threat_drag_rotate')}
        </div>
        <div className="absolute bottom-4 right-4 flex gap-1.5 bg-bg-base/80 p-1.5 rounded-lg border border-border-subtle backdrop-blur-md">
          <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-error/20 text-error font-bold">
            Online C2
          </span>
          <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold">
            Offline C2
          </span>
        </div>
      </div>

      {/* Filter by malware family */}
      {malwareFamilies.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide text-xs font-mono">
          <span className="text-text-dim uppercase text-[10px] tracking-widest flex items-center gap-1 shrink-0">
            <Filter className="w-3 h-3" /> Filter Malware:
          </span>
          <button
            onClick={() => setFilterMalware('all')}
            className={`px-3 py-1 rounded-lg border uppercase transition-all shrink-0 ${
              filterMalware === 'all'
                ? 'bg-accent/20 text-accent border-accent/40 font-bold'
                : 'border-border-subtle text-text-dim hover:text-text-main'
            }`}
          >
            All ({indicators.length})
          </button>
          {malwareFamilies.map(malware => (
            <button
              key={malware}
              onClick={() => setFilterMalware(malware)}
              className={`px-3 py-1 rounded-lg border uppercase transition-all shrink-0 ${
                filterMalware.toLowerCase() === malware.toLowerCase()
                  ? 'bg-accent/20 text-accent border-accent/40 font-bold'
                  : 'border-border-subtle text-text-dim hover:text-text-main'
              }`}
            >
              {malware} ({indicators.filter(i => i.malware === malware).length})
            </button>
          ))}
        </div>
      )}

      {/* Real Indicators Table / Feed */}
      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            {isAr ? 'خلاصة المؤشرات المكتشفة حديثاً' : 'Recent Malicious Infrastructure Indicators'}
          </span>
          <span className="text-[10px] font-mono text-text-dim">
            Showing {displayedIndicators.length} of {indicators.length}
          </span>
        </h3>

        {displayedIndicators.length === 0 ? (
          <div className="text-center py-8 text-text-dim font-mono text-sm">
            {loading ? 'Loading threat indicators...' : 'No indicators found matching the selected filter.'}
          </div>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-hide">
            {displayedIndicators.slice(0, 30).map((ind) => (
              <motion.div
                key={ind.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedIndicator(ind)}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-bg-surface border border-border-subtle/50 text-xs cursor-pointer hover:border-border-main transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`p-2 rounded-lg shrink-0 ${ind.status === 'online' ? 'bg-error/10 text-error' : 'bg-orange-500/10 text-orange-400'}`}>
                    <Server className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-text-main">
                        {ind.ip}{ind.port ? `:${ind.port}` : ''}
                      </span>
                      <span
                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{
                          color: ind.status === 'online' ? severityColors.critical : severityColors.high,
                          backgroundColor: `${ind.status === 'online' ? severityColors.critical : severityColors.high}20`,
                        }}
                      >
                        {ind.status}
                      </span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                        {ind.malware}
                      </span>
                    </div>
                    <p className="text-text-dim text-[11px] font-mono truncate mt-0.5">
                      {ind.countryName} ({ind.country}) {ind.asName ? `• ${ind.asName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 text-text-dim/60 font-mono text-[10px]">
                  <div>{ind.firstSeen ? new Date(ind.firstSeen).toLocaleDateString() : 'Recent'}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal for Selected Threat Indicator */}
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
              className="glass-card max-w-lg w-full p-6 rounded-2xl space-y-4 border border-border-main"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${selectedIndicator.status === 'online' ? 'bg-error/10 text-error' : 'bg-orange-500/10 text-orange-400'}`}>
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black font-mono">
                      {selectedIndicator.ip}{selectedIndicator.port ? `:${selectedIndicator.port}` : ''}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                        style={{
                          color: selectedIndicator.status === 'online' ? severityColors.critical : severityColors.high,
                          backgroundColor: `${selectedIndicator.status === 'online' ? severityColors.critical : severityColors.high}20`,
                        }}
                      >
                        Status: {selectedIndicator.status}
                      </span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                        {selectedIndicator.malware}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIndicator(null)}
                  className="text-text-dim hover:text-text-main text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-bg-surface p-3 rounded-lg border border-border-subtle">
                  <div className="text-[10px] font-mono uppercase text-text-dim mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-cyan-400" /> Country
                  </div>
                  <div className="font-bold text-text-main">{selectedIndicator.countryName}</div>
                  <div className="text-text-dim font-mono text-[10px]">ISO: {selectedIndicator.country}</div>
                </div>

                <div className="bg-bg-surface p-3 rounded-lg border border-border-subtle">
                  <div className="text-[10px] font-mono uppercase text-text-dim mb-1 flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-cyan-400" /> Autonomous System (ASN)
                  </div>
                  <div className="font-bold text-text-main truncate">{selectedIndicator.asName || 'Unknown ISP'}</div>
                  <div className="text-text-dim font-mono text-[10px]">AS{selectedIndicator.asNumber || 'N/A'}</div>
                </div>

                <div className="bg-bg-surface p-3 rounded-lg border border-border-subtle">
                  <div className="text-[10px] font-mono uppercase text-text-dim mb-1">First Reported</div>
                  <div className="font-mono text-text-main text-[11px]">{selectedIndicator.firstSeen}</div>
                </div>

                <div className="bg-bg-surface p-3 rounded-lg border border-border-subtle">
                  <div className="text-[10px] font-mono uppercase text-text-dim mb-1">Source Feed</div>
                  <div className="font-bold text-text-main">abuse.ch Feodo Tracker</div>
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

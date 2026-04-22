import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Globe, Activity, MapPin, Radio, RotateCcw, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

interface ThreatEvent {
  id: string;
  type: 'breach' | 'ddos' | 'phishing' | 'malware' | 'ransomware' | 'botnet';
  source: { lat: number; lng: number; country: string; city: string };
  target: { lat: number; lng: number; country: string; city: string };
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
}

const CITIES = [
  { city: 'Moscow', country: 'Russia', lat: 55.75, lng: 37.62 },
  { city: 'Beijing', country: 'China', lat: 39.90, lng: 116.40 },
  { city: 'Pyongyang', country: 'N. Korea', lat: 39.02, lng: 125.75 },
  { city: 'Tehran', country: 'Iran', lat: 35.69, lng: 51.39 },
  { city: 'Lagos', country: 'Nigeria', lat: 6.52, lng: 3.38 },
  { city: 'São Paulo', country: 'Brazil', lat: -23.55, lng: -46.63 },
  { city: 'Mumbai', country: 'India', lat: 19.08, lng: 72.88 },
  { city: 'Cairo', country: 'Egypt', lat: 30.04, lng: 31.24 },
  { city: 'New York', country: 'USA', lat: 40.71, lng: -74.01 },
  { city: 'London', country: 'UK', lat: 51.51, lng: -0.13 },
  { city: 'Berlin', country: 'Germany', lat: 52.52, lng: 13.41 },
  { city: 'Tokyo', country: 'Japan', lat: 35.68, lng: 139.69 },
  { city: 'Sydney', country: 'Australia', lat: -33.87, lng: 151.21 },
  { city: 'Dubai', country: 'UAE', lat: 25.20, lng: 55.27 },
  { city: 'Singapore', country: 'Singapore', lat: 1.35, lng: 103.82 },
  { city: 'Toronto', country: 'Canada', lat: 43.65, lng: -79.38 },
  { city: 'Seoul', country: 'S. Korea', lat: 37.57, lng: 126.98 },
  { city: 'Johannesburg', country: 'S. Africa', lat: -26.20, lng: 28.04 },
  { city: 'Mexico City', country: 'Mexico', lat: 19.43, lng: -99.13 },
  { city: 'Bucharest', country: 'Romania', lat: 44.43, lng: 26.10 },
];

const THREAT_TYPES: ThreatEvent['type'][] = ['breach', 'ddos', 'phishing', 'malware', 'ransomware', 'botnet'];
const SEVERITIES: ThreatEvent['severity'][] = ['low', 'medium', 'high', 'critical'];
const severityColors: Record<string, string> = { low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444' };
const typeIcons: Record<string, string> = { breach: '🔓', ddos: '⚡', phishing: '🎣', malware: '🦠', ransomware: '💀', botnet: '🤖' };

function generateThreat(): ThreatEvent {
  const source = CITIES[Math.floor(Math.random() * CITIES.length)];
  let target = CITIES[Math.floor(Math.random() * CITIES.length)];
  while (target.city === source.city) target = CITIES[Math.floor(Math.random() * CITIES.length)];
  return {
    id: Math.random().toString(36).substr(2, 9),
    type: THREAT_TYPES[Math.floor(Math.random() * THREAT_TYPES.length)],
    source: { ...source }, target: { ...target },
    severity: SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)],
    timestamp: Date.now(),
  };
}

export default function ThreatMap3D() {
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  const [selectedThreat, setSelectedThreat] = useState<ThreatEvent | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [rotation, setRotation] = useState({ x: 20, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const rotRef = useRef(0);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      const t = generateThreat();
      setThreats(prev => {
        const updated = [t, ...prev].slice(0, 80);
        const s = { total: updated.length, critical: 0, high: 0, medium: 0, low: 0 };
        updated.forEach(th => s[th.severity]++);
        setStats(s);
        return updated;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isPaused]);

  // 3D Globe Canvas
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

    interface Particle { sx: number; sy: number; sz: number; tx: number; ty: number; tz: number; progress: number; color: string; speed: number; }
    let particles: Particle[] = [];

    const toRad = (d: number) => d * Math.PI / 180;

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
      return { px: cx + x * scale * zoom, py: cy + y * scale * zoom, scale, visible: z < fov * 0.8 };
    };

    const draw = () => {
      const w = W(), h = H();
      if (w === 0 || h === 0) { animRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, w, h);

      // Background
      const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
      bgGrad.addColorStop(0, '#0d1520');
      bgGrad.addColorStop(1, '#050510');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      rotRef.current += 0.15;
      const R = Math.min(w, h) * 0.32 * zoom;

      // Draw globe sphere
      const globeGrad = ctx.createRadialGradient(w / 2 - R * 0.2, h / 2 - R * 0.2, R * 0.1, w / 2, h / 2, R);
      globeGrad.addColorStop(0, 'rgba(0, 255, 100, 0.06)');
      globeGrad.addColorStop(0.7, 'rgba(0, 255, 100, 0.02)');
      globeGrad.addColorStop(1, 'rgba(0, 255, 100, 0.0)');
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, R, 0, Math.PI * 2);
      ctx.fillStyle = globeGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Grid lines (latitude)
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 255, 100, 0.04)';
        for (let lng = 0; lng <= 360; lng += 3) {
          const p = latLngTo3D(lat, lng, R);
          const { px, py, visible } = project(p.x, p.y, p.z);
          if (!visible) continue;
          if (lng === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Grid lines (longitude)
      for (let lng = 0; lng < 360; lng += 30) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 255, 100, 0.04)';
        for (let lat = -90; lat <= 90; lat += 3) {
          const p = latLngTo3D(lat, lng, R);
          const { px, py, visible } = project(p.x, p.y, p.z);
          if (!visible) continue;
          if (lat === -90) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      // Draw cities
      CITIES.forEach(c => {
        const p = latLngTo3D(c.lat, c.lng, R);
        const { px, py, scale, visible } = project(p.x, p.y, p.z);
        if (!visible) return;

        // Glow
        const glowR = 8 * scale;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, glowR);
        glow.addColorStop(0, 'rgba(0, 255, 100, 0.5)');
        glow.addColorStop(1, 'rgba(0, 255, 100, 0)');
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.5, glowR), 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Dot
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.5, 2.5 * scale), 0, Math.PI * 2);
        ctx.fillStyle = '#00ff64';
        ctx.fill();

        // Label
        if (scale > 0.4) {
          ctx.font = `${Math.max(7, 9 * scale)}px monospace`;
          ctx.fillStyle = `rgba(0, 255, 100, ${0.3 * scale})`;
          ctx.fillText(c.city, px + 8, py + 3);
        }
      });

      // Spawn particles
      threats.slice(0, 8).forEach(t => {
        if (Math.random() > 0.97) {
          const s = latLngTo3D(t.source.lat, t.source.lng, R);
          const tgt = latLngTo3D(t.target.lat, t.target.lng, R);
          particles.push({
            sx: s.x, sy: s.y, sz: s.z,
            tx: tgt.x, ty: tgt.y, tz: tgt.z,
            progress: 0,
            color: severityColors[t.severity],
            speed: 0.006 + Math.random() * 0.01,
          });
        }
      });

      // Animate particles (arc above globe)
      particles = particles.filter(p => p.progress < 1);
      particles.forEach(p => {
        p.progress += p.speed;
        const t = p.progress;
        const midHeight = R * 0.4;
        const x = p.sx + (p.tx - p.sx) * t;
        const y = p.sy + (p.ty - p.sy) * t - Math.sin(t * Math.PI) * midHeight;
        const z = p.sz + (p.tz - p.sz) * t;

        const { px, py, scale, visible } = project(x, y, z);
        if (!visible) return;

        const r = Math.max(0.5, 3 * scale);
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Glow trail
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.5, r * 3), 0, Math.PI * 2);
        ctx.fillStyle = p.color + '25';
        ctx.fill();

        // Impact
        if (t > 0.9) {
          const impactR = Math.max(0.5, (1 - t) * 150 * scale);
          ctx.beginPath();
          ctx.arc(px, py, impactR, 0, Math.PI * 2);
          ctx.strokeStyle = p.color + '60';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      // Title overlay
      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(0, 255, 100, 0.3)';
      ctx.fillText('JOESCAN THREAT INTELLIGENCE • LIVE', 12, 18);

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
  }, [threats, zoom]);

  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY }); };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    rotRef.current += dx * 0.3;
    setDragStart({ x: e.clientX, y: e.clientY });
  };
  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 w-full">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <Globe className="w-8 h-8 text-cyan-400" /> 3D Threat Visualizer
          </h1>
          <p className="text-text-dim text-sm mt-1 font-mono">Real-time 3D globe with live cyber threat intelligence.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="p-2 rounded-xl border border-border-subtle text-text-dim hover:text-accent hover:border-accent/30 transition-all"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} className="p-2 rounded-xl border border-border-subtle text-text-dim hover:text-accent hover:border-accent/30 transition-all"><ZoomOut className="w-4 h-4" /></button>
          <button onClick={() => { setZoom(1); rotRef.current = 0; }} className="p-2 rounded-xl border border-border-subtle text-text-dim hover:text-accent hover:border-accent/30 transition-all"><RotateCcw className="w-4 h-4" /></button>
          <button onClick={() => setIsPaused(!isPaused)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${isPaused ? 'border-accent/30 text-accent bg-accent/10' : 'border-error/30 text-error bg-error/10'}`}>
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Events', value: stats.total, color: 'text-cyan-400' },
          { label: 'Critical', value: stats.critical, color: 'text-error' },
          { label: 'High', value: stats.high, color: 'text-orange-400' },
          { label: 'Medium', value: stats.medium, color: 'text-yellow-400' },
          { label: 'Low', value: stats.low, color: 'text-green-400' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 rounded-xl text-center">
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-text-dim">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 3D Globe */}
      <div className="glass-card rounded-2xl overflow-hidden relative" style={{ height: '500px' }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        style-cursor={isDragging ? 'grabbing' : 'grab'}>
        <canvas ref={canvasRef} className="w-full h-full" style={{ cursor: isDragging ? 'grabbing' : 'grab' }} />
        <div className="absolute top-4 left-4 text-[9px] font-mono text-accent/40 uppercase tracking-widest flex items-center gap-2">
          <Radio className="w-3 h-3 animate-pulse" /> 3D Threat Intelligence • Drag to Rotate
        </div>
        <div className="absolute bottom-4 right-4 flex gap-1">
          {Object.entries(severityColors).map(([key, color]) => (
            <span key={key} className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded" style={{ color, backgroundColor: color + '15' }}>{key}</span>
          ))}
        </div>
      </div>

      {/* Live Feed */}
      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" /> Live Intercepts
        </h3>
        <div className="space-y-2 max-h-[250px] overflow-y-auto scrollbar-hide">
          {threats.slice(0, 15).map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              onClick={() => setSelectedThreat(t)}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-surface border border-border-subtle/50 text-xs cursor-pointer hover:border-border-main transition-all">
              <span className="text-lg shrink-0">{typeIcons[t.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text-main uppercase">{t.type}</span>
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ color: severityColors[t.severity], backgroundColor: severityColors[t.severity] + '20' }}>
                    {t.severity}
                  </span>
                </div>
                <p className="text-text-dim truncate">{t.source.city} → {t.target.city}</p>
              </div>
              <span className="text-text-dim/50 text-[10px] font-mono shrink-0">{new Date(t.timestamp).toLocaleTimeString()}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedThreat && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setSelectedThreat(null)}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()} className="glass-card max-w-md w-full p-6 rounded-2xl space-y-4">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{typeIcons[selectedThreat.type]}</span>
                <div>
                  <h3 className="text-lg font-black uppercase">{selectedThreat.type} Attack</h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded" style={{ color: severityColors[selectedThreat.severity], backgroundColor: severityColors[selectedThreat.severity] + '20' }}>
                    {selectedThreat.severity}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedThreat(null)} className="text-text-dim hover:text-text-main text-lg">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="bg-bg-surface p-3 rounded-lg border border-border-subtle">
                <div className="text-[10px] font-mono uppercase text-text-dim mb-1 flex items-center gap-1"><MapPin className="w-3 h-3 text-error" /> Source</div>
                <div className="font-bold text-text-main">{selectedThreat.source.city}</div>
                <div className="text-text-dim">{selectedThreat.source.country}</div>
              </div>
              <div className="bg-bg-surface p-3 rounded-lg border border-border-subtle">
                <div className="text-[10px] font-mono uppercase text-text-dim mb-1 flex items-center gap-1"><MapPin className="w-3 h-3 text-accent" /> Target</div>
                <div className="font-bold text-text-main">{selectedThreat.target.city}</div>
                <div className="text-text-dim">{selectedThreat.target.country}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

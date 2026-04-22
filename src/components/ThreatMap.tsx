import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Globe, Zap, AlertTriangle, Shield, Activity, MapPin, Radio } from 'lucide-react';

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
  { city: 'Pyongyang', country: 'North Korea', lat: 39.02, lng: 125.75 },
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
  { city: 'Bucharest', country: 'Romania', lat: 44.43, lng: 26.10 },
  { city: 'Seoul', country: 'South Korea', lat: 37.57, lng: 126.98 },
  { city: 'Johannesburg', country: 'South Africa', lat: -26.20, lng: 28.04 },
  { city: 'Mexico City', country: 'Mexico', lat: 19.43, lng: -99.13 },
];

const THREAT_TYPES: ThreatEvent['type'][] = ['breach', 'ddos', 'phishing', 'malware', 'ransomware', 'botnet'];
const SEVERITIES: ThreatEvent['severity'][] = ['low', 'medium', 'high', 'critical'];

function generateThreat(): ThreatEvent {
  const source = CITIES[Math.floor(Math.random() * CITIES.length)];
  let target = CITIES[Math.floor(Math.random() * CITIES.length)];
  while (target.city === source.city) target = CITIES[Math.floor(Math.random() * CITIES.length)];
  return {
    id: Math.random().toString(36).substr(2, 9),
    type: THREAT_TYPES[Math.floor(Math.random() * THREAT_TYPES.length)],
    source: { ...source },
    target: { ...target },
    severity: SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)],
    timestamp: Date.now(),
  };
}

const severityColors: Record<string, string> = {
  low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444',
};

const typeIcons: Record<string, string> = {
  breach: '🔓', ddos: '⚡', phishing: '🎣', malware: '🦠', ransomware: '💀', botnet: '🤖',
};

export default function ThreatMap() {
  const [threats, setThreats] = useState<ThreatEvent[]>([]);
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0 });
  const [selectedThreat, setSelectedThreat] = useState<ThreatEvent | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Generate threats periodically
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      const newThreat = generateThreat();
      setThreats(prev => {
        const updated = [newThreat, ...prev].slice(0, 100);
        const s = { total: updated.length, critical: 0, high: 0, medium: 0, low: 0 };
        updated.forEach(t => s[t.severity]++);
        setStats(s);
        return updated;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, [isPaused]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) { canvas.width = rect.width; canvas.height = rect.height; }
    };
    resize();
    window.addEventListener('resize', resize);

    const toXY = (lat: number, lng: number) => {
      const x = ((lng + 180) / 360) * canvas.width;
      const y = ((90 - lat) / 180) * canvas.height;
      return { x, y };
    };

    let particles: { x: number; y: number; tx: number; ty: number; progress: number; color: string; speed: number }[] = [];

    const draw = () => {
      if (canvas.width === 0 || canvas.height === 0) { animRef.current = requestAnimationFrame(draw); return; }
      ctx.fillStyle = 'rgba(5, 5, 10, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.03)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < canvas.width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let i = 0; i < canvas.height; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke();
      }

      // Draw continent outlines (simplified dots)
      CITIES.forEach(c => {
        const { x, y } = toXY(c.lat, c.lng);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 255, 100, 0.4)';
        ctx.fill();
        // Label
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(0, 255, 100, 0.25)';
        ctx.fillText(c.city, x + 6, y + 3);
      });

      // Add new particles from recent threats
      threats.slice(0, 10).forEach(t => {
        if (Math.random() > 0.95) {
          const from = toXY(t.source.lat, t.source.lng);
          const to = toXY(t.target.lat, t.target.lng);
          particles.push({
            x: from.x, y: from.y, tx: to.x, ty: to.y,
            progress: 0,
            color: severityColors[t.severity],
            speed: 0.008 + Math.random() * 0.012,
          });
        }
      });

      // Animate particles
      particles = particles.filter(p => p.progress < 1);
      particles.forEach(p => {
        p.progress += p.speed;
        const cx = p.x + (p.tx - p.x) * p.progress;
        const cy = p.y + (p.ty - p.y) * p.progress - Math.sin(p.progress * Math.PI) * 30;

        // Trail
        ctx.beginPath();
        ctx.arc(cx, cy, 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(')', ', 0.15)').replace('rgb', 'rgba');
        ctx.fill();

        // Impact flash
        if (p.progress > 0.95) {
          ctx.beginPath();
          ctx.arc(p.tx, p.ty, Math.max(0.1, 15 * Math.max(0, 1 - p.progress) * 20), 0, Math.PI * 2);
          ctx.strokeStyle = p.color.replace(')', ', 0.5)').replace('rgb', 'rgba');
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [threats]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 w-full">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <Globe className="w-8 h-8 text-cyan-400" /> Global Threat Map
          </h1>
          <p className="text-text-dim text-sm mt-1 font-mono">Live visualization of global cyber threat activity.</p>
        </div>
        <button onClick={() => setIsPaused(!isPaused)}
          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${isPaused ? 'border-accent/30 text-accent bg-accent/10' : 'border-error/30 text-error bg-error/10'}`}>
          {isPaused ? '▶ Resume' : '⏸ Pause'} Feed
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Events', value: stats.total, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: 'Critical', value: stats.critical, color: 'text-error', bg: 'bg-error/10' },
          { label: 'High', value: stats.high, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Medium', value: stats.medium, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Low', value: stats.low, color: 'text-green-400', bg: 'bg-green-500/10' },
        ].map((s, i) => (
          <div key={i} className={`glass-card p-3 rounded-xl text-center`}>
            <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-[9px] font-mono uppercase tracking-widest text-text-dim">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Map Canvas */}
      <div className="glass-card rounded-xl overflow-hidden relative" style={{ height: '400px' }}>
        <canvas ref={canvasRef} className="w-full h-full" style={{ background: 'radial-gradient(ellipse at center, #0a0f1a 0%, #050510 100%)' }} />
        <div className="absolute top-3 left-3 text-[9px] font-mono text-accent/50 uppercase tracking-widest flex items-center gap-2">
          <Radio className="w-3 h-3 animate-pulse" /> Live Threat Intelligence Feed
        </div>
      </div>

      {/* Live Event Feed */}
      <div className="glass-card p-5 rounded-xl">
        <h3 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" /> Live Event Feed
        </h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
          {threats.slice(0, 20).map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              onClick={() => setSelectedThreat(t)}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-surface border border-border-subtle/50 text-xs cursor-pointer hover:border-border-main transition-all"
            >
              <span className="text-lg">{typeIcons[t.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text-main uppercase">{t.type}</span>
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded`}
                    style={{ color: severityColors[t.severity], backgroundColor: severityColors[t.severity] + '20' }}>
                    {t.severity}
                  </span>
                </div>
                <p className="text-text-dim truncate">{t.source.city}, {t.source.country} → {t.target.city}, {t.target.country}</p>
              </div>
              <span className="text-text-dim/50 text-[10px] font-mono shrink-0">
                {new Date(t.timestamp).toLocaleTimeString()}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Threat Detail Modal */}
      {selectedThreat && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setSelectedThreat(null)}
        >
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()}
            className="glass-card max-w-md w-full p-6 rounded-2xl space-y-4"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{typeIcons[selectedThreat.type]}</span>
                <div>
                  <h3 className="text-lg font-black uppercase">{selectedThreat.type} Attack</h3>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                    style={{ color: severityColors[selectedThreat.severity], backgroundColor: severityColors[selectedThreat.severity] + '20' }}>
                    {selectedThreat.severity} severity
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
            <div className="text-[10px] font-mono text-text-dim text-center">
              Intercepted: {new Date(selectedThreat.timestamp).toLocaleString()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

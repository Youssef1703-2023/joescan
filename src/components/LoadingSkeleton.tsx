import { motion } from 'motion/react';
import { Shield } from 'lucide-react';
import { useState, useEffect } from 'react';

const MODULES = [
  'Initializing Security Modules...',
  'Loading Threat Intelligence...',
  'Connecting to OSINT Engines...',
  'Configuring Firewall Rules...',
  'Establishing Secure Connection...',
];

export default function LoadingSkeleton() {
  const [moduleIndex, setModuleIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setModuleIndex(prev => (prev + 1) % MODULES.length);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-base relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(0,255,136,0.03),transparent_60%)]" />
      
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(0,255,136,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.3) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      {/* Scanning line */}
      <motion.div
        className="absolute left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,136,0.3), transparent)' }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Logo pulse with glow ring */}
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          <div className="w-20 h-20 rounded-2xl bg-accent/5 border border-accent/20 flex items-center justify-center">
            <Shield className="w-10 h-10 text-accent" />
          </div>
          <div className="absolute inset-0 blur-2xl bg-accent/15 rounded-full" />
          {/* Orbiting dot */}
          <motion.div
            className="absolute w-2 h-2 bg-accent rounded-full"
            animate={{ 
              rotate: 360,
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            style={{ 
              top: -4, left: '50%', marginLeft: -4,
              transformOrigin: '4px 46px',
            }}
          />
        </motion.div>

        {/* Brand */}
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight">
            <span className="text-accent">JOE</span>
            <span className="text-text-main">SCAN</span>
            <span className="text-accent text-lg">•</span>
          </h1>
        </div>

        {/* Progress bar */}
        <div className="w-56 h-1 bg-bg-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #00ff88, #00d4ff, #00ff88)' }}
            initial={{ width: '0%', x: '-100%' }}
            animate={{ width: '100%', x: '0%' }}
            transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }}
          />
        </div>

        {/* Rotating status text */}
        <motion.p
          key={moduleIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 0.6, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-dim h-4"
        >
          {MODULES[moduleIndex]}
        </motion.p>
      </motion.div>
    </div>
  );
}

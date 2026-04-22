import { motion } from 'motion/react';
import { Shield } from 'lucide-react';

export default function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-base relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(0,255,136,0.03),transparent_60%)]" />
      
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: 'linear-gradient(rgba(0,255,136,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.3) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Logo pulse */}
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="relative"
        >
          <Shield className="w-16 h-16 text-accent" />
          <div className="absolute inset-0 blur-xl bg-accent/20 rounded-full" />
        </motion.div>

        {/* Brand */}
        <div className="text-center">
          <h1 className="text-2xl font-black tracking-tight">
            <span className="text-accent">JOE</span>
            <span className="text-text-main">SCAN</span>
            <span className="text-accent text-lg">•</span>
          </h1>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-dim mt-1">
            Initializing Security Modules
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-0.5 bg-bg-elevated rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-accent/50 to-accent rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
          />
        </div>

        {/* Status text */}
        <motion.p
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-[8px] font-mono uppercase tracking-widest text-text-dim"
        >
          Establishing Secure Connection...
        </motion.p>
      </motion.div>
    </div>
  );
}

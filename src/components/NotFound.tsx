import { Shield, Home, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

interface NotFoundProps {
  onNavigate: (tab: string) => void;
}

export default function NotFound({ onNavigate }: NotFoundProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
        className="space-y-6"
      >
        {/* Glitch 404 */}
        <div className="relative">
          <h1 className="text-[120px] md:text-[180px] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-accent/30 to-transparent select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <Shield className="w-16 h-16 text-accent/20" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-widest text-text-main">
            Sector Not Found
          </h2>
          <p className="text-sm text-text-dim font-mono max-w-md mx-auto">
            The requested intelligence module does not exist or has been classified.
            Return to the command center to continue your operations.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-4">
          <button
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2 px-6 py-3 bg-accent/10 border border-accent/20 text-accent rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-accent/20 transition-all"
          >
            <Home className="w-4 h-4" />
            Command Center
          </button>
        </div>

        {/* Decorative scan lines */}
        <div className="mt-8 flex flex-col items-center gap-1 opacity-20">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-px bg-accent/40" style={{ width: `${80 - i * 15}px` }} />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

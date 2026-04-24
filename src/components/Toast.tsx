import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  duration?: number;
}

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  success: { bg: 'rgba(0, 255, 136, 0.12)', border: 'rgba(0, 255, 136, 0.3)', text: '#00ff88', icon: '#00ff88' },
  error:   { bg: 'rgba(255, 59, 59, 0.12)', border: 'rgba(255, 59, 59, 0.3)', text: '#ff3b3b', icon: '#ff3b3b' },
  warning: { bg: 'rgba(255, 187, 0, 0.12)', border: 'rgba(255, 187, 0, 0.3)', text: '#ffbb00', icon: '#ffbb00' },
  info:    { bg: 'rgba(0, 150, 255, 0.12)', border: 'rgba(0, 150, 255, 0.3)', text: '#0096ff', icon: '#0096ff' },
};

let toastId = 0;

/** 
 * Show a toast notification from anywhere:
 * ```
 * showToast('success', 'Scan completed successfully!');
 * showToast('error', 'Failed to connect to API');
 * ```
 */
export function showToast(type: ToastType, message: string, duration: number = 4000) {
  window.dispatchEvent(new CustomEvent('toast', { detail: { type, message, duration } }));
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { type, message, duration = 4000 } = (e as CustomEvent).detail;
      const id = ++toastId;
      setToasts(prev => [...prev, { id, type, message, duration }]);
      setTimeout(() => removeToast(id), duration);
    };
    window.addEventListener('toast', handler);
    return () => window.removeEventListener('toast', handler);
  }, [removeToast]);

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ maxWidth: 400 }}>
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => {
          const Icon = ICONS[toast.type];
          const colors = COLORS[toast.type];
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 80, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl backdrop-blur-xl shadow-2xl cursor-pointer"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                backdropFilter: 'blur(20px)',
              }}
              onClick={() => removeToast(toast.id)}
            >
              <Icon className="w-5 h-5 shrink-0" style={{ color: colors.icon }} />
              <span className="text-sm font-medium flex-1" style={{ color: colors.text }}>
                {toast.message}
              </span>
              <button className="shrink-0 opacity-50 hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}>
                <X className="w-3.5 h-3.5" style={{ color: colors.text }} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

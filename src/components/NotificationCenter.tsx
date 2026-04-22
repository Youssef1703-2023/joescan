import { useState, useRef, useEffect } from 'react';
import { Bell, Check, Trash2, X, AlertTriangle, ShieldCheck, Info, MessageSquareWarning } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications, Notification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const { lang, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertTriangle className="w-5 h-5 text-error" />;
      case 'warning': return <MessageSquareWarning className="w-5 h-5 text-warning" />;
      case 'success': return <ShieldCheck className="w-5 h-5 text-accent" />;
      default: return <Info className="w-5 h-5 text-text-dim" />;
    }
  };

  const getTimeAgo = (date: any) => {
    if (!date?.toDate) return t('just_now' as any) || 'Just now';
    const diff = Math.floor((new Date().getTime() - date.toDate().getTime()) / 1000);
    if (diff < 60) return t('just_now' as any) || 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-dim hover:text-text-main hover:bg-bg-base rounded-full transition-colors focus:outline-none"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full shadow-[0_0_8px_var(--error)] animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-80 md:w-96 bg-bg-surface border border-border-subtle rounded-xl shadow-2xl overflow-hidden rtl:left-0 rtl:right-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-base/50">
              <h3 className="font-bold text-sm tracking-widest uppercase">{t('notifications_title')}</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] uppercase font-mono tracking-widest text-accent hover:text-accent-fg bg-accent/10 px-2 py-1 rounded"
                >
                  {t('mark_all_read')}
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-text-dim flex flex-col items-center justify-center">
                  <Bell className="w-8 h-8 opacity-20 mb-3" />
                  <p className="text-sm font-medium">{t('no_notifications')}</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map(notification => (
                    <div 
                      key={notification.id}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                      className={cn(
                        "p-4 border-b border-border-subtle transition-colors flex items-start gap-4 cursor-pointer",
                        !notification.read ? "bg-bg-base/80" : "bg-transparent opacity-80"
                      )}
                    >
                      <div className="shrink-0 mt-1">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                         <div className="flex justify-between items-start gap-2">
                           <h4 className={cn("text-sm font-bold truncate pr-2", !notification.read ? "text-text-main" : "text-text-main/80")}>
                             {notification.title}
                           </h4>
                           <span className="text-[10px] text-text-dim font-mono whitespace-nowrap pt-0.5">
                             {getTimeAgo(notification.createdAt)}
                           </span>
                         </div>
                         <p className="text-xs text-text-dim leading-relaxed line-clamp-2">
                           {notification.message}
                         </p>
                      </div>
                      {!notification.read && (
                         <div className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0 shadow-[0_0_5px_var(--accent)]" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2 border-t border-border-subtle bg-bg-base/50">
                <button 
                  onClick={clearAll}
                  className="w-full p-2 text-[11px] uppercase font-mono tracking-widest text-text-dim hover:text-error hover:bg-error/10 transition-colors rounded flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All History
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

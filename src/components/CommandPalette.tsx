import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Database, History, Mail, KeyRound, Smartphone, Link as LinkIcon,
  UserSearch, Globe, MessageSquareWarning, Wifi, Fingerprint, Monitor,
  Target, GraduationCap, BookOpen, Gift, Command, ArrowRight
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface CommandItem {
  id: string;
  label: string;
  labelAr: string;
  icon: React.ElementType;
  keywords: string[];
}

const COMMANDS: CommandItem[] = [
  { id: 'dashboard', label: 'Command Center', labelAr: 'مركز القيادة', icon: Database, keywords: ['dashboard', 'home', 'main', 'الرئيسية'] },
  { id: 'history', label: 'Scan History', labelAr: 'سجل الفحوصات', icon: History, keywords: ['history', 'log', 'past', 'السجل'] },
  { id: 'watchlist', label: 'Live Threat Watchlist', labelAr: 'قائمة المراقبة', icon: Target, keywords: ['watchlist', 'monitor', 'alert', 'المراقبة'] },
  { id: 'email', label: 'Email Audit', labelAr: 'فحص البريد', icon: Mail, keywords: ['email', 'breach', 'leak', 'البريد'] },
  { id: 'password', label: 'Password Vault Check', labelAr: 'فحص كلمة المرور', icon: KeyRound, keywords: ['password', 'vault', 'strength', 'كلمة المرور'] },
  { id: 'phone', label: 'Phone Number', labelAr: 'رقم الهاتف', icon: Smartphone, keywords: ['phone', 'number', 'mobile', 'الهاتف'] },
  { id: 'username', label: 'OSINT Username', labelAr: 'اسم المستخدم', icon: UserSearch, keywords: ['username', 'osint', 'social', 'المستخدم'] },
  { id: 'url', label: 'Suspicious Link', labelAr: 'رابط مشبوه', icon: LinkIcon, keywords: ['url', 'link', 'phishing', 'رابط'] },
  { id: 'message', label: 'Message Phishing', labelAr: 'رسالة تصيد', icon: MessageSquareWarning, keywords: ['message', 'phishing', 'sms', 'رسالة'] },
  { id: 'ip', label: 'IP Scan', labelAr: 'فحص الآي بي', icon: Wifi, keywords: ['ip', 'address', 'scan', 'آي بي'] },
  { id: 'domain', label: 'Domain WHOIS', labelAr: 'فحص النطاق', icon: Globe, keywords: ['domain', 'whois', 'dns', 'نطاق'] },
  { id: 'fingerprint', label: 'Browser Fingerprint', labelAr: 'بصمة المتصفح', icon: Fingerprint, keywords: ['fingerprint', 'browser', 'tracking', 'بصمة'] },
  { id: 'device_security', label: 'Device Security', labelAr: 'أمان الجهاز', icon: Monitor, keywords: ['device', 'security', 'scan', 'الجهاز'] },
  { id: 'academy', label: 'Cyber Academy', labelAr: 'أكاديمية الأمن', icon: GraduationCap, keywords: ['academy', 'learn', 'course', 'أكاديمية'] },
  { id: 'blog', label: 'Blog & News', labelAr: 'المدوّنة', icon: BookOpen, keywords: ['blog', 'news', 'article', 'مدوّنة'] },
  { id: 'referral', label: 'Refer Friends', labelAr: 'ادعِ أصحابك', icon: Gift, keywords: ['referral', 'invite', 'friends', 'دعوة'] },
];

interface Props {
  onNavigate: (tabId: string) => void;
}

export default function CommandPalette({ onNavigate }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { lang } = useLanguage();
  const isAr = lang === 'ar';

  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.labelAr.includes(q) ||
      cmd.keywords.some(k => k.includes(q))
    );
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setQuery('');
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const selectItem = (item: CommandItem) => {
    onNavigate(item.id);
    setIsOpen(false);
    setQuery('');
  };

  const handleKeyNav = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      selectItem(filtered[selectedIndex]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            className="fixed top-[15vh] left-1/2 w-[90vw] max-w-lg z-[9995] -translate-x-1/2"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          >
            <div className="rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: 'rgba(10, 10, 15, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <Search className="w-5 h-5 text-[#00ff88] shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={handleKeyNav}
                  placeholder={isAr ? 'ابحث عن أداة...' : 'Search tools...'}
                  className="flex-1 bg-transparent outline-none text-white text-sm placeholder-white/30 font-mono"
                  dir={isAr ? 'rtl' : 'ltr'}
                />
                <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-white/30 bg-white/5 rounded-md border border-white/10">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[50vh] overflow-y-auto py-2 scrollbar-hide">
                {filtered.length === 0 ? (
                  <div className="px-5 py-8 text-center text-white/30 text-sm font-mono">
                    {isAr ? 'مفيش نتائج' : 'No results found'}
                  </div>
                ) : (
                  filtered.map((cmd, i) => {
                    const Icon = cmd.icon;
                    const isSelected = i === selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => selectItem(cmd)}
                        onMouseEnter={() => setSelectedIndex(i)}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-all ${
                          isSelected
                            ? 'bg-[#00ff88]/10 text-[#00ff88]'
                            : 'text-white/60 hover:bg-white/5 hover:text-white/80'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#00ff88]' : 'text-white/30'}`} />
                        <span className="flex-1 text-sm font-medium truncate">
                          {isAr ? cmd.labelAr : cmd.label}
                        </span>
                        {isSelected && (
                          <ArrowRight className="w-3.5 h-3.5 text-[#00ff88]/60" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5 text-[10px] font-mono text-white/20 uppercase tracking-widest">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-white/30 border border-white/10">↑↓</kbd>
                    {isAr ? 'تنقل' : 'Navigate'}
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-white/30 border border-white/10">↵</kbd>
                    {isAr ? 'فتح' : 'Open'}
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Command className="w-3 h-3" /> 
                  {isAr ? 'لوحة الأوامر' : 'Command Palette'}
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Database, History, Mail, KeyRound, Smartphone, Link as LinkIcon,
  UserSearch, Globe, MessageSquareWarning, Wifi, Fingerprint, Monitor,
  ChevronLeft, ChevronRight, Menu, X, Target, ShieldAlert, Ticket, Key, Radio,
  Webhook, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { auth, getUserTier, SubscriptionTier, ADMIN_EMAIL } from '../lib/firebase';
import { Sparkles, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';

export type TabId = 'dashboard' | 'history' | 'watchlist' | 'email' | 'password' | 'phone' | 'url' | 'username' | 'message' | 'ip' | 'social' | 'domain' | 'fingerprint' | 'device_security' | 'pricing' | 'admin' | 'threat_map' | 'support' | 'api_keys' | 'siem' | 'team' | 'threat_3d';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
}

export default function Sidebar({ activeTab, setActiveTab, isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen }: SidebarProps) {
  const { lang, t } = useLanguage();
  const isRtl = lang === 'ar';
  
  const [userTier, setUserTier] = useState<SubscriptionTier>('free');

  useEffect(() => {
    if (auth.currentUser) {
      getUserTier(auth.currentUser.uid).then(t => setUserTier(t));
    }
  }, []);

  const isAdmin = auth.currentUser?.email === ADMIN_EMAIL;

  const navGroups = [
    ...(isAdmin ? [{
      title: 'Admin Console',
      items: [
        { id: 'admin', icon: ShieldAlert, label: 'System Control' },
      ]
    }] : []),
    {
      title: lang === 'ar' ? 'الأساسية' : 'Core',
      items: [
        { id: 'dashboard', icon: Database, label: t('nav_dashboard') },
        { id: 'history', icon: History, label: t('nav_history') },
        { id: 'watchlist', icon: Target, label: lang === 'ar' ? 'المراقبة المستمرة' : 'Live Watchlist' },
      ]
    },
    {
      title: lang === 'ar' ? 'أبحاث الأفراد' : 'People OSINT',
      items: [
        { id: 'email', icon: Mail, label: t('nav_email') },
        { id: 'password', icon: KeyRound, label: t('nav_password') },
        { id: 'phone', icon: Smartphone, label: t('nav_phone') },
        { id: 'username', icon: UserSearch, label: t('nav_username') },
      ]
    },
    {
      title: lang === 'ar' ? 'الشبكة والتقنية' : 'Network & System',
      items: [
        { id: 'url', icon: LinkIcon, label: t('nav_url') },
        { id: 'message', icon: MessageSquareWarning, label: t('nav_message') },
        { id: 'ip', icon: Wifi, label: t('nav_ip') },
        { id: 'domain', icon: Globe, label: lang === 'ar' ? 'فحص الدومين' : 'Domain WHOIS' },
        { id: 'fingerprint', icon: Fingerprint, label: lang === 'ar' ? 'بصمة المتصفح' : 'Fingerprint' },
        { id: 'device_security', icon: Monitor, label: lang === 'ar' ? 'أمان الجهاز' : 'Device Security' },
      ]
    },
    ...((userTier === 'enterprise' || isAdmin) ? [{
      title: lang === 'ar' ? 'المؤسسات' : 'SOC Enterprise',
      items: [
        { id: 'siem', icon: Webhook, label: lang === 'ar' ? 'SIEM / Webhooks' : 'SIEM / Webhooks' },
        { id: 'team', icon: Users, label: lang === 'ar' ? 'إدارة الفريق' : 'Team Management' },
        { id: 'threat_3d', icon: Globe, label: lang === 'ar' ? 'خريطة 3D' : '3D Threat Globe' },
      ]
    }] : [])
  ];

  const sidebarContent = (
    <div className="h-full flex flex-col pt-5 pb-4 overflow-y-auto scrollbar-hide">
      {/* Desktop Collapse Toggle */}
      <div className={cn(
        "hidden md:flex mb-6 text-text-dim px-4 items-center gap-2",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        {!isCollapsed && <span className="text-[10px] font-mono tracking-[0.2em] uppercase">{lang === 'ar' ? 'الأدوات' : 'Navigation'}</span>}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hover:text-accent hover:bg-accent/10 p-1.5 rounded-lg transition-colors border border-transparent hover:border-accent/20"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? (
            isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav Groups */}
      <div className="flex flex-col gap-6 flex-1 px-3">
        {navGroups.map((group, idx) => (
          <div key={idx} className="flex flex-col gap-1.5">
            {(!isCollapsed || isMobileOpen) && (
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-text-dim px-3 mb-1 opacity-70">
                {group.title}
              </h4>
            )}
            {group.items.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as TabId);
                    setIsMobileOpen(false); // Close mobile menu on select
                  }}
                  title={isCollapsed && !isMobileOpen ? tab.label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full text-sm font-bold group",
                    isActive
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : "text-text-dim hover:bg-bg-surface hover:text-text-main hover:border-border-subtle border border-transparent"
                  )}
                >
                  <Icon className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive ? "text-accent" : "group-hover:text-text-main"
                  )} />
                  {(!isCollapsed || isMobileOpen) && (
                    <span className="truncate">{tab.label}</span>
                  )}
                  {isActive && (!isCollapsed || isMobileOpen) && (
                    <div className="w-1.5 h-1.5 rounded-full bg-accent ml-auto animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Subscription Banner */}
      <div className={cn("mt-auto pt-6 px-4 pb-2 transition-all", isCollapsed && "hidden md:hidden")}>
        <button 
          onClick={() => { setActiveTab('pricing'); setIsMobileOpen(false); }}
          className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
            userTier === 'enterprise' 
              ? 'bg-error/10 border border-error/30 hover:border-error hover:bg-error/20' 
              : userTier === 'pro'
              ? 'bg-accent/10 border border-accent/30 hover:border-accent hover:bg-accent/20'
              : 'bg-gradient-to-r from-accent/20 to-purple-500/20 border border-border-subtle hover:border-accent relative overflow-hidden group'
          }`}
        >
           {userTier === 'free' && <div className="absolute inset-0 bg-accent/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />}
           <div className="flex items-center gap-3 relative z-10 w-full">
             <div className={`p-1.5 rounded-lg shrink-0 ${userTier === 'enterprise' ? 'bg-error/20 text-error' : userTier === 'pro' ? 'bg-accent/20 text-accent' : 'bg-bg-elevated'}`}>
               <Sparkles className="w-5 h-5" />
             </div>
             <div className="text-left w-full truncate">
               <div className="text-[11px] font-bold font-mono tracking-widest text-text-main uppercase overflow-hidden text-ellipsis whitespace-nowrap">
                 {isAdmin ? 'ROOT ADMINISTRATOR' : userTier === 'enterprise' ? 'SOC Enterprise' : userTier === 'pro' ? 'Pro Analyst' : 'Stealth Edition'}
               </div>
               {userTier === 'free' && !isAdmin && <div className="text-[10px] text-accent font-bold mt-0.5">Upgrade System &rarr;</div>}
             </div>
           </div>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed) */}
      <motion.aside
        initial={{ width: 240 }}
        animate={{ width: isCollapsed ? 70 : 240 }}
        className="hidden md:block sticky top-0 h-screen bg-bg-base border-r border-border-subtle border-l-transparent z-40 relative group shrink-0"
        style={{ borderLeftColor: isRtl ? 'rgba(var(--border-subtle-rgb), 0.1)' : 'transparent', borderRightColor: !isRtl ? 'rgba(var(--border-subtle-rgb), 0.1)' : 'transparent' }}
      >
        <div className="w-full h-full glass-surface">
          {sidebarContent}
        </div>
      </motion.aside>

      {/* Mobile Drawer (Overlay) */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
            />
            <motion.aside
              initial={{ x: isRtl ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed top-0 bottom-0 w-[260px] bg-bg-base border-border-subtle z-[110] md:hidden",
                isRtl ? "right-0 border-l" : "left-0 border-r"
              )}
            >
              <div className="flex h-16 items-center justify-between px-4 border-b border-border-subtle">
                <div className="font-mono text-xl uppercase tracking-tight flex items-center gap-2" dir="ltr">
                  <img src="/icon-512.png" alt="JoeScan" className="w-6 h-6 rounded-md" />
                  <div className="flex items-center">
                    <span className="font-light text-text-main">JOE</span>
                    <span className="font-black text-accent ml-0.5">SCAN</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  className="p-2 text-text-dim hover:text-text-main glass-surface rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="glass-surface border-none h-[calc(100vh-64px)] w-full">
                {sidebarContent}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

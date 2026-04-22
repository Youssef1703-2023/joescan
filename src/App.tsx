import { useState, useEffect, lazy, Suspense } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, isUserBanned, logActivity, ADMIN_EMAIL, getUserTier, getUserProfile, ensureUserProfile } from './lib/firebase';
import { LanguageProvider, useLanguage, LANGUAGE_OPTIONS } from './contexts/LanguageContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Sidebar, { TabId } from './components/Sidebar';
import NotificationCenter from './components/NotificationCenter';
import { Shield, LogOut, Moon, Sun, User as UserIcon, BrainCircuit, Menu, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

// Lazy-loaded page components (code splitting)
const LandingPage = lazy(() => import('./components/LandingPage'));
const EmailAnalyzer = lazy(() => import('./components/EmailAnalyzer'));
const PasswordAnalyzer = lazy(() => import('./components/PasswordAnalyzer'));
const PhoneAnalyzer = lazy(() => import('./components/PhoneAnalyzer'));
const UrlAnalyzer = lazy(() => import('./components/UrlAnalyzer'));
const UsernameAnalyzer = lazy(() => import('./components/UsernameAnalyzer'));
const MessageAnalyzer = lazy(() => import('./components/MessageAnalyzer'));
const IpAnalyzer = lazy(() => import('./components/IpAnalyzer'));
const SocialOsintScanner = lazy(() => import('./components/SocialOsintScanner'));
const DomainLookup = lazy(() => import('./components/DomainLookup'));
const BrowserFingerprint = lazy(() => import('./components/BrowserFingerprint'));
const DeviceSecurityCheck = lazy(() => import('./components/DeviceSecurityCheck'));
const Watchlist = lazy(() => import('./components/Watchlist'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const ScanHistory = lazy(() => import('./components/ScanHistory'));
const ProfileSettings = lazy(() => import('./components/ProfileSettings'));
const ApiSettingsModal = lazy(() => import('./components/ApiSettingsModal'));
const Pricing = lazy(() => import('./components/Pricing'));
const MfaGuard = lazy(() => import('./components/MfaGuard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const ThreatMap = lazy(() => import('./components/ThreatMap'));
const SiemWebhooks = lazy(() => import('./components/SiemWebhooks'));
const TeamManagement = lazy(() => import('./components/TeamManagement'));
const ThreatMap3D = lazy(() => import('./components/ThreatMap3D'));
import LoadingSkeleton from './components/LoadingSkeleton';

// Loading fallback
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
    <Loader2 className="w-8 h-8 animate-spin text-accent" />
    <span className="text-[10px] font-mono uppercase tracking-widest text-text-dim">Loading Module...</span>
  </div>
);

function AppContent() {
  const { lang, setLang, theme, setTheme, t } = useLanguage();
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mfaPassed, setMfaPassed] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [userTier, setUserTier] = useState('free');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u || (user && u.uid !== user.uid)) {
        setMfaPassed(false);
        if (user) localStorage.removeItem(`mfa_verified_${user.uid}`);
      } else if (u) {
        if (localStorage.getItem(`mfa_verified_${u.uid}`) === 'true') {
          setMfaPassed(true);
        }
      }
      setUser(u);
      setLoading(false);
      if (u) {
        // Load profile from Firestore (cross-device sync)
        ensureUserProfile(u.uid, u.email, u.displayName).then(profile => {
          if (profile?.avatarURL) setCustomAvatar(profile.avatarURL);
        });
        // Check ban status
        isUserBanned(u.uid).then(result => {
          setIsBanned(result.banned);
          if (result.reason) setBanReason(result.reason);
        });
        // Log login activity
        logActivity('login', 'User authenticated');
        // Fetch tier
        getUserTier(u.uid).then(t => setUserTier(t));
      } else {
        setCustomAvatar(null);
        setIsBanned(false);
      }
    });
    // Listen for avatar updates from ProfileSettings
    const onAvatarUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setCustomAvatar(detail);
      } else {
        // Fallback: reload from Firestore
        const u = auth.currentUser;
        if (u) {
          getUserProfile(u.uid).then(profile => {
            if (profile?.avatarURL) setCustomAvatar(profile.avatarURL);
          });
        }
      }
    };
    window.addEventListener('avatar_updated', onAvatarUpdate);
    return () => { unsub(); window.removeEventListener('avatar_updated', onAvatarUpdate); };
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    if (user) {
      localStorage.removeItem(`mfa_verified_${user.uid}`);
    }
    auth.signOut();
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!user) {
    return <LandingPage loading={loginLoading} onLogin={handleLogin} />;
  }

  if (!mfaPassed) {
    return <MfaGuard user={user} onVerified={() => {
      localStorage.setItem(`mfa_verified_${user.uid}`, 'true');
      setMfaPassed(true);
    }} onLogout={handleLogout} />;
  }

  if (isBanned) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <div className="mesh-bg" />
        <div className="relative z-10 flex flex-col items-center gap-6 text-center max-w-md px-6">
          <div className="w-20 h-20 rounded-full bg-error/10 border-2 border-error/50 flex items-center justify-center">
            <Shield className="w-10 h-10 text-error" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-error">Access Denied</h1>
          <p className="text-text-dim font-mono text-sm">Your account has been suspended by a system administrator.</p>
          {banReason && (
            <div className="bg-error/10 border border-error/30 rounded-xl p-4 w-full">
              <p className="text-[10px] font-mono uppercase text-error/70 mb-1">Reason</p>
              <p className="text-sm text-text-main">{banReason}</p>
            </div>
          )}
          <button onClick={handleLogout} className="px-8 py-3 bg-bg-elevated border border-border-subtle rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-bg-surface transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex font-sans bg-bg-base text-text-main relative overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mesh-bg" />
      <div className="grid-overlay" />

      {/* Sidebar Component */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative z-10 w-full">
        {/* Simplified Header */}
        <header className="glass-surface border-b border-border-subtle px-4 py-3 sm:py-4 flex flex-col justify-center sticky top-0 z-50 shrink-0">
          <div className="flex justify-between items-center gap-3">
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 text-text-dim hover:text-text-main hover:bg-bg-elevated rounded-lg transition-colors"
                title="Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2 cursor-default">
                <img src="/icon-512.png" alt="JoeScan" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg" />
                <div className="font-mono text-xl sm:text-2xl uppercase tracking-tight flex items-center" dir="ltr">
                  <span className="font-light text-text-main">JOE</span>
                  <span className="font-black text-accent ml-0.5">SCAN</span>
                  <div className="w-1.5 h-1.5 bg-accent rounded-full ml-1 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Right side of header */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Unified Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  const el = document.getElementById('joescan-settings-dropdown');
                  if (el) el.classList.toggle('hidden');
                }}
                title={lang === 'ar' ? 'الإعدادات' : 'Settings'}
                className="text-text-dim hover:text-accent transition-all flex items-center justify-center glass-surface p-2 rounded-xl hover:border-accent/30"
              >
                <BrainCircuit className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </button>
              <div
                id="joescan-settings-dropdown"
                className="hidden absolute right-0 top-full mt-2 w-56 bg-bg-base border border-border-subtle rounded-xl shadow-2xl p-3 space-y-3 z-[200]"
                onMouseLeave={() => document.getElementById('joescan-settings-dropdown')?.classList.add('hidden')}
              >
                {/* Theme */}
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-2">{lang === 'ar' ? 'المظهر' : 'Theme'}</p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${theme === 'dark' ? 'bg-accent text-accent-fg' : 'bg-bg-surface text-text-dim hover:text-text-main'}`}
                    >
                      <Moon className="w-3.5 h-3.5" /> Dark
                    </button>
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${theme === 'light' ? 'bg-accent text-accent-fg' : 'bg-bg-surface text-text-dim hover:text-text-main'}`}
                    >
                      <Sun className="w-3.5 h-3.5" /> Light
                    </button>
                  </div>
                </div>

                {/* Language */}
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-2">{lang === 'ar' ? 'اللغة' : 'Language'}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {LANGUAGE_OPTIONS.map(opt => (
                      <button
                        key={opt.code}
                        onClick={() => setLang(opt.code as any)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${lang === opt.code ? 'bg-accent text-accent-fg' : 'bg-bg-surface text-text-dim hover:text-text-main'}`}
                      >
                        <span>{opt.flag}</span> {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Provider */}
                <div>
                  <button
                    onClick={() => { setShowApiSettings(true); document.getElementById('joescan-settings-dropdown')?.classList.add('hidden'); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-bg-surface text-text-dim hover:text-accent hover:border-accent/30 border border-border-subtle transition-all text-xs font-semibold"
                  >
                    <BrainCircuit className="w-4 h-4" />
                    {lang === 'ar' ? 'إعدادات محرك الذكاء الاصطناعي' : 'AI Engine Settings'}
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 border-l border-border-subtle pl-2">
              <NotificationCenter />
            </div>

            <div className="flex items-center gap-2 md:gap-3 border-l border-border-subtle pl-2 sm:pl-3">
              <button
                onClick={() => setShowProfileSettings(true)}
                className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
              >
                <div className="hidden lg:flex flex-col items-end mr-1 text-right">
                  <span className="text-sm font-bold text-text-main">{user.displayName || 'Security Operator'}</span>
                  <span className="text-[10px] text-text-dim font-mono tracking-widest uppercase">{user.email || 'operator@joescan.cloud'}</span>
                </div>
                {(customAvatar || user.photoURL) ? (
                  <img src={customAvatar || user.photoURL!} alt="Profile" className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-accent/40 shadow-sm shadow-accent/10 object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-bg-elevated border-2 border-border-subtle flex justify-center items-center">
                    <UserIcon className="w-3.5 h-3.5 md:w-4 md:h-4 text-text-dim" />
                  </div>
                )}
              </button>
              <button
                onClick={handleLogout}
                title={t('logout')}
                className="text-text-dim hover:text-error transition-colors p-1"
              >
                <LogOut className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

        <main className="flex-1 w-full flex flex-col items-center p-4 md:p-8 overflow-y-auto overflow-x-hidden relative scrollbar-hide">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full flex-1 flex flex-col max-w-7xl"
          >
            <Suspense fallback={<PageLoader />}>
            {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab as any} />}
            {activeTab === 'history' && <ScanHistory />}
            {activeTab === 'watchlist' && <Watchlist />}
            {activeTab === 'email' && <EmailAnalyzer />}
            {activeTab === 'password' && <PasswordAnalyzer />}
            {activeTab === 'phone' && <PhoneAnalyzer />}
            {activeTab === 'url' && <UrlAnalyzer />}
            {activeTab === 'username' && <UsernameAnalyzer />}
            { activeTab === 'message' && <MessageAnalyzer /> }
            { activeTab === 'ip' && <IpAnalyzer /> }
            { activeTab === 'social' && <SocialOsintScanner /> }
            { activeTab === 'domain' && <DomainLookup /> }
            { activeTab === 'fingerprint' && <BrowserFingerprint /> }
            { activeTab === 'device_security' && <DeviceSecurityCheck /> }
            { activeTab === 'pricing' && <Pricing /> }
            { activeTab === 'threat_map' && <ThreatMap /> }
            { activeTab === 'siem' && (userTier === 'enterprise' || auth.currentUser?.email === ADMIN_EMAIL) && <SiemWebhooks /> }
            { activeTab === 'team' && (userTier === 'enterprise' || auth.currentUser?.email === ADMIN_EMAIL) && <TeamManagement /> }
            { activeTab === 'threat_3d' && (userTier === 'enterprise' || auth.currentUser?.email === ADMIN_EMAIL) && <ThreatMap3D /> }
            { activeTab === 'admin' && auth.currentUser?.email === ADMIN_EMAIL && <AdminDashboard /> }
            </Suspense>
          </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Modals outside the flex layout */}
      <AnimatePresence>
        {showProfileSettings && (
          <ProfileSettings
            onClose={() => setShowProfileSettings(false)}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>

      <ApiSettingsModal
        isOpen={showApiSettings}
        onClose={() => setShowApiSettings(false)}
      />
    </div>
  );
}
export default function App() {
  return (
    <LanguageProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </LanguageProvider>
  );
}

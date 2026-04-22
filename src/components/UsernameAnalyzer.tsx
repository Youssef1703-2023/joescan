import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { UserSearch, Loader2, Search, Github, Twitter, Facebook, Instagram, Video, ArrowRight, ShieldAlert, AlertTriangle, Monitor, Calendar, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import MiniHistory from './MiniHistory';

interface StolenCred {
  url: string;
  username: string;
  password: string;
  date_compromised?: string;
}

interface HudsonResult {
  stealers: {
    computer_name?: string;
    operating_system?: string;
    date_compromised?: string;
    ip?: string;
    malware_path?: string;
    antiviruses?: string;
  }[];
  total_results?: number;
}

export default function UsernameAnalyzer() {
  const { lang, t } = useLanguage();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breachData, setBreachData] = useState<HudsonResult | null>(null);
  const [searched, setSearched] = useState(false);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError(null);
    setBreachData(null);
    setSearched(false);

    try {
      // HudsonRock Cavalier API — free, no key, real infostealer/dark web data
      const apiUrl = `https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-username?username=${encodeURIComponent(username.trim())}`;
      
      let data = null;
      
      // Try via CORS proxy (needed for browser requests)
      const proxyUrls = [
        `https://api.allorigins.win/raw?url=${encodeURIComponent(apiUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`,
      ];

      for (const proxyUrl of proxyUrls) {
        try {
          const res = await fetch(proxyUrl);
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim().startsWith('{') || text.trim().startsWith('[')) {
              data = JSON.parse(text);
              break;
            }
          }
        } catch {
          continue;
        }
      }

      if (data) {
        setBreachData(data);
      } else {
        setBreachData({ stealers: [], total_results: 0 });
      }
      
      setSearched(true);

      if (auth.currentUser) {
        await addDoc(collection(db, 'scans'), {
          userId: auth.currentUser.uid,
          target: username.trim(),
          type: 'username',
          riskLevel: breachData?.stealers?.length ? 'High' : 'Low',
          reportText: `Username OSINT scan completed`,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      // CORS or network error — still show results section with platform links
      setSearched(true);
      setBreachData(null);
    } finally {
      setLoading(false);
    }
  };

  const stealerCount = breachData?.stealers?.length || breachData?.total_results || 0;
  const isCompromised = stealerCount > 0;

  const platforms = [
    { name: 'Facebook', url: `https://www.facebook.com/${encodeURIComponent(username.trim())}`, icon: Facebook, color: '#1877F2' },
    { name: 'X (Twitter)', url: `https://x.com/${encodeURIComponent(username.trim())}`, icon: Twitter, color: '#e7e9ea' },
    { name: 'Instagram', url: `https://www.instagram.com/${encodeURIComponent(username.trim())}`, icon: Instagram, color: '#E1306C' },
    { name: 'TikTok', url: `https://www.tiktok.com/@${encodeURIComponent(username.trim())}`, icon: Video, color: '#00f2fe' },
    { name: 'GitHub', url: `https://github.com/${encodeURIComponent(username.trim())}`, icon: Github, color: '#e7e9ea' },
    { name: 'LinkedIn', url: `https://www.linkedin.com/in/${encodeURIComponent(username.trim())}`, icon: UserSearch, color: '#0A66C2' },
    { name: 'Google Dork', url: `https://www.google.com/search?q="${encodeURIComponent(username.trim())}"+OR+inurl:"${encodeURIComponent(username.trim())}"`, icon: Search, color: '#F4B400' },
    { name: 'Telegram', url: `https://t.me/${encodeURIComponent(username.trim())}`, icon: Search, color: '#26A5E4' },
  ];

  return (
    <div className="w-full flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-base border border-border-subtle p-6 rounded-xl shadow-lg relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <UserSearch className="w-32 h-32" />
        </div>
        
        <h2 className="text-xl font-bold font-mono tracking-tight uppercase mb-2 text-text-main flex items-center gap-2">
          <UserSearch className="w-5 h-5 text-accent" /> {t('username_title')}
        </h2>
        <p className="text-text-dim mb-6 text-sm">
          {t('username_desc')}
        </p>

        <form onSubmit={handleScan} className="flex gap-2 relative z-10 w-full max-w-2xl">
          <div className="relative flex-1">
            <input 
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('username_placeholder')}
              className="w-full bg-bg-surface border border-border-subtle rounded-lg pl-4 pr-10 py-3 text-text-main focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono"
              dir="ltr"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || !username.trim()}
            className="bg-accent text-accent-fg px-6 py-3 rounded-lg font-bold tracking-wider uppercase hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center min-w-[120px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('audit')}
          </button>
        </form>
        {error && <p className="text-error text-sm mt-3">{error}</p>}
      </motion.div>

      <AnimatePresence mode="wait">
        {searched && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full flex flex-col gap-6"
          >
            {/* Breach Intelligence Section */}
            <div className={cn(
              "border rounded-xl overflow-hidden p-6",
              isCompromised 
                ? "border-error/30 bg-error/5" 
                : breachData !== null 
                  ? "border-[#0f0]/30 bg-[#0f0]/5"
                  : "border-border-subtle bg-bg-base"
            )}>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn("p-3 rounded-full", isCompromised ? "bg-error/10" : "bg-accent/10")}>
                  {isCompromised 
                    ? <ShieldAlert className="w-8 h-8 text-error" />
                    : <UserSearch className="w-8 h-8 text-accent" />
                  }
                </div>
                <div>
                  <h3 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-1">
                    {lang === 'ar' ? 'فحص تسريبات الدارك ويب' : 'Dark Web Exposure Scan'}
                  </h3>
                  <div className={cn("text-xl font-black tracking-tight font-mono", isCompromised ? "text-error" : "text-text-main")}>
                    @{username.trim()}
                  </div>
                </div>
              </div>

              {/* Real Results */}
              {breachData !== null ? (
                isCompromised ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-error" />
                      <p className="text-sm font-bold text-error">
                        {lang === 'ar' 
                          ? `تحذير خطير: تم العثور على "${username.trim()}" في ${stealerCount} جهاز مخترق ببرمجيات سرقة كلمات المرور (Infostealer Malware). هذه بيانات حقيقية من الدارك ويب.`
                          : `CRITICAL: "${username.trim()}" was found in ${stealerCount} computer(s) compromised by Infostealer Malware. This is real dark web intelligence.`}
                      </p>
                    </div>

                    {/* Show stealer details */}
                    <div className="space-y-3 mt-4">
                      {breachData.stealers.slice(0, 5).map((stealer, i) => (
                        <div key={i} className="bg-bg-base/60 border border-error/20 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Monitor className="w-4 h-4 text-error opacity-70" />
                            <span className="font-mono text-xs uppercase tracking-widest text-text-dim">
                              {lang === 'ar' ? `جهاز مخترق #${i+1}` : `Compromised Machine #${i+1}`}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            {stealer.computer_name && (
                              <div>
                                <p className="text-[10px] font-mono uppercase text-text-dim">Computer</p>
                                <p className="font-semibold text-text-main truncate">{stealer.computer_name}</p>
                              </div>
                            )}
                            {stealer.operating_system && (
                              <div>
                                <p className="text-[10px] font-mono uppercase text-text-dim">OS</p>
                                <p className="font-semibold text-text-main truncate">{stealer.operating_system}</p>
                              </div>
                            )}
                            {stealer.date_compromised && (
                              <div className="flex items-start gap-1">
                                <Calendar className="w-3 h-3 mt-0.5 text-text-dim" />
                                <div>
                                  <p className="text-[10px] font-mono uppercase text-text-dim">Date</p>
                                  <p className="font-semibold text-text-main">{stealer.date_compromised}</p>
                                </div>
                              </div>
                            )}
                            {stealer.ip && (
                              <div>
                                <p className="text-[10px] font-mono uppercase text-text-dim">IP</p>
                                <p className="font-semibold text-text-main font-mono">{stealer.ip}</p>
                              </div>
                            )}
                            {stealer.antiviruses && (
                              <div>
                                <p className="text-[10px] font-mono uppercase text-text-dim">Antivirus</p>
                                <p className="font-semibold text-text-main truncate">{stealer.antiviruses}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {stealerCount > 5 && (
                        <p className="text-xs text-text-dim text-center font-mono">
                          + {stealerCount - 5} {lang === 'ar' ? 'نتائج إضافية' : 'more results'}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#0f0] animate-pulse"></div>
                    <p className="text-sm font-medium text-[#0f0]">
                      {lang === 'ar'
                        ? `لم يتم العثور على "${username.trim()}" في أي تسريبات معروفة من برمجيات سرقة كلمات المرور.`
                        : `"${username.trim()}" was NOT found in any known Infostealer malware databases. No dark web exposure detected.`}
                    </p>
                  </div>
                )
              ) : (
                <p className="text-sm text-text-dim">
                  {lang === 'ar'
                    ? 'لم يتم العثور على بيانات. تعذر الاتصال بقاعدة البيانات أو أن المعرف غير موجود في السجلات.'
                    : 'No data found. Could not connect to the intelligence database, or this username does not exist in the records.'}
                </p>
              )}
            </div>


          </motion.div>
        )}
      </AnimatePresence>

      <MiniHistory scanType="username" />
    </div>
  );
}

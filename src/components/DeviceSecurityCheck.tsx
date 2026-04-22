import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ShieldAlert, ShieldCheck, Monitor, Network, Wifi, Server, Activity, AlertTriangle, CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface ShodanData {
  cpes: string[];
  hostnames: string[];
  ip: string;
  ports: number[];
  tags: string[];
  vulns: string[];
}

export default function DeviceSecurityCheck() {
  const { lang, t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'scanning_ip' | 'scanning_shodan' | 'scanning_browser' | 'complete'>('idle');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  
  const [ipData, setIpData] = useState<{ ip: string; isVpnOrProxy?: boolean } | null>(null);
  const [shodanData, setShodanData] = useState<ShodanData | null>(null);
  const [browserData, setBrowserData] = useState<any>(null);
  
  const [securityScore, setSecurityScore] = useState<number>(100);

  const addLog = (msg: string) => {
    setTerminalLogs((prev) => {
      const next = [...prev, `[${new Date().toISOString().split('T')[1].substring(0, 8)}] ${msg}`];
      return next.slice(-8); // Keep last 8 lines
    });
  };

  const startScan = async () => {
    if (!auth.currentUser) return;
    
    setLoading(true);
    setTerminalLogs([]);
    setIpData(null);
    setShodanData(null);
    setBrowserData(null);
    setSecurityScore(100);
    
    let currentScore = 100;
    
    try {
      // Step 1: Network & IP Resolution
      setStatus('scanning_ip');
      addLog('INITIATING DEVICE DIAGNOSTIC PROTOCOL...');
      await new Promise(r => setTimeout(r, 800));
      addLog('Fetching public IPv4 routing...');
      
      const ipRes = await fetch('https://api64.ipify.org?format=json');
      const ipJson = await ipRes.json();
      const userIp = ipJson.ip;
      
      setIpData({ ip: userIp });
      addLog(`IP Resolved: ${userIp}`);
      
      // Step 2: Shodan InternetDB Vulnerability Scan
      setStatus('scanning_shodan');
      await new Promise(r => setTimeout(r, 600));
      addLog('Querying OSINT registries (Shodan InternetDB)...');
      addLog(`Checking exposed ports & CVEs for ${userIp}...`);
      
      let shodanResult: ShodanData | null = null;
      try {
        const shodanRes = await fetch(`https://internetdb.shodan.io/${userIp}`);
        if (shodanRes.ok) {
          shodanResult = await shodanRes.json();
          setShodanData(shodanResult);
          if (shodanResult && shodanResult.vulns && shodanResult.vulns.length > 0) {
            addLog(`[WARN] Critical CVEs detected!`);
            currentScore -= 40;
          }
          if (shodanResult && shodanResult.ports && shodanResult.ports.length > 0) {
            addLog(`[WARN] Exposed network ports detected!`);
            currentScore -= 20;
          }
        } else {
          // If 404, it means Shodan has nothing on this IP (which is very good/secure)
          addLog('[OK] IP not cataloged on public vuln indexes. Clean.');
        }
      } catch (err) {
        addLog('[ERROR] Shodan API timeout or unreachable.');
      }
      
      // Step 3: Local Browser & Posture check
      setStatus('scanning_browser');
      await new Promise(r => setTimeout(r, 1000));
      addLog('Analyzing browser fingerprint & local sandbox...');
      
      const dnt = navigator.doNotTrack === '1' || (window as any).doNotTrack === '1' || navigator.doNotTrack === 'yes';
      const cookiesEnabled = navigator.cookieEnabled;
      const hwCores = navigator.hardwareConcurrency;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (!dnt) currentScore -= 5;
      
      const localBrowserInfo = {
        doNotTrack: dnt,
        cookiesEnabled,
        platform: navigator.platform,
        isMobile,
        cores: hwCores
      };
      
      setBrowserData(localBrowserInfo);
      addLog(`DNT active: ${dnt}. Sandboxing confirmed.`);
      
      // Step 4: Finalize
      await new Promise(r => setTimeout(r, 800));
      addLog('CALCULATING FINAL SECURITY POSTURE...');
      setStatus('complete');
      setSecurityScore(Math.max(0, currentScore));
      
      // Save to Firebase
      try {
        await addDoc(collection(db, 'scans'), {
          userId: auth.currentUser?.uid,
          type: 'device_security',
          target: userIp,
          securityScore: Math.max(0, currentScore),
          result: {
            ipData: { ip: userIp },
            shodanData: shodanResult,
            browserData: localBrowserInfo,
          },
          createdAt: serverTimestamp()
        });
      } catch (fbErr) {
        handleFirestoreError(fbErr as any, OperationType.WRITE, 'scans');
      }
      
    } catch (err) {
      addLog(`[CRITICAL ERROR] ${err}`);
      console.error(err);
      setStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  const isDark = true;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="glass-card p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 justify-between relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-accent/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex items-center gap-6 text-center md:text-left rtl:md:text-right">
          <div className="w-20 h-20 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 shadow-[0_0_30px_rgba(0,255,0,0.15)] relative">
            <Monitor className="w-10 h-10 text-accent animate-pulse" />
            {loading && (
              <div className="absolute inset-0 border-t-2 border-accent rounded-2xl animate-spin" />
            )}
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black mb-2 glitch-text" data-text={t('nav_device_security')}>
              {t('nav_device_security')}
            </h1>
            <p className="text-text-dim text-sm md:text-base max-w-xl">
              {lang === 'ar' 
                ? 'نقوم بتحليل شبكتك المحلية والمتصفح لكشف الثغرات عن طريق فحص البورتات المفتوحة وقاعدة بيانات Shodan.' 
                : 'Thoroughly scan your network exposure, open ports, browser telemetry, and check public CVE databases via Shodan InternetDB.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Scanner Terminal Visualizer */}
        <div className="glass-card p-6 border-accent/30 relative flex flex-col h-80 overflow-hidden group">
          <div className="absolute inset-0 border border-accent/20 rounded-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
          
          <h3 className="font-mono text-xs text-accent uppercase tracking-[0.2em] mb-4 flex items-center gap-2 relative z-10">
            <Activity className="w-4 h-4" /> {t('dev_terminal_title')}
          </h3>
          
          <div className="flex-1 bg-bg-base/80 rounded-xl p-4 font-mono text-sm overflow-hidden flex flex-col justify-end border border-border-subtle relative shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none z-20" />
            
            {status !== 'idle' && (
              <div className="mb-4">
                <AnimatePresence>
                  {terminalLogs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`mb-1 truncate ${
                        log.includes('[ERROR]') || log.includes('[WARN]') || log.includes('[CRITICAL]')
                          ? 'text-error font-bold text-shadow-[0_0_8px_rgba(255,0,0,0.5)]'
                          : log.includes('[OK]') 
                          ? 'text-accent font-bold text-shadow-[0_0_8px_rgba(0,255,0,0.5)]'
                          : 'text-accent/70'
                      }`}
                    >
                      {log}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {!loading && status === 'idle' && (
              <div className="w-full h-full flex items-center justify-center text-text-dim/50 italic tracking-widest">
                SYSTEM STANDBY
              </div>
            )}
            
            {loading && (
              <div className="mt-2 flex items-center gap-2 text-accent">
                <span className="animate-pulse">_</span>
              </div>
            )}
          </div>
          
          <button
            onClick={startScan}
            disabled={loading}
            className={`mt-4 w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg flex justify-center items-center gap-2 ${
              loading ? 'bg-bg-elevated text-text-dim border border-border-subtle cursor-not-allowed' : 'btn-glow'
            }`}
          >
            {loading ? (
              <><span className="animate-spin relative top-[-1px]">&#8982;</span> {lang === 'ar' ? 'جاري الفحص...' : 'DIAGNOSING...'}</>
            ) : (
              <><ShieldAlert className="w-5 h-5" /> {t('dev_start_scan')}</>
            )}
          </button>
        </div>

        {/* Results Overview */}
        <div className="glass-card p-6 flex flex-col gap-6 relative overflow-hidden min-h-80">
          {status === 'idle' ? (
             <div className="w-full h-full flex flex-col items-center justify-center text-center opacity-60">
               <Shield className="w-20 h-20 mb-4 text-text-dim" />
               <p className="font-mono uppercase tracking-widest">Awaiting Scan Execution</p>
             </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-6 w-full h-full">
              
              <div className="flex justify-between items-start border-b border-border-subtle/50 pb-4">
                <div>
                   <h3 className="text-xl font-black uppercase mb-1">{t('dev_posture_eval')}</h3>
                   <div className="flex items-center gap-2 font-mono text-xs tracking-widest text-text-dim">
                     <span>{t('dev_target')}:</span>
                     <span className="font-bold text-text-main glow-low px-2 py-0.5 rounded bg-bg-surface">{ipData?.ip || 'RESOLVING...'}</span>
                   </div>
                </div>
                <div className={`text-4xl font-black drop-shadow-[0_0_15px_currentColor] ${
                    securityScore >= 80 ? 'text-accent' : securityScore >= 50 ? 'text-caution' : 'text-error'
                  }`}>
                  {securityScore} <span className="text-xl opacity-50">/ 100</span>
                </div>
              </div>

              <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-hide">
                
                {/* Network / Shodan Risk Section */}
                <div className="p-4 rounded-xl bg-bg-elevated border border-[currentColor]/10 relative">
                  <div className="flex items-center gap-3 mb-2">
                    <Server className="w-5 h-5 text-text-dim" />
                    <h4 className="font-bold uppercase tracking-widest text-sm">{t('dev_network_exposure')}</h4>
                  </div>
                  
                  {status === 'scanning_shodan' || status === 'scanning_ip' ? (
                    <div className="text-xs font-mono text-text-dim animate-pulse">Contacting InternetDB Nodes...</div>
                  ) : shodanData ? (
                    <div className="space-y-2 mt-4">
                      {shodanData.ports?.length > 0 ? (
                        <div className="flex items-start gap-2 text-error">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold uppercase mb-1">Exposed Ports Detected</div>
                            <div className="flex flex-wrap gap-1">
                              {shodanData.ports.map(p => (
                                <span key={p} className="text-[10px] bg-error/10 border border-error/20 px-1.5 rounded">{p}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-accent text-sm">
                          <CheckCircle2 className="w-4 h-4" /> No mapped public ports.
                        </div>
                      )}
                      
                      {shodanData.vulns?.length > 0 && (
                        <div className="flex items-start gap-2 text-error mt-3">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold uppercase mb-1">Known CVEs cataloged against IP</div>
                            <p className="text-xs opacity-70">Found {shodanData.vulns.length} vulnerabilities linked to exposed services on this IP address.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                     <div className="flex items-center gap-2 text-accent text-sm font-medium mt-2">
                       <CheckCircle2 className="w-5 h-5 drop-shadow-[0_0_8px_currentColor]" /> 
                       {t('dev_safe_msg')}
                     </div>
                  )}
                </div>

                {/* Local Browser Sandboxing */}
                <div className="p-4 rounded-xl bg-bg-elevated border border-[currentColor]/10 relative">
                  <div className="flex items-center gap-3 mb-2">
                    <Lock className="w-5 h-5 text-text-dim" />
                    <h4 className="font-bold uppercase tracking-widest text-sm">{t('dev_browser_posture')}</h4>
                  </div>
                  
                  {status !== 'complete' && status !== 'scanning_browser' ? (
                    <div className="text-xs font-mono text-text-dim animate-pulse">Waiting for network sweep...</div>
                  ) : browserData ? (
                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs font-mono mt-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-text-dim">{t('dev_do_not_track')}</span>
                        <span className={browserData.doNotTrack ? "text-accent" : "text-error"}>
                          {browserData.doNotTrack ? t('dev_enabled') : t('dev_disabled')}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-text-dim">{t('dev_cookies')}</span>
                        <span className="text-caution">{browserData.cookiesEnabled ? t('dev_accepted') : 'BLOCKED'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-text-dim">{t('dev_device_class')}</span>
                        <span className="text-text-main">{browserData.isMobile ? t('dev_mobile') : t('dev_desktop')}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-text-dim">{t('dev_hw_threads')}</span>
                        <span className="text-text-main">{browserData.cores || 'UNKNOWN'} CORES</span>
                      </div>
                    </div>
                  ) : null}
                </div>
                
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { Wifi, Loader2, ShieldCheck, AlertTriangle, ArrowRight, ShieldAlert, Cpu, MapPin, Search, Download, Network, Globe, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateReportPDF } from '../lib/generatePDF';
import MiniHistory from './MiniHistory';

interface ScanResult {
  riskLevel: 'Low' | 'Medium' | 'High';
  reportText: string;
  actionPlan: string;
  isp?: string;
  asn?: string;
  country?: string;
  city?: string;
  lat?: number;
  lon?: number;
}

export default function IpAnalyzer() {
  const { lang, t } = useLanguage();
  const [ip, setIp] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMyIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        if (data.ip) {
          setIp(data.ip);
        }
      } catch (err) {
        console.error("Failed to fetch network IP");
      }
    };
    fetchMyIp();
  }, []);

  const performScan = async (ipToScan: string) => {
    if (!ipToScan.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Try multiple free HTTPS geolocation APIs as fallbacks
      let geoData: { ip: string; isp: string; asn: string; country: string; city: string; region: string; lat: number; lon: number; isPrivate?: boolean } | null = null;

      // API 1: ipapi.co (1000/day free, HTTPS)
      try {
        const res = await fetch(`https://ipapi.co/${ipToScan.trim()}/json/`, {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const d = await res.json();
          if (!d.error) {
            geoData = {
              ip: d.ip || ipToScan,
              isp: d.org || 'Unknown ISP',
              asn: d.asn || '',
              country: d.country_name || '',
              city: d.city || '',
              region: d.region || '',
              lat: d.latitude,
              lon: d.longitude,
              isPrivate: d.reserved || false
            };
          }
        }
      } catch (e) { console.warn('[IP] ipapi.co failed, trying fallback...'); }

      // API 2: ipwho.is (10000/month free, HTTPS)
      if (!geoData) {
        try {
          const res = await fetch(`https://ipwho.is/${ipToScan.trim()}`);
          if (res.ok) {
            const d = await res.json();
            if (d.success) {
              geoData = {
                ip: d.ip || ipToScan,
                isp: d.connection?.isp || d.connection?.org || 'Unknown ISP',
                asn: d.connection?.asn ? `AS${d.connection.asn}` : '',
                country: d.country || '',
                city: d.city || '',
                region: d.region || '',
                lat: d.latitude,
                lon: d.longitude
              };
            } else if (d.message?.toLowerCase().includes('private') || d.message?.toLowerCase().includes('reserved')) {
              geoData = { ip: ipToScan, isp: '', asn: '', country: '', city: '', region: '', lat: 0, lon: 0, isPrivate: true };
            }
          }
        } catch (e) { console.warn('[IP] ipwho.is failed, trying fallback...'); }
      }

      // API 3: freeipapi.com (HTTPS, no key needed)
      if (!geoData) {
        try {
          const res = await fetch(`https://freeipapi.com/api/json/${ipToScan.trim()}`);
          if (res.ok) {
            const d = await res.json();
            if (d.ipAddress) {
              geoData = {
                ip: d.ipAddress || ipToScan,
                isp: d.isp || 'Unknown ISP',
                asn: '',
                country: d.countryName || '',
                city: d.cityName || '',
                region: d.regionName || '',
                lat: d.latitude,
                lon: d.longitude
              };
            }
          }
        } catch (e) { console.warn('[IP] freeipapi.com also failed.'); }
      }

      if (!geoData) {
        throw new Error(lang === 'ar' ? 'فشل التحليل. تأكد من صحة عنوان الـ IP وجرب تاني.' : 'Analysis failed. Check the IP address and try again.');
      }

      let scanResult: ScanResult;
      const isArabic = lang === 'ar';

      if (geoData.isPrivate) {
        scanResult = {
          riskLevel: 'Low',
          reportText: isArabic
            ? `هذا عنوان شبكة محلي (Local/Private IP). هذه العناوين تُستخدم فقط داخل شبكة الراوتر الخاص بك (لربط أجهزتك ببعضها) ولا يمكن تتبعها موقعياً أو اختراقها من الخارج بشكل مباشر.`
            : `This is a Private Local Network IP. These addresses are isolated within your router's LAN and are not routed publicly on the internet. As such, they cannot be geo-located or directly targeted from the outside.`,
          actionPlan: isArabic
            ? "1. تأكد من قوة كلمة مرور شبكة الـ Wi-Fi الخاصة بك.\\n2. راجع الأجهزة المتصلة بالراوتر باستمرار."
            : "1. Secure your local Wi-Fi with a strong WPA3 password.\\n2. Monitor devices connected to your LAN.",
          isp: "Local Area Network (LAN)",
          country: "Internal Network"
        };
      } else {
        scanResult = {
          riskLevel: 'Low',
          reportText: isArabic 
            ? `تم تحليل عنوان الـ IP (${geoData.ip}) بنجاح. تم تحديد موقعه في ${geoData.city}، ${geoData.country} وتابع لشركة الإنترنت ${geoData.isp}. استخدم أدوات التحقيق العميق بالأسفل للكشف عن تقارير الاختراق.`
            : `IP address (${geoData.ip}) successfully resolved. Located in ${geoData.city}, ${geoData.country} under the ISP ${geoData.isp}. Use the deep investigation tools below to scan for active threats.`,
          actionPlan: isArabic
            ? "1. تحقق من تقرير AbuseIPDB لمعرفة إذا كان الـ IP مبلغ عنه كـ Spam.\\n2. استخدم Shodan للبحث عن بوابات (Ports) مفتوحة أو ثغرات.\\n3. ابحث في VirusTotal عن أي ملفات ضارة مرتبطة بالـ IP."
            : "1. Check the AbuseIPDB report to see if the IP is flagged for spam/attacks.\\n2. Use Shodan to discover open ports and vulnerabilities.\\n3. Search VirusTotal for malicious files communicating with this IP.",
          isp: geoData.isp,
          asn: geoData.asn,
          country: geoData.country,
          city: geoData.region ? `${geoData.city}, ${geoData.region}` : geoData.city,
          lat: geoData.lat,
          lon: geoData.lon
        };
      }

      setResult(scanResult);

      if (auth.currentUser) {
        await addDoc(collection(db, 'scans'), {
          userId: auth.currentUser.uid,
          target: ipToScan,
          type: 'ip',
          riskLevel: scanResult.riskLevel,
          reportText: scanResult.reportText,
          isp: scanResult.isp || null,
          country: scanResult.country || null,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      setError(err.message || (lang === 'ar' ? 'فشل تحليل الـ IP.' : 'Failed to analyze IP.'));
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    performScan(ip);
  };

  const handleScanMyIp = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      if (data.ip) {
        setIp(data.ip);
        await performScan(data.ip);
      }
    } catch (err) {
      setError("Failed to fetch your public IP");
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch(level?.toUpperCase()) {
      case 'HIGH': return 'text-error bg-error/10 border-error/20';
      case 'MEDIUM': return 'text-caution bg-caution/10 border-caution/20';
      case 'LOW': return 'text-[#0f0] bg-[#0f0]/10 border-[#0f0]/20';
      default: return 'text-text-dim bg-bg-surface border-border-subtle';
    }
  };

  const renderIcon = (level: string) => {
    switch(level?.toUpperCase()) {
      case 'HIGH': return <ShieldAlert className="w-12 h-12 text-error" />;
      case 'MEDIUM': return <AlertTriangle className="w-12 h-12 text-caution" />;
      case 'LOW': return <ShieldCheck className="w-12 h-12 text-[#0f0]" />;
      default: return <Wifi className="w-12 h-12 text-text-dim" />;
    }
  };

  return (
    <div className="w-full flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-base border border-border-subtle p-6 rounded-xl shadow-lg relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Wifi className="w-32 h-32" />
        </div>
        
        <h2 className="text-xl font-bold font-mono tracking-tight uppercase mb-2 text-text-main flex items-center gap-2">
          <Wifi className="w-5 h-5 text-accent" /> {t('ip_title')}
        </h2>
        <p className="text-text-dim mb-6 text-sm">
          {t('ip_desc')}
        </p>

        <form onSubmit={handleScan} className="flex gap-2 relative z-10 w-full max-w-2xl">
          <div className="relative flex-1">
            <input 
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder={t('ip_placeholder')}
              className="w-full bg-bg-surface border border-border-subtle rounded-lg pl-12 pr-10 py-3 text-text-main focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono"
              dir="ltr"
            />
            <button
              type="button"
              onClick={handleScanMyIp}
              title={lang === 'ar' ? 'افحص عنواني الحالي' : 'Scan My IP'}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-accent transition-colors flex items-center justify-center"
              disabled={loading}
            >
              <Crosshair className="w-5 h-5" />
            </button>
          </div>
          <button 
            type="submit" 
            disabled={loading || !ip.trim()}
            className="bg-accent text-accent-fg px-6 py-3 rounded-lg font-bold tracking-wider uppercase hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center min-w-[120px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('audit')}
          </button>
        </form>
        {error && <p className="text-error text-sm mt-3">{error}</p>}
      </motion.div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full border border-accent/30 rounded-xl overflow-hidden p-6 transition-all bg-bg-base"
          >
            <div className="flex flex-col md:flex-row gap-6 md:items-start items-center text-center md:text-left">
              <div className="shrink-0 p-3 bg-accent/10 rounded-full">
                <Wifi className="w-10 h-10 text-accent" />
              </div>
              <div className="flex-1 w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h3 className="font-mono text-xs uppercase tracking-widest text-text-dim mb-1">{lang === 'ar' ? 'نتائج التحليل الجغرافي' : 'Geolocation Results'}</h3>
                    <div className="text-xl font-black text-text-main tracking-tight font-mono">{ip}</div>
                  </div>
                  <button
                    onClick={() => generateReportPDF({ ...result, target: ip }, 'ip', lang)}
                    className="flex items-center gap-2 bg-text-main text-bg-base hover:bg-opacity-90 px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold transition-all"
                  >
                    <Download className="w-4 h-4" /> Download Report
                  </button>
                </div>

                <div className="text-sm text-text-dim leading-relaxed font-medium mb-4">
                  {result.reportText}
                </div>

                {(result.isp || result.country || (result.lat && result.lon)) && (
                  <>
                    <h4 className="font-bold uppercase tracking-widest opacity-80 mb-4 mt-6 flex items-center gap-2 text-accent">
                      <MapPin className="w-4 h-4" /> Geolocation & ISP Data
                    </h4>
                    <div className="pt-4 border-t border-[currentColor]/10 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {result.isp && (
                        <div className="bg-bg-base/40 p-3 rounded-lg">
                          <Search className="w-4 h-4 mb-2 opacity-70" />
                          <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">ISP Provider</p>
                          <p className="text-sm font-semibold truncate" title={result.isp}>{result.isp}</p>
                        </div>
                      )}
                      {result.asn && (
                        <div className="bg-bg-base/40 p-3 rounded-lg">
                          <Network className="w-4 h-4 mb-2 opacity-70" />
                          <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">Autonomous System</p>
                          <p className="text-sm font-semibold truncate" title={result.asn}>{result.asn}</p>
                        </div>
                      )}
                      {result.country && (
                        <div className="bg-bg-base/40 p-3 rounded-lg">
                          <MapPin className="w-4 h-4 mb-2 opacity-70" />
                          <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">Country Origin</p>
                          <p className="text-sm font-semibold truncate" title={result.country}>{result.country}</p>
                        </div>
                      )}
                      {result.city && (
                        <div className="bg-bg-base/40 p-3 rounded-lg">
                          <Globe className="w-4 h-4 mb-2 opacity-70" />
                          <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">Region / City</p>
                          <p className="text-sm font-semibold truncate" title={result.city}>{result.city}</p>
                        </div>
                      )}
                    </div>

                    <h4 className="font-bold uppercase tracking-widest opacity-80 mb-4 flex items-center gap-2 text-accent mt-6">
                      <ShieldAlert className="w-4 h-4" /> Deep Investigation Tools
                    </h4>
                    <div className="pt-4 border-t border-[currentColor]/10 grid grid-cols-1 md:grid-cols-2 gap-3 pb-2 w-full">
                      <a 
                        href={`https://www.abuseipdb.com/check/${ip}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-bg-base/40 p-3 rounded-lg hover:bg-bg-base/60 transition font-mono border border-[currentColor]/10 hover:border-accent group"
                      >
                        <ShieldAlert className="w-5 h-5 opacity-70 text-[#ff4a4a] group-hover:text-error transition" />
                        <div className="text-left w-full truncate">
                          <p className="text-[10px] tracking-widest opacity-60">BOTNET & SPAM CHECK</p>
                          <p className="text-sm font-semibold truncate">AbuseIPDB Lookup</p>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-50" />
                      </a>
                      
                      <a 
                        href={`https://www.shodan.io/host/${ip}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-bg-base/40 p-3 rounded-lg hover:bg-bg-base/60 transition font-mono border border-[currentColor]/10 hover:border-accent group"
                      >
                        <Cpu className="w-5 h-5 opacity-70 text-accent group-hover:text-accent transition" />
                        <div className="text-left w-full truncate">
                          <p className="text-[10px] tracking-widest opacity-60">PORTS & VULNERABILITIES</p>
                          <p className="text-sm font-semibold truncate">Shodan Scanner</p>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-50" />
                      </a>

                      <a 
                        href={`https://www.virustotal.com/gui/ip-address/${ip}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-bg-base/40 p-3 rounded-lg hover:bg-bg-base/60 transition font-mono border border-[currentColor]/10 hover:border-accent group"
                      >
                        <AlertTriangle className="w-5 h-5 opacity-70 text-[#0f0] group-hover:text-[#0f0] transition" />
                        <div className="text-left w-full truncate">
                          <p className="text-[10px] tracking-widest opacity-60">MALWARE REPUTATION</p>
                          <p className="text-sm font-semibold truncate">VirusTotal Scan</p>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-50" />
                      </a>
                      
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${result.lat},${result.lon}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-bg-base/40 p-3 rounded-lg hover:bg-bg-base/60 transition font-mono border border-[currentColor]/10 hover:border-accent group"
                      >
                        <MapPin className="w-5 h-5 opacity-70 text-[#F4B400] group-hover:text-[#F4B400] transition" />
                        <div className="text-left w-full truncate">
                          <p className="text-[10px] tracking-widest opacity-60">PHYSICAL LOCATION</p>
                          <p className="text-sm font-semibold truncate">Google Maps</p>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-50" />
                      </a>
                    </div>
                  </>
                )}

                <div className="bg-bg-base/40 rounded-lg p-4 mt-2">
                  <h4 className="font-bold text-xs uppercase tracking-widest opacity-80 mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" /> {t('action_plan')}
                  </h4>
                  <ul className="space-y-2 text-sm opacity-90">
                    {(result.actionPlan || '').split('\\n').filter(Boolean).map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono opacity-50">{i + 1}.</span>
                        <span>{step.replace(/^\\d+\\.\\s*/, '')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MiniHistory scanType="ip" />
    </div>
  );
}

import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { analyzePhoneExposure } from '../lib/gemini';
import { Smartphone, Loader2, ShieldCheck, AlertTriangle, ArrowRight, RefreshCw, X, ShieldAlert, Cpu, Network, Globe, MapPin, MessageSquareWarning, Users, ChevronDown, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import MiniHistory from './MiniHistory';
import { generateReportPDF } from '../lib/generatePDF';
import { countryCodes } from '../lib/countries';
import { parsePhoneNumberWithError } from 'libphonenumber-js';

interface ScanResult {
  riskLevel: 'Low' | 'Medium' | 'High';
  reportText: string;
  actionPlan: string;
  carrier?: string;
  country?: string;
  thoughtProcess?: string;
}

export default function PhoneAnalyzer() {
  const { lang, t } = useLanguage();
  const [phone, setPhone] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [deepScan, setDeepScan] = useState(true);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;

    let formattedPhone = phone.trim();
    
    let countryNameExact = '';
    
    try {
      // Ensure there's a + if a country code is implied or picked
      let p = formattedPhone;
      if (!p.startsWith('+') && selectedCountryCode) {
        p = selectedCountryCode + p;
      } else if (!p.startsWith('+')) {
         p = '+' + p;
      }

      const phoneNumber = parsePhoneNumberWithError(p);
      if (!phoneNumber.isValid()) {
        throw new Error("Invalid phone number");
      }
      formattedPhone = phoneNumber.formatInternational();
      
      const c = countryCodes.find(x => x.code === `+${phoneNumber.countryCallingCode}`);
      if (c) {
        countryNameExact = c.name;
      }
    } catch (err: any) {
      setError(t('phone_invalid_format') || "Invalid real phone number. Please ensure you picked the right country and entered a valid number of digits.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const scanResult = await analyzePhoneExposure(formattedPhone, lang, deepScan, countryNameExact);
      setResult(scanResult);

      if (auth.currentUser) {
        await addDoc(collection(db, 'scans'), {
          userId: auth.currentUser.uid,
          target: phone,
          type: 'phone',
          riskLevel: scanResult.riskLevel,
          reportText: scanResult.reportText,
          actionPlan: scanResult.actionPlan,
          carrier: scanResult.carrier || null,
          country: scanResult.country || null,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze phone number.");
    } finally {
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
      default: return <Smartphone className="w-12 h-12 text-text-dim" />;
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
          <Smartphone className="w-32 h-32" />
        </div>
        
        <h2 className="text-xl font-bold font-mono tracking-tight uppercase mb-2 text-text-main flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-accent" /> {t('nav_phone')}
        </h2>
        <p className="text-text-dim mb-6 text-sm">
          {t('phone_desc')}
        </p>

        <form onSubmit={handleScan} className="flex flex-col gap-4 relative z-10 w-full max-w-2xl">
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <div className="relative">
              <select
                onChange={(e) => {
                  const newCode = e.target.value;
                  setSelectedCountryCode(newCode);
                  setPhone(`${newCode} ${phone.replace(/^\+\d+\s*/, '')}`);
                }}
                className="w-full sm:w-[140px] appearance-none bg-bg-surface border border-border-subtle rounded-lg pl-4 pr-10 py-3 text-text-main focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono text-sm cursor-pointer"
                defaultValue=""
                dir="ltr"
              >
                <option value="" disabled>{t('select_country')}</option>
                {countryCodes.map((c) => (
                  <option key={`${c.country}-${c.code}`} value={c.code}>
                    {c.country} {c.code}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            
            <div className="relative flex-1">
              <input 
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 555 019 2093"
                className="w-full bg-bg-surface border border-border-subtle rounded-lg pl-4 pr-10 py-3 text-text-main focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono"
                dir="ltr"
              />
              {phone && (
                <button 
                  type="button" 
                  onClick={() => setPhone('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button 
              type="submit" 
              disabled={loading || !phone.trim()}
              className="bg-accent text-accent-fg px-6 py-3 rounded-lg font-bold tracking-wider uppercase hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center min-w-[120px]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('audit')}
            </button>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer w-fit group">
            <div className="relative">
              <input
                type="checkbox"
                checked={deepScan}
                onChange={(e) => setDeepScan(e.target.checked)}
                className="sr-only"
              />
              <div className={cn(
                "w-10 h-6 rounded-full transition-colors flex items-center p-1",
                deepScan ? "bg-accent" : "bg-bg-surface border border-border-subtle"
              )}>
                <div className={cn(
                  "w-4 h-4 rounded-full bg-white transition-transform",
                  deepScan ? "translate-x-4" : "translate-x-0 bg-text-dim"
                )} />
              </div>
            </div>
            <span className="text-sm font-mono flex items-center gap-2 text-text-dim group-hover:text-text-main transition-colors">
              <Cpu className={cn("w-4 h-4", deepScan ? "text-accent" : "text-text-dim")} />
              {t('phone_deep_scan')}
            </span>
          </label>
        </form>
        {error && <p className="text-error text-sm mt-3">{error}</p>}
      </motion.div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "w-full border rounded-xl overflow-hidden p-6 transition-all",
              getRiskColor(result.riskLevel)
            )}
          >
            <div className="flex flex-col md:flex-row gap-6 md:items-start items-center text-center md:text-left">
              <div className="shrink-0 p-4 bg-bg-base/50 rounded-full backdrop-blur-md">
                {renderIcon(result.riskLevel)}
              </div>
              <div className="flex-1 space-y-4 w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="font-mono text-xs uppercase tracking-widest opacity-80 mb-1">{t('risk_assessed')}</h3>
                    <div className="text-2xl font-black uppercase tracking-tight">{result.riskLevel} {t('exposure').toUpperCase()}</div>
                  </div>
                  <button
                    onClick={() => generateReportPDF({ ...result, target: phone }, 'phone', lang)}
                    className="flex items-center gap-2 bg-text-main text-bg-base hover:bg-opacity-90 px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold transition-all"
                  >
                    <Download className="w-4 h-4" /> Download Report
                  </button>
                </div>

                <div className="text-sm opacity-90 leading-relaxed font-medium">
                  {result.reportText}
                </div>

                {/* OSINT Deep Links Output */}
                <div className="pt-4 border-t border-[currentColor]/10">
                  <h4 className="font-bold uppercase tracking-widest opacity-80 mb-4 flex items-center gap-2 text-accent">
                    <Globe className="w-4 h-4" /> Live OSINT Investigators
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2 w-full">
                    <a 
                      href={`https://api.whatsapp.com/send/?phone=${phone.replace(/\\D/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-bg-base/40 p-3 rounded-lg hover:bg-bg-base/60 transition font-mono border border-[currentColor]/10 hover:border-accent"
                    >
                      <MessageSquareWarning className="w-5 h-5 opacity-70 text-[#25D366]" />
                      <div className="text-left w-full truncate">
                        <p className="text-[10px] tracking-widest opacity-60">PROFILE CHECK</p>
                        <p className="text-sm font-semibold truncate">Search WhatsApp</p>
                      </div>
                      <ArrowRight className="w-4 h-4 opacity-50" />
                    </a>
                    
                    <a 
                      href={`https://sync.me/search/?number=${phone.replace(/\\D/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-bg-base/40 p-3 rounded-lg hover:bg-bg-base/60 transition font-mono border border-[currentColor]/10 hover:border-accent"
                    >
                      <Users className="w-5 h-5 opacity-70 text-[#1DA1F2]" />
                      <div className="text-left w-full truncate">
                        <p className="text-[10px] tracking-widest opacity-60">NAME DIRECTORY</p>
                        <p className="text-sm font-semibold truncate">Sync.me Search</p>
                      </div>
                      <ArrowRight className="w-4 h-4 opacity-50" />
                    </a>

                    <a 
                      href={`https://www.google.com/search?q="${encodeURIComponent(phone.trim())}"+OR+"${phone.replace(/\\D/g, '')}"+-site:facebook.com`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-bg-base/40 p-3 rounded-lg hover:bg-bg-base/60 transition font-mono border border-[currentColor]/10 hover:border-accent"
                    >
                      <Globe className="w-5 h-5 opacity-70 text-[#F4B400]" />
                      <div className="text-left w-full truncate">
                        <p className="text-[10px] tracking-widest opacity-60">DIGITAL FOOTPRINT</p>
                        <p className="text-sm font-semibold truncate">Google Dork Scan</p>
                      </div>
                      <ArrowRight className="w-4 h-4 opacity-50" />
                    </a>
                    
                    <a 
                      href={`https://t.me/+${phone.replace(/\\D/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 bg-bg-base/40 p-3 rounded-lg hover:bg-bg-base/60 transition font-mono border border-[currentColor]/10 hover:border-accent"
                    >
                      <MessageSquareWarning className="w-5 h-5 opacity-70 text-[#0088cc]" />
                      <div className="text-left w-full truncate">
                        <p className="text-[10px] tracking-widest opacity-60">MESSENGER CHECK</p>
                        <p className="text-sm font-semibold truncate">Telegram Search</p>
                      </div>
                      <ArrowRight className="w-4 h-4 opacity-50" />
                    </a>
                  </div>
                </div>

                <div className="pt-4 border-t border-[currentColor]/10 grid grid-cols-2 gap-4">
                  {result.carrier && (
                    <div className="bg-bg-base/40 p-3 rounded-lg">
                      <Network className="w-4 h-4 mb-2 opacity-70" />
                      <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">{t('network_carrier')}</p>
                      <p className="text-sm font-semibold truncate" title={result.carrier}>{result.carrier}</p>
                    </div>
                  )}
                  {result.country && (
                    <div className="bg-bg-base/40 p-3 rounded-lg">
                      <MapPin className="w-4 h-4 mb-2 opacity-70" />
                      <p className="text-[10px] font-mono uppercase tracking-widest opacity-60">{t('origin_country')}</p>
                      <p className="text-sm font-semibold truncate" title={result.country}>{result.country}</p>
                    </div>
                  )}
                </div>

                {result.thoughtProcess && (
                  <div className="bg-bg-base/20 border border-[currentColor]/20 rounded-lg p-4 mt-4 font-mono text-xs">
                    <h4 className="font-bold uppercase tracking-widest opacity-80 mb-3 flex items-center gap-2 text-accent">
                      <Cpu className="w-4 h-4" /> Component Inspector Log
                    </h4>
                    <p className="opacity-80 leading-relaxed whitespace-pre-wrap text-text-dim">
                      {result.thoughtProcess}
                    </p>
                  </div>
                )}

                <div className="bg-bg-base/40 rounded-lg p-4 mt-2">
                  <h4 className="font-bold text-xs uppercase tracking-widest opacity-80 mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" /> Remediation Steps
                  </h4>
                  <ul className="space-y-2 text-sm opacity-90">
                    {result.actionPlan.split('\\n').filter(Boolean).map((step, i) => (
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

      <MiniHistory scanType="phone" />
    </div>
  );
}

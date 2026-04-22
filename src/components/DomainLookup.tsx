import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, Loader2, Search, ShieldCheck, ShieldAlert, AlertTriangle, Download, Server, MapPin, Calendar, User, Link as LinkIcon, Network, Clock, FileText, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateReportPDF } from '../lib/generatePDF';
import MiniHistory from './MiniHistory';

interface WhoisData {
  domain: string;
  registrar?: string;
  registrant?: string;
  creationDate?: string;
  expirationDate?: string;
  updatedDate?: string;
  nameServers?: string[];
  status?: string[];
  dnssec?: string;
  registrantCountry?: string;
  registrantOrg?: string;
  whoisServer?: string;
}

interface DnsRecord {
  type: string;
  value: string;
  ttl?: number;
}

interface DomainResult {
  whois: WhoisData;
  dns: DnsRecord[];
  ip?: string;
  ipGeo?: {
    country?: string;
    city?: string;
    isp?: string;
    org?: string;
    as?: string;
    lat?: number;
    lon?: number;
  };
  riskLevel: 'Low' | 'Medium' | 'High';
  ageYears?: number;
}

export default function DomainLookup() {
  const { lang, t } = useLanguage();
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DomainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const cleanDomain = (input: string): string => {
    let d = input.trim().toLowerCase();
    d = d.replace(/^(https?:\/\/)?(www\.)?/, '');
    d = d.split('/')[0];
    d = d.split('?')[0];
    return d;
  };

  const performLookup = async () => {
    const cleanedDomain = cleanDomain(domain);
    if (!cleanedDomain || !cleanedDomain.includes('.')) {
      setError(lang === 'ar' ? 'أدخل دومين صحيح (مثل: google.com)' : 'Enter a valid domain (e.g. google.com)');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // 1. WHOIS via RDAP (Registration Data Access Protocol) - No CORS issues
      let whoisData: WhoisData = { domain: cleanedDomain };
      try {
        // Determine the correct RDAP endpoint based on TLD
        const tld = cleanedDomain.split('.').pop()?.toLowerCase() || '';
        let rdapUrl = '';
        if (['com', 'net'].includes(tld)) {
          rdapUrl = `https://rdap.verisign.com/${tld}/v1/domain/${cleanedDomain}`;
        } else if (tld === 'org') {
          rdapUrl = `https://rdap.publicinterestregistry.org/rdap/domain/${cleanedDomain}`;
        } else {
          rdapUrl = `https://rdap.org/domain/${cleanedDomain}`;
        }

        const rdapRes = await fetch(rdapUrl);
        if (rdapRes.ok) {
          const rdap = await rdapRes.json();

          // Extract registrar from entities
          let registrar = '';
          let registrantName = '';
          let registrantCountry = '';
          if (rdap.entities) {
            for (const entity of rdap.entities) {
              if (entity.roles?.includes('registrar')) {
                // Extract name from vcard
                const vcard = entity.vcardArray?.[1];
                if (vcard) {
                  const fnEntry = vcard.find((v: any) => v[0] === 'fn');
                  if (fnEntry) registrar = fnEntry[3] || '';
                }
                // Fallback to handle
                if (!registrar) registrar = entity.handle || '';
              }
              if (entity.roles?.includes('registrant')) {
                const vcard = entity.vcardArray?.[1];
                if (vcard) {
                  const fnEntry = vcard.find((v: any) => v[0] === 'fn');
                  if (fnEntry) registrantName = fnEntry[3] || '';
                  const adrEntry = vcard.find((v: any) => v[0] === 'adr');
                  if (adrEntry && Array.isArray(adrEntry[3])) {
                    registrantCountry = adrEntry[3][6] || '';
                  }
                }
              }
            }
          }

          // Extract dates from events
          let creationDate = '';
          let expirationDate = '';
          let updatedDate = '';
          if (rdap.events) {
            for (const event of rdap.events) {
              if (event.eventAction === 'registration') creationDate = event.eventDate;
              if (event.eventAction === 'expiration') expirationDate = event.eventDate;
              if (event.eventAction === 'last changed') updatedDate = event.eventDate;
            }
          }

          // Extract name servers
          const nameServers = rdap.nameservers?.map((ns: any) => ns.ldhName || ns.unicodeName || '') || [];

          // Extract status
          const status = rdap.status || [];

          whoisData = {
            domain: cleanedDomain,
            registrar: registrar || undefined,
            registrant: registrantName || undefined,
            registrantCountry: registrantCountry || undefined,
            creationDate: creationDate || undefined,
            expirationDate: expirationDate || undefined,
            updatedDate: updatedDate || undefined,
            nameServers: nameServers.length > 0 ? nameServers : undefined,
            status: status.length > 0 ? status : undefined,
            dnssec: rdap.secureDNS?.delegationSigned ? 'signed' : 'unsigned',
          };
        }
      } catch (e) {
        console.warn('RDAP lookup failed:', e);
      }

      // 2. DNS Records via Google DNS
      const dnsRecords: DnsRecord[] = [];
      const dnsTypes = [
        { type: 'A', code: 1 },
        { type: 'AAAA', code: 28 },
        { type: 'MX', code: 15 },
        { type: 'NS', code: 2 },
        { type: 'TXT', code: 16 },
        { type: 'CNAME', code: 5 },
      ];

      for (const dt of dnsTypes) {
        try {
          const dnsRes = await fetch(`https://dns.google/resolve?name=${cleanedDomain}&type=${dt.code}`);
          if (dnsRes.ok) {
            const dnsData = await dnsRes.json();
            if (dnsData.Answer) {
              for (const ans of dnsData.Answer) {
                dnsRecords.push({
                  type: dt.type,
                  value: ans.data?.replace(/\.$/, '') || ans.data,
                  ttl: ans.TTL,
                });
              }
            }
          }
        } catch (e) { /* skip */ }
      }

      // 3. Get IP from A record + Geo lookup
      let ip: string | undefined;
      let ipGeo: DomainResult['ipGeo'] = undefined;

      const aRecord = dnsRecords.find(r => r.type === 'A');
      if (aRecord) {
        ip = aRecord.value;
        try {
          const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,isp,org,as,lat,lon`);
          if (geoRes.ok) {
            const geo = await geoRes.json();
            if (geo.status === 'success') {
              ipGeo = {
                country: geo.country,
                city: geo.city,
                isp: geo.isp,
                org: geo.org,
                as: geo.as,
                lat: geo.lat,
                lon: geo.lon,
              };
            }
          }
        } catch (e) { /* skip */ }
      }

      // 4. Calculate domain age & risk
      let ageYears: number | undefined;
      let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';

      if (whoisData.creationDate) {
        const created = new Date(whoisData.creationDate);
        if (!isNaN(created.getTime())) {
          ageYears = Math.round((Date.now() - created.getTime()) / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10;
          if (ageYears < 0.5) riskLevel = 'High';
          else if (ageYears < 2) riskLevel = 'Medium';
        }
      } else {
        riskLevel = 'Medium'; // Unknown creation date
      }

      const finalResult: DomainResult = {
        whois: whoisData,
        dns: dnsRecords,
        ip,
        ipGeo,
        riskLevel,
        ageYears,
      };

      setResult(finalResult);
      setHistoryKey(k => k + 1);

      // Save to history
      try {
        const user = auth.currentUser;
        if (user) {
          await addDoc(collection(db, 'scans'), {
            userId: user.uid,
            type: 'domain',
            target: cleanedDomain,
            riskLevel: riskLevel,
            securityScore: riskLevel === 'Low' ? 90 : riskLevel === 'Medium' ? 60 : 30,
            reportText: `Registrar: ${whoisData.registrar || 'Unknown'}, Age: ${ageYears || 'Unknown'} years, IP: ${ip || 'Unknown'}`,
            createdAt: serverTimestamp(),
          });
        }
      } catch (e) { /* history save optional */ }

    } catch (err: any) {
      setError(err.message || 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const riskColors = {
    Low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    Medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    High: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  };

  const InfoCard = ({ icon: Icon, label, value, mono = false }: { icon: any; label: string; value: string; mono?: boolean }) => (
    <div className="glass-card p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-1">{label}</p>
        <p className={cn("text-sm text-text-main break-all", mono && "font-mono text-xs")}>{value || '—'}</p>
      </div>
    </div>
  );

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
          <Globe className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-text-main">
            {lang === 'ar' ? 'فحص الدومين (WHOIS)' : 'WHOIS Domain Lookup'}
          </h2>
          <p className="text-xs text-text-dim">
            {lang === 'ar' 
              ? 'استعلم عن بيانات تسجيل الدومين، سجلات DNS، والموقع الجغرافي للسيرفر.' 
              : 'Query domain registration data, DNS records, and server geolocation.'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card p-5">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && performLookup()}
              placeholder={lang === 'ar' ? 'أدخل الدومين... (مثل: google.com)' : 'Enter domain... (e.g. google.com)'}
              className="w-full bg-bg-surface border border-border-subtle rounded-lg pl-10 pr-4 py-3 text-text-main focus:border-accent outline-none font-mono text-sm transition-colors"
              dir="ltr"
            />
          </div>
          <button
            onClick={performLookup}
            disabled={loading || !domain.trim()}
            className="btn-glow px-6 py-3 flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {lang === 'ar' ? 'فحص' : 'Lookup'}
          </button>
        </div>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card border-red-500/30 p-4 flex items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Risk & Domain Summary */}
            <div className="glass-card p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center", riskColors[result.riskLevel].bg)}>
                    {result.riskLevel === 'Low' ? (
                      <ShieldCheck className={cn("w-7 h-7", riskColors[result.riskLevel].text)} />
                    ) : result.riskLevel === 'Medium' ? (
                      <AlertTriangle className={cn("w-7 h-7", riskColors[result.riskLevel].text)} />
                    ) : (
                      <ShieldAlert className={cn("w-7 h-7", riskColors[result.riskLevel].text)} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-mono text-xl font-bold text-text-main" dir="ltr">{result.whois.domain}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-xs font-mono font-bold px-2.5 py-0.5 rounded-full", riskColors[result.riskLevel].bg, riskColors[result.riskLevel].text, riskColors[result.riskLevel].border, "border")}>
                        {result.riskLevel === 'Low' ? '● TRUSTED' : result.riskLevel === 'Medium' ? '● MODERATE' : '● SUSPICIOUS'}
                      </span>
                      {result.ageYears !== undefined && (
                        <span className="text-xs text-text-dim font-mono">
                          {result.ageYears} {lang === 'ar' ? 'سنة' : 'years old'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const lines = [
                      `Domain: ${result.whois.domain}`,
                      `Risk: ${result.riskLevel}`,
                      `Registrar: ${result.whois.registrar || 'Unknown'}`,
                      `Created: ${formatDate(result.whois.creationDate)}`,
                      `Expires: ${formatDate(result.whois.expirationDate)}`,
                      `IP: ${result.ip || 'Unknown'}`,
                      `Server Location: ${result.ipGeo?.city || ''}, ${result.ipGeo?.country || 'Unknown'}`,
                      `ISP: ${result.ipGeo?.isp || 'Unknown'}`,
                      `DNS Records: ${result.dns.length}`,
                    ];
                    generateReportPDF({
                      type: 'domain',
                      target: result.whois.domain,
                      riskLevel: result.riskLevel,
                      reportText: lines.join('\n'),
                      actionPlan: 'Review domain registration and DNS configuration.',
                    }, 'domain', lang as 'en' | 'ar');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border-subtle rounded-lg text-xs font-mono text-text-dim hover:text-accent hover:border-accent/30 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'تقرير PDF' : 'Export PDF'}
                </button>
              </div>
            </div>

            {/* WHOIS Registration Data */}
            <div>
              <h3 className="text-xs font-mono uppercase tracking-widest text-text-dim mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'بيانات التسجيل (WHOIS)' : 'Registration Data (WHOIS)'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <InfoCard icon={User} label={lang === 'ar' ? 'المسجل (Registrar)' : 'Registrar'} value={result.whois.registrar || 'REDACTED'} />
                <InfoCard icon={User} label={lang === 'ar' ? 'المالك' : 'Registrant'} value={result.whois.registrant || result.whois.registrantOrg || 'REDACTED (Privacy)'} />
                <InfoCard icon={MapPin} label={lang === 'ar' ? 'بلد المالك' : 'Registrant Country'} value={result.whois.registrantCountry || 'REDACTED'} />
                <InfoCard icon={Calendar} label={lang === 'ar' ? 'تاريخ الإنشاء' : 'Created'} value={formatDate(result.whois.creationDate)} mono />
                <InfoCard icon={Calendar} label={lang === 'ar' ? 'تاريخ الانتهاء' : 'Expires'} value={formatDate(result.whois.expirationDate)} mono />
                <InfoCard icon={Clock} label={lang === 'ar' ? 'آخر تحديث' : 'Last Updated'} value={formatDate(result.whois.updatedDate)} mono />
              </div>
            </div>

            {/* Name Servers */}
            {result.whois.nameServers && result.whois.nameServers.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-dim mb-3 flex items-center gap-2">
                  <Server className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'سيرفرات الأسماء (NS)' : 'Name Servers'}
                </h3>
                <div className="glass-card p-4">
                  <div className="flex flex-wrap gap-2">
                    {result.whois.nameServers.map((ns, i) => (
                      <span key={i} className="font-mono text-xs bg-bg-surface border border-border-subtle px-3 py-1.5 rounded-lg text-accent" dir="ltr">
                        {ns.replace(/\.$/, '').toLowerCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* DNS Records */}
            {result.dns.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-dim mb-3 flex items-center gap-2">
                  <Network className="w-3.5 h-3.5" />
                  {lang === 'ar' ? `سجلات DNS (${result.dns.length})` : `DNS Records (${result.dns.length})`}
                </h3>
                <div className="glass-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-subtle">
                          <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-text-dim font-semibold w-20">{lang === 'ar' ? 'النوع' : 'Type'}</th>
                          <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-text-dim font-semibold">{lang === 'ar' ? 'القيمة' : 'Value'}</th>
                          <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-text-dim font-semibold w-24">TTL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.dns.map((record, i) => (
                          <tr key={i} className="border-b border-border-subtle/50 hover:bg-bg-surface/50 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className={cn(
                                "font-mono text-[11px] font-bold px-2 py-0.5 rounded",
                                record.type === 'A' && 'bg-emerald-500/10 text-emerald-400',
                                record.type === 'AAAA' && 'bg-blue-500/10 text-blue-400',
                                record.type === 'MX' && 'bg-purple-500/10 text-purple-400',
                                record.type === 'NS' && 'bg-amber-500/10 text-amber-400',
                                record.type === 'TXT' && 'bg-gray-500/10 text-gray-400',
                                record.type === 'CNAME' && 'bg-cyan-500/10 text-cyan-400',
                              )}>
                                {record.type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-text-main break-all" dir="ltr">{record.value}</td>
                            <td className="px-4 py-2.5 font-mono text-xs text-text-dim">{record.ttl ? `${record.ttl}s` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Server Geolocation */}
            {result.ipGeo && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-dim mb-3 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'موقع السيرفر' : 'Server Geolocation'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <InfoCard icon={Network} label="IP" value={result.ip || '—'} mono />
                  <InfoCard icon={MapPin} label={lang === 'ar' ? 'الموقع' : 'Location'} value={`${result.ipGeo.city || ''}, ${result.ipGeo.country || ''}`} />
                  <InfoCard icon={Server} label="ISP" value={result.ipGeo.isp || '—'} />
                  <InfoCard icon={Globe} label={lang === 'ar' ? 'المنظمة' : 'Organization'} value={result.ipGeo.org || '—'} />
                  <InfoCard icon={Network} label="AS Number" value={result.ipGeo.as || '—'} mono />
                  {result.ipGeo.lat && result.ipGeo.lon && (
                    <InfoCard icon={MapPin} label={lang === 'ar' ? 'الإحداثيات' : 'Coordinates'} value={`${result.ipGeo.lat}, ${result.ipGeo.lon}`} mono />
                  )}
                </div>
              </div>
            )}

            {/* Domain Status */}
            {result.whois.status && result.whois.status.length > 0 && (
              <div>
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-dim mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {lang === 'ar' ? 'حالة الدومين' : 'Domain Status'}
                </h3>
                <div className="glass-card p-4">
                  <div className="flex flex-wrap gap-2">
                    {result.whois.status.map((s, i) => {
                      const statusName = s.split(' ')[0].replace(/https?:\/\/.*/, '').trim();
                      const isLocked = statusName.toLowerCase().includes('lock') || statusName.toLowerCase().includes('serverhold');
                      return (
                        <span key={i} className={cn(
                          "font-mono text-[11px] px-3 py-1.5 rounded-lg border",
                          isLocked 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-bg-surface text-text-dim border-border-subtle"
                        )} dir="ltr">
                          {statusName}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini History */}
      <MiniHistory scanType="domain" refreshKey={historyKey} />
    </div>
  );
}

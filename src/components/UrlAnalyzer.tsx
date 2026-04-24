import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { Link, Loader2, ShieldCheck, ShieldAlert, AlertTriangle, ArrowRight, Globe, Search, Lock, Camera, CheckCircle, XCircle, Info, Download, Server, MapPin, Network, Clock, ExternalLink, Bug, Skull, Eye, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateReportPDF } from '../lib/generatePDF';
import MiniHistory from './MiniHistory';

// ─── Types ───
interface CheckResult {
  id: string;
  name: string;
  nameAr: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  detail: string;
  detailAr: string;
  severity: number; // 0-30 per check
}

interface ThreatIntel {
  urlhausMatch: boolean;
  urlhausThreat?: string;
  urlhausTags?: string[];
  urlhausDateAdded?: string;
}

interface DnsInfo {
  ip?: string;
  country?: string;
  city?: string;
  isp?: string;
  org?: string;
  as?: string;
}

interface WhoisInfo {
  registrar?: string;
  creationDate?: string;
  ageYears?: number;
}

interface ScanResult {
  url: string;
  hostname: string;
  verdict: 'safe' | 'suspicious' | 'dangerous';
  riskScore: number; // 0-100: 0=safe, 100=dangerous
  checks: CheckResult[];
  threatIntel: ThreatIntel;
  dns: DnsInfo;
  whois: WhoisInfo;
  scanDuration: number;
}

// ─── Suspicious TLDs ───
const SUSPICIOUS_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'buzz', 'top', 'xyz', 'work', 'click',
  'link', 'icu', 'cam', 'monster', 'rest', 'boats', 'beauty', 'hair',
  'quest', 'sbs', 'cfd', 'autos', 'wiki',
]);

// ─── Known URL shorteners ───
const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'adf.ly', 'shorte.st', 'cutt.ly', 'rb.gy', 'shorturl.at', 'v.gd',
  'tiny.cc', 'lnkd.in', 'yourls.org',
]);

// ─── Homoglyph map ───
const HOMOGLYPHS: Record<string, string> = {
  '0': 'o', 'о': 'o', 'ο': 'o', // cyrillic/greek o
  '1': 'l', 'і': 'i', 'ı': 'i', // cyrillic/turkish i
  'а': 'a', 'е': 'e', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
  'ɡ': 'g', 'ɑ': 'a', 'ε': 'e',
};

// ─── Well-known domains for typosquat detection ───
const POPULAR_DOMAINS = [
  'google', 'facebook', 'amazon', 'apple', 'microsoft', 'netflix',
  'paypal', 'instagram', 'twitter', 'linkedin', 'whatsapp', 'telegram',
  'youtube', 'tiktok', 'snapchat', 'reddit', 'github', 'yahoo',
  'outlook', 'gmail', 'icloud', 'dropbox', 'spotify', 'uber', 'ebay',
  'chase', 'bankofamerica', 'wellsfargo', 'coinbase', 'binance',
];

// ─── Suspicious path keywords ───
const PHISHING_PATH_KEYWORDS = [
  'login', 'signin', 'sign-in', 'verify', 'verification', 'update',
  'secure', 'account', 'confirm', 'billing', 'password', 'credentials',
  'wallet', 'banking', 'payment', 'checkout', 'reward', 'prize', 'winner',
  'urgent', 'suspended', 'limited', 'unlock', 'restore',
];

export default function UrlAnalyzer() {
  const { lang, t } = useLanguage();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [scanStage, setScanStage] = useState('');

  // ━━━ Heuristic checks ━━━
  function checkProtocol(urlObj: URL): CheckResult {
    const isHttp = urlObj.protocol === 'http:';
    return {
      id: 'protocol',
      name: 'SSL / HTTPS Encryption',
      nameAr: 'تشفير SSL / HTTPS',
      status: isHttp ? 'fail' : 'pass',
      detail: isHttp
        ? 'This URL uses unencrypted HTTP. Data sent to this site (passwords, personal info) can be intercepted by attackers on the same network.'
        : 'This URL uses HTTPS encryption. Communication with the server is encrypted and protected from eavesdropping.',
      detailAr: isHttp
        ? 'هذا الرابط يستخدم HTTP غير مشفر. البيانات المرسلة (كلمات المرور، المعلومات الشخصية) يمكن اعتراضها من قبل أي شخص على نفس الشبكة.'
        : 'هذا الرابط يستخدم تشفير HTTPS. الاتصال بالسيرفر مشفر ومحمي من التنصت.',
      severity: isHttp ? 15 : 0,
    };
  }

  function checkShortener(hostname: string): CheckResult {
    const isShort = SHORTENERS.has(hostname.toLowerCase());
    return {
      id: 'shortener',
      name: 'URL Shortener Detection',
      nameAr: 'كشف الروابط المختصرة',
      status: isShort ? 'warn' : 'pass',
      detail: isShort
        ? `This is a shortened URL via "${hostname}". The real destination is hidden. Shortened links are commonly used to disguise phishing and malware URLs.`
        : 'This is a direct URL — the destination is not hidden behind a URL shortener.',
      detailAr: isShort
        ? `هذا رابط مختصر عبر "${hostname}". الوجهة الحقيقية مخفية. الروابط المختصرة تُستخدم كثيراً لإخفاء روابط التصيد والبرمجيات الخبيثة.`
        : 'هذا رابط مباشر — الوجهة ليست مخفية خلف اختصار.',
      severity: isShort ? 10 : 0,
    };
  }

  function checkSuspiciousTLD(hostname: string): CheckResult {
    const tld = hostname.split('.').pop()?.toLowerCase() || '';
    const isSus = SUSPICIOUS_TLDS.has(tld);
    return {
      id: 'tld',
      name: 'Domain TLD Reputation',
      nameAr: 'سمعة امتداد الدومين',
      status: isSus ? 'warn' : 'pass',
      detail: isSus
        ? `The ".${tld}" top-level domain is frequently associated with spam, phishing, and disposable malicious sites. Exercise caution.`
        : `The ".${tld}" top-level domain has a standard reputation. No elevated risk detected from the extension alone.`,
      detailAr: isSus
        ? `الامتداد ".${tld}" مرتبط بشكل متكرر بالسبام والتصيد والمواقع الخبيثة المؤقتة. توخَّ الحذر.`
        : `الامتداد ".${tld}" له سمعة طبيعية. لا يوجد خطر مرتفع من الامتداد وحده.`,
      severity: isSus ? 12 : 0,
    };
  }

  function checkHomoglyphs(hostname: string): CheckResult {
    let hasHomoglyph = false;
    for (const char of hostname) {
      if (HOMOGLYPHS[char]) {
        hasHomoglyph = true;
        break;
      }
    }
    // Check for mixed scripts (latin + non-latin)
    const hasLatin = /[a-zA-Z]/.test(hostname);
    const hasNonAscii = /[^\x00-\x7F]/.test(hostname);
    const isMixed = hasLatin && hasNonAscii;

    const isSus = hasHomoglyph || isMixed;
    return {
      id: 'homoglyph',
      name: 'Homoglyph / IDN Attack',
      nameAr: 'هجوم الأحرف المتشابهة (Homoglyph)',
      status: isSus ? 'fail' : 'pass',
      detail: isSus
        ? 'This domain contains characters from non-Latin scripts that visually mimic Latin letters. This is a common phishing technique (IDN homograph attack) used to impersonate legitimate websites.'
        : 'No homoglyph or mixed-script characters detected. The domain uses standard ASCII characters.',
      detailAr: isSus
        ? 'هذا الدومين يحتوي على أحرف من لغات أخرى تشبه الأحرف اللاتينية بصرياً. هذه تقنية تصيد شائعة (هجوم IDN) تُستخدم لانتحال هوية مواقع حقيقية.'
        : 'لم يتم اكتشاف أحرف متشابهة أو مختلطة. الدومين يستخدم أحرف ASCII قياسية.',
      severity: isSus ? 25 : 0,
    };
  }

  function checkTyposquat(hostname: string): CheckResult {
    const domainBase = hostname.replace(/^www\./, '').split('.')[0].toLowerCase();
    let match = '';
    for (const popular of POPULAR_DOMAINS) {
      if (domainBase === popular) { match = ''; break; } // exact match is fine
      // Levenshtein-like simple check
      if (domainBase.length >= 4 && popular.length >= 4) {
        if (domainBase.includes(popular) && domainBase !== popular) {
          match = popular; break;
        }
        // Check 1-char difference
        if (Math.abs(domainBase.length - popular.length) <= 1) {
          let diffs = 0;
          const shorter = domainBase.length <= popular.length ? domainBase : popular;
          const longer = domainBase.length <= popular.length ? popular : domainBase;
          let j = 0;
          for (let i = 0; i < longer.length && j < shorter.length; i++) {
            if (longer[i] !== shorter[j]) { diffs++; } else { j++; }
          }
          if (diffs <= 1 && domainBase !== popular) { match = popular; break; }
        }
      }
    }
    const isSus = match !== '';
    return {
      id: 'typosquat',
      name: 'Typosquatting Detection',
      nameAr: 'كشف انتحال الدومين (Typosquat)',
      status: isSus ? 'fail' : 'pass',
      detail: isSus
        ? `This domain closely resembles "${match}.com" — a well-known website. This is a strong indicator of a phishing or typosquatting attack designed to trick users into thinking they are on the real site.`
        : 'No typosquatting detected. This domain name does not closely mimic any well-known website.',
      detailAr: isSus
        ? `هذا الدومين يشبه بشكل كبير "${match}.com" — موقع معروف. هذا مؤشر قوي على هجوم تصيد أو انتحال دومين مصمم لخداع المستخدمين.`
        : 'لم يتم اكتشاف انتحال دومين. هذا الاسم لا يشبه أي موقع معروف.',
      severity: isSus ? 20 : 0,
    };
  }

  function checkSubdomains(hostname: string): CheckResult {
    const parts = hostname.split('.');
    const subdomainCount = parts.length - 2; // exclude TLD and base domain
    const isSus = subdomainCount >= 3;
    return {
      id: 'subdomains',
      name: 'Excessive Subdomain Depth',
      nameAr: 'عمق النطاقات الفرعية المفرط',
      status: isSus ? 'warn' : 'pass',
      detail: isSus
        ? `This URL has ${subdomainCount} subdomain levels (e.g. "login.secure.bank.example.com"). Attackers use deep subdomains to hide the real domain in the URL bar.`
        : `Subdomain depth is normal (${subdomainCount} level${subdomainCount !== 1 ? 's' : ''}). No evasion attempt detected.`,
      detailAr: isSus
        ? `هذا الرابط يحتوي على ${subdomainCount} مستويات من النطاقات الفرعية. المهاجمون يستخدمون عمق النطاقات الفرعية لإخفاء الدومين الحقيقي.`
        : `عمق النطاقات الفرعية طبيعي (${subdomainCount} مستوى). لم يتم اكتشاف محاولة للتمويه.`,
      severity: isSus ? 10 : 0,
    };
  }

  function checkTracking(urlObj: URL): CheckResult {
    const trackers = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid', 'mc_eid', 'msclkid', 'twclid',  '_ga', 'ref', 'affiliate'];
    const found = trackers.filter(t => urlObj.searchParams.has(t));
    const hasTracking = found.length > 0;
    return {
      id: 'tracking',
      name: 'Tracking Parameters',
      nameAr: 'معلمات التتبع',
      status: hasTracking ? 'info' : 'pass',
      detail: hasTracking
        ? `Found ${found.length} tracking parameter${found.length > 1 ? 's' : ''}: ${found.join(', ')}. These are used to track your source/click. Not dangerous, but indicates your activity is being monitored.`
        : 'No tracking parameters found in the URL.',
      detailAr: hasTracking
        ? `تم العثور على ${found.length} معلمة تتبع: ${found.join(', ')}. تُستخدم لتتبع مصدر الزيارة. ليست خطيرة، لكنها تشير لمراقبة نشاطك.`
        : 'لم يتم العثور على معلمات تتبع في الرابط.',
      severity: 0,
    };
  }

  function checkPhishingPath(urlObj: URL): CheckResult {
    const path = (urlObj.pathname + urlObj.search).toLowerCase();
    const found = PHISHING_PATH_KEYWORDS.filter(kw => path.includes(kw));
    const isSus = found.length >= 2; // 2+ keywords is suspicious
    return {
      id: 'phishing_path',
      name: 'Phishing Path Keywords',
      nameAr: 'كلمات مسار التصيد',
      status: isSus ? 'warn' : 'pass',
      detail: isSus
        ? `The URL path contains ${found.length} phishing-associated keywords: "${found.join('", "')}". Phishing sites often use these words to create urgency and trick users.`
        : 'The URL path does not contain suspicious keyword combinations commonly seen in phishing URLs.',
      detailAr: isSus
        ? `المسار يحتوي على ${found.length} كلمات مرتبطة بالتصيد: "${found.join('", "')}". مواقع التصيد تستخدم هذه الكلمات لخلق شعور بالاستعجال وخداع المستخدمين.`
        : 'المسار لا يحتوي على مزيج مشبوه من الكلمات المرتبطة بالتصيد.',
      severity: isSus ? 10 : 0,
    };
  }

  function checkIPHostname(hostname: string): CheckResult {
    const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    return {
      id: 'ip_host',
      name: 'IP Address as Hostname',
      nameAr: 'عنوان IP كاسم دومين',
      status: isIP ? 'fail' : 'pass',
      detail: isIP
        ? 'This URL uses a raw IP address instead of a domain name. Legitimate websites almost always use domain names. IP-based URLs are strongly associated with phishing, malware command-and-control servers, and temporary attack infrastructure.'
        : 'The URL uses a proper domain name. No direct IP address hosting detected.',
      detailAr: isIP
        ? 'هذا الرابط يستخدم عنوان IP مباشر بدلاً من اسم دومين. المواقع الشرعية تستخدم دائماً أسماء نطاقات. الروابط المبنية على IP مرتبطة بقوة بالتصيد وسيرفرات التحكم بالبرمجيات الخبيثة.'
        : 'الرابط يستخدم اسم دومين صحيح. لم يتم اكتشاف استضافة مباشرة على IP.',
      severity: isIP ? 20 : 0,
    };
  }

  // ━━━ Main Scan ━━━
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    const startTime = Date.now();

    try {
      let targetUrl = url.trim();
      if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'http://' + targetUrl;

      let urlObj: URL;
      try { urlObj = new URL(targetUrl); } catch { throw new Error("Invalid URL format."); }

      const hostname = urlObj.hostname;

      // ── Phase 1: Local heuristic checks ──
      setScanStage(lang === 'ar' ? 'تحليل بنية الرابط...' : 'Analyzing URL structure...');
      const checks: CheckResult[] = [];
      checks.push(checkProtocol(urlObj));
      checks.push(checkIPHostname(hostname));
      checks.push(checkHomoglyphs(hostname));
      checks.push(checkTyposquat(hostname));
      checks.push(checkShortener(hostname));
      checks.push(checkSuspiciousTLD(hostname));
      checks.push(checkSubdomains(hostname));
      checks.push(checkPhishingPath(urlObj));
      checks.push(checkTracking(urlObj));

      // ── Phase 2: URLhaus Threat Intelligence ──
      setScanStage(lang === 'ar' ? 'فحص قواعد بيانات التهديدات...' : 'Checking threat databases...');
      let threatIntel: ThreatIntel = { urlhausMatch: false };
      try {
        // Check host against URLhaus
        const formData = new URLSearchParams();
        formData.append('host', hostname);
        const uhRes = await fetch('https://urlhaus-api.abuse.ch/v1/host/', {
          method: 'POST',
          body: formData,
        });
        if (uhRes.ok) {
          const uhData = await uhRes.json();
          if (uhData.query_status === 'no_results') {
            threatIntel = { urlhausMatch: false };
          } else if (uhData.urls && uhData.urls.length > 0) {
            const latest = uhData.urls[0];
            const tags = uhData.tags || latest.tags || [];
            threatIntel = {
              urlhausMatch: true,
              urlhausThreat: latest.threat || 'malware_download',
              urlhausTags: Array.isArray(tags) ? tags : [],
              urlhausDateAdded: latest.date_added,
            };
          }
        }
      } catch (e) { console.warn('URLhaus check failed:', e); }

      // Add threat DB check result
      checks.push({
        id: 'urlhaus',
        name: 'URLhaus Malware Database',
        nameAr: 'قاعدة بيانات URLhaus للبرمجيات الخبيثة',
        status: threatIntel.urlhausMatch ? 'fail' : 'pass',
        detail: threatIntel.urlhausMatch
          ? `⚠️ MATCH FOUND — This host has been reported to the URLhaus malware database. Threat type: "${threatIntel.urlhausThreat || 'unknown'}". ${threatIntel.urlhausTags?.length ? `Tags: ${threatIntel.urlhausTags.join(', ')}` : ''} ${threatIntel.urlhausDateAdded ? `First reported: ${threatIntel.urlhausDateAdded}` : ''}`
          : 'This host was NOT found in the URLhaus malware database. No known malware distribution associated with this domain.',
        detailAr: threatIntel.urlhausMatch
          ? `⚠️ تم العثور على تطابق — تم الإبلاغ عن هذا النطاق في قاعدة بيانات URLhaus. نوع التهديد: "${threatIntel.urlhausThreat || 'غير محدد'}". ${threatIntel.urlhausTags?.length ? `الوسوم: ${threatIntel.urlhausTags.join(', ')}` : ''}`
          : 'هذا النطاق غير موجود في قاعدة بيانات URLhaus للبرمجيات الخبيثة. لا توجد برمجيات خبيثة معروفة مرتبطة بهذا الدومين.',
        severity: threatIntel.urlhausMatch ? 30 : 0,
      });

      // ── Phase 3: DNS Resolution + GeoIP ──
      setScanStage(lang === 'ar' ? 'تحليل DNS والموقع الجغرافي...' : 'Resolving DNS & geolocation...');
      let dns: DnsInfo = {};
      try {
        const dnsRes = await fetch(`https://dns.google/resolve?name=${hostname}&type=1`);
        if (dnsRes.ok) {
          const dnsData = await dnsRes.json();
          if (dnsData.Answer) {
            const aRecord = dnsData.Answer.find((a: any) => a.type === 1);
            if (aRecord) {
              dns.ip = aRecord.data;
              try {
                const geoRes = await fetch(`http://ip-api.com/json/${dns.ip}?fields=status,country,city,isp,org,as`);
                if (geoRes.ok) {
                  const geo = await geoRes.json();
                  if (geo.status === 'success') {
                    dns = { ...dns, country: geo.country, city: geo.city, isp: geo.isp, org: geo.org, as: geo.as };
                  }
                }
              } catch {}
            }
          }
        }
      } catch (e) { console.warn('DNS resolve failed:', e); }

      // ── Phase 4: WHOIS / Domain Age ──
      setScanStage(lang === 'ar' ? 'فحص عمر الدومين (WHOIS)...' : 'Checking domain age (WHOIS)...');
      let whois: WhoisInfo = {};
      try {
        const tld = hostname.split('.').pop()?.toLowerCase() || '';
        let rdapUrl = '';
        if (['com', 'net'].includes(tld)) rdapUrl = `https://rdap.verisign.com/${tld}/v1/domain/${hostname}`;
        else if (tld === 'org') rdapUrl = `https://rdap.publicinterestregistry.org/rdap/domain/${hostname}`;
        else rdapUrl = `https://rdap.org/domain/${hostname}`;

        const rdapRes = await fetch(rdapUrl);
        if (rdapRes.ok) {
          const rdap = await rdapRes.json();
          // Extract registrar
          if (rdap.entities) {
            for (const entity of rdap.entities) {
              if (entity.roles?.includes('registrar')) {
                const vcard = entity.vcardArray?.[1];
                if (vcard) {
                  const fn = vcard.find((v: any) => v[0] === 'fn');
                  if (fn) whois.registrar = fn[3];
                }
                if (!whois.registrar) whois.registrar = entity.handle;
              }
            }
          }
          // Extract creation date
          if (rdap.events) {
            for (const ev of rdap.events) {
              if (ev.eventAction === 'registration') {
                whois.creationDate = ev.eventDate;
                const created = new Date(ev.eventDate);
                if (!isNaN(created.getTime())) {
                  whois.ageYears = Math.round((Date.now() - created.getTime()) / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10;
                }
              }
            }
          }
        }
      } catch {}

      // Add domain age check
      const isNew = whois.ageYears !== undefined && whois.ageYears < 0.5;
      const isVeryNew = whois.ageYears !== undefined && whois.ageYears < 0.08; // < 1 month
      checks.push({
        id: 'domain_age',
        name: 'Domain Age Analysis',
        nameAr: 'تحليل عمر الدومين',
        status: isVeryNew ? 'fail' : isNew ? 'warn' : 'pass',
        detail: whois.ageYears !== undefined
          ? isVeryNew
            ? `This domain was registered less than 1 month ago (${whois.ageYears} years). Extremely new domains are a hallmark of phishing campaigns and scam sites that are created and abandoned quickly.`
            : isNew
              ? `This domain is less than 6 months old (${whois.ageYears} years). Newer domains carry higher risk as they have a shorter track record. Registrar: ${whois.registrar || 'Unknown'}.`
              : `This domain is ${whois.ageYears} years old. Established domains with a long history are generally more trustworthy. Registrar: ${whois.registrar || 'Unknown'}.`
          : 'Domain age could not be determined. WHOIS data may be restricted or unavailable for this TLD.',
        detailAr: whois.ageYears !== undefined
          ? isVeryNew
            ? `تم تسجيل هذا الدومين منذ أقل من شهر (${whois.ageYears} سنة). الدومينات الجديدة جداً تعتبر علامة مميزة لحملات التصيد والمواقع الاحتيالية.`
            : isNew
              ? `عمر هذا الدومين أقل من 6 أشهر (${whois.ageYears} سنة). الدومينات الأحدث تحمل مخاطر أعلى. المسجّل: ${whois.registrar || 'غير معروف'}.`
              : `عمر هذا الدومين ${whois.ageYears} سنة. الدومينات الراسخة ذات التاريخ الطويل تعتبر أكثر موثوقية بشكل عام. المسجّل: ${whois.registrar || 'غير معروف'}.`
          : 'تعذر تحديد عمر الدومين. بيانات WHOIS قد تكون مقيدة أو غير متاحة لهذا الامتداد.',
        severity: isVeryNew ? 20 : isNew ? 10 : 0,
      });

      // ── Calculate final score ──
      const totalSeverity = checks.reduce((sum, c) => sum + c.severity, 0);
      const riskScore = Math.min(100, totalSeverity);
      const verdict: ScanResult['verdict'] = riskScore >= 50 ? 'dangerous' : riskScore >= 20 ? 'suspicious' : 'safe';

      const scanDuration = Date.now() - startTime;

      const finalResult: ScanResult = {
        url: targetUrl,
        hostname,
        verdict,
        riskScore,
        checks,
        threatIntel,
        dns,
        whois,
        scanDuration,
      };

      setResult(finalResult);
      setHistoryKey(k => k + 1);
      setScanStage('');

      // Save to Firestore
      if (auth.currentUser) {
        try {
          await addDoc(collection(db, 'scans'), {
            userId: auth.currentUser.uid,
            target: targetUrl,
            type: 'url',
            riskLevel: verdict === 'dangerous' ? 'High' : verdict === 'suspicious' ? 'Medium' : 'Low',
            securityScore: Math.max(0, 100 - riskScore),
            reportText: `Verdict: ${verdict.toUpperCase()} | Risk Score: ${riskScore}/100 | Checks: ${checks.filter(c => c.status === 'fail').length} failed, ${checks.filter(c => c.status === 'warn').length} warnings | URLhaus: ${threatIntel.urlhausMatch ? 'MATCH' : 'Clean'} | Domain Age: ${whois.ageYears ?? 'Unknown'} years`,
            createdAt: serverTimestamp(),
          });
        } catch {}
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze URL.");
    } finally {
      setLoading(false);
      setScanStage('');
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'warn': return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      case 'fail': return <XCircle className="w-5 h-5 text-red-400" />;
      case 'info': return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const verdictConfig = {
    safe: {
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      label: lang === 'ar' ? 'آمن' : 'SAFE',
      desc: lang === 'ar' ? 'لم يتم اكتشاف تهديدات. هذا الرابط يبدو آمناً بناءً على فحوصاتنا.' : 'No threats detected. This URL appears safe based on our analysis.',
    },
    suspicious: {
      icon: AlertTriangle,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      label: lang === 'ar' ? 'مشبوه' : 'SUSPICIOUS',
      desc: lang === 'ar' ? 'تم اكتشاف عوامل مشبوهة. توخَّ الحذر وتحقق من الرابط قبل إدخال أي بيانات.' : 'Suspicious indicators detected. Exercise caution and verify this URL before submitting any data.',
    },
    dangerous: {
      icon: ShieldAlert,
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      label: lang === 'ar' ? 'خطير' : 'DANGEROUS',
      desc: lang === 'ar' ? '⚠️ تم اكتشاف تهديدات خطيرة! لا تدخل أي بيانات شخصية ولا تحمّل أي ملفات من هذا الرابط.' : '⚠️ Critical threats detected! Do NOT enter personal data or download files from this URL.',
    },
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-base border border-border-subtle p-6 rounded-xl shadow-lg relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Link className="w-32 h-32" />
        </div>

        <h2 className="text-xl font-bold font-mono tracking-tight uppercase mb-2 text-text-main flex items-center gap-2">
          <Link className="w-5 h-5 text-accent" /> {t('url_title')}
        </h2>
        <p className="text-text-dim mb-6 text-sm">
          {lang === 'ar'
            ? 'فحص شامل للرابط — تحليل الهيكل، كشف التصيد، مطابقة قواعد بيانات التهديدات العالمية، وتقييم الأمان.'
            : 'Deep URL threat analysis — structure analysis, phishing detection, global threat database matching, and security assessment.'}
        </p>

        <form onSubmit={handleScan} className="flex gap-2 relative z-10 w-full max-w-2xl">
          <div className="relative flex-1">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('url_placeholder')}
              className="w-full bg-bg-surface border border-border-subtle rounded-lg pl-4 pr-10 py-3 text-text-main focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="bg-accent text-accent-fg px-6 py-3 rounded-lg font-bold tracking-wider uppercase hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center min-w-[120px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('audit')}
          </button>
        </form>

        {/* Scan progress */}
        {loading && scanStage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex items-center gap-2 text-sm text-accent font-mono"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{scanStage}</span>
          </motion.div>
        )}

        {error && <p className="text-error text-sm mt-3">{error}</p>}
      </motion.div>

      {/* ━━━ Results ━━━ */}
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* ── Verdict Banner ── */}
            {(() => {
              const vc = verdictConfig[result.verdict];
              const VerdictIcon = vc.icon;
              return (
                <div className={cn("rounded-xl border p-6 relative overflow-hidden", vc.border, vc.bg)}>
                  <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
                    <VerdictIcon className="w-40 h-40" />
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", vc.bg)}>
                        <VerdictIcon className={cn("w-8 h-8", vc.color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className={cn("text-2xl font-black tracking-tight font-mono", vc.color)}>
                            {vc.label}
                          </span>
                          <span className={cn("text-xs font-mono font-bold px-2.5 py-1 rounded-full border", vc.bg, vc.color, vc.border)}>
                            {lang === 'ar' ? 'نسبة الخطر' : 'RISK'}: {result.riskScore}/100
                          </span>
                        </div>
                        <p className="text-sm text-text-dim max-w-md">{vc.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-mono text-text-dim">
                        {lang === 'ar' ? `الفحص استغرق ${(result.scanDuration / 1000).toFixed(1)} ثانية` : `Scanned in ${(result.scanDuration / 1000).toFixed(1)}s`}
                      </span>
                      <button
                        onClick={() => {
                          const reportLines = result.checks.map(c =>
                            `[${c.status.toUpperCase()}] ${c.name}: ${lang === 'ar' ? c.detailAr : c.detail}`
                          ).join('\n');
                          generateReportPDF({
                            type: 'url',
                            target: result.url,
                            riskLevel: result.verdict === 'dangerous' ? 'High' : result.verdict === 'suspicious' ? 'Medium' : 'Low',
                            securityScore: 100 - result.riskScore,
                            reportText: reportLines,
                            actionPlan: result.checks.filter(c => c.status === 'fail' || c.status === 'warn').map(c => lang === 'ar' ? c.detailAr : c.detail),
                          }, 'url', lang as 'en' | 'ar');
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-bg-surface/50 border border-border-subtle rounded-lg text-xs font-mono text-text-dim hover:text-accent hover:border-accent/30 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    </div>
                  </div>

                  {/* Target info bar */}
                  <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-text-dim" />
                      <span className="font-mono text-sm text-text-main" dir="ltr">{result.hostname}</span>
                    </div>
                    {result.dns.ip && (
                      <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-text-dim" />
                        <span className="font-mono text-xs text-text-dim" dir="ltr">{result.dns.ip}</span>
                      </div>
                    )}
                    {result.dns.country && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-text-dim" />
                        <span className="text-xs text-text-dim">{result.dns.city && `${result.dns.city}, `}{result.dns.country}</span>
                      </div>
                    )}
                    {result.dns.isp && (
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-text-dim" />
                        <span className="text-xs text-text-dim">{result.dns.isp}</span>
                      </div>
                    )}
                    {result.whois.ageYears !== undefined && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-text-dim" />
                        <span className="text-xs text-text-dim">{result.whois.ageYears} {lang === 'ar' ? 'سنة' : 'yrs'}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Security Checks Detail ── */}
            <div className="bg-bg-base border border-border-subtle rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                <h3 className="text-xs font-mono uppercase tracking-widest text-text-dim flex items-center gap-2">
                  <Search className="w-3.5 h-3.5" />
                  {lang === 'ar' ? `نتائج الفحص المفصلة (${result.checks.length} فحص)` : `Detailed Scan Results (${result.checks.length} checks)`}
                </h3>
                <div className="flex items-center gap-3 text-[10px] font-mono text-text-dim">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {result.checks.filter(c => c.status === 'fail').length} {lang === 'ar' ? 'خطير' : 'FAIL'}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {result.checks.filter(c => c.status === 'warn').length} {lang === 'ar' ? 'تحذير' : 'WARN'}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> {result.checks.filter(c => c.status === 'pass').length} {lang === 'ar' ? 'آمن' : 'PASS'}</span>
                </div>
              </div>

              <div className="divide-y divide-border-subtle/50">
                {result.checks.map((check) => (
                  <div
                    key={check.id}
                    className={cn(
                      "px-5 py-4 flex gap-4 hover:bg-bg-surface/30 transition-colors",
                      check.status === 'fail' && "bg-red-500/5",
                      check.status === 'warn' && "bg-amber-500/5",
                    )}
                  >
                    <div className="mt-0.5 shrink-0">{statusIcon(check.status)}</div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-text-main mb-1">
                        {lang === 'ar' ? check.nameAr : check.name}
                      </h4>
                      <p className="text-xs text-text-dim leading-relaxed">
                        {lang === 'ar' ? check.detailAr : check.detail}
                      </p>
                    </div>
                    <div className="shrink-0 self-center">
                      <span className={cn(
                        "text-[10px] font-mono font-bold px-2 py-0.5 rounded",
                        check.status === 'pass' && 'bg-emerald-500/10 text-emerald-400',
                        check.status === 'warn' && 'bg-amber-500/10 text-amber-400',
                        check.status === 'fail' && 'bg-red-500/10 text-red-400',
                        check.status === 'info' && 'bg-blue-500/10 text-blue-400',
                      )}>
                        {check.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── OSINT Investigation Links ── */}
            <div className="bg-bg-base border border-border-subtle rounded-xl p-5">
              <h4 className="font-bold uppercase tracking-widest opacity-80 mb-4 flex items-center gap-2 text-accent text-xs">
                <Search className="w-4 h-4" /> {lang === 'ar' ? 'أدوات التحقيق العميق' : 'Deep Investigation Tools'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                <a
                  href={`https://urlscan.io/search/#${encodeURIComponent(`page.domain:"${result.hostname}"`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-bg-surface p-4 rounded-lg hover:bg-bg-surface/80 transition font-mono border border-border-subtle hover:border-[#1DA1F2] group"
                >
                  <Camera className="w-6 h-6 text-[#1DA1F2] opacity-70 group-hover:opacity-100 transition" />
                  <div>
                    <p className="text-[10px] tracking-widest text-text-dim">SANDBOX PREVIEW</p>
                    <p className="text-sm font-semibold text-text-main">UrlScan.io</p>
                  </div>
                  <ArrowRight className="w-4 h-4 ml-auto opacity-30 group-hover:opacity-70 transition" />
                </a>

                <a
                  href={`https://www.virustotal.com/gui/search/${encodeURIComponent(result.hostname)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-bg-surface p-4 rounded-lg hover:bg-bg-surface/80 transition font-mono border border-border-subtle hover:border-[#0f0] group"
                >
                  <Bug className="w-6 h-6 text-[#0f0] opacity-70 group-hover:opacity-100 transition" />
                  <div>
                    <p className="text-[10px] tracking-widest text-text-dim">MALWARE REPUTATION</p>
                    <p className="text-sm font-semibold text-text-main">VirusTotal</p>
                  </div>
                  <ArrowRight className="w-4 h-4 ml-auto opacity-30 group-hover:opacity-70 transition" />
                </a>

                <a
                  href={`https://transparencyreport.google.com/safe-browsing/search?url=${encodeURIComponent(url)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-bg-surface p-4 rounded-lg hover:bg-bg-surface/80 transition font-mono border border-border-subtle hover:border-[#F4B400] group"
                >
                  <ShieldCheck className="w-6 h-6 text-[#F4B400] opacity-70 group-hover:opacity-100 transition" />
                  <div>
                    <p className="text-[10px] tracking-widest text-text-dim">BLACKLIST CHECK</p>
                    <p className="text-sm font-semibold text-text-main">Google Safe Browsing</p>
                  </div>
                  <ArrowRight className="w-4 h-4 ml-auto opacity-30 group-hover:opacity-70 transition" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MiniHistory scanType="url" refreshKey={historyKey} />
    </div>
  );
}

import type { UrlhausState } from './urlhausCheck';

export type IpRiskLevel = 'Low' | 'Medium' | 'High';
export type IpVerdictCategory = 'threat_match' | 'private_network' | 'geo_only';

export interface DeriveIpVerdictInput {
  isPrivate: boolean;
  urlhausState: UrlhausState;
  urlhausThreat?: string;
}

export interface IpVerdict {
  riskLevel: IpRiskLevel;
  category: IpVerdictCategory;
  geoOnly: boolean;
  labelEn: string;
  labelAr: string;
  evidenceEn: string;
  evidenceAr: string;
}

function parseIpv4Octets(input: string): number[] | null {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(input)) return null;
  const parts = input.split('.');
  const octets: number[] = [];
  for (const part of parts) {
    if (part.length > 1 && part.startsWith('0')) return null;
    const num = Number(part);
    if (!Number.isInteger(num) || num < 0 || num > 255) return null;
    octets.push(num);
  }
  return octets;
}

function isValidIpv6(input: string): boolean {
  if (!input.includes(':')) return false;
  if (input.includes(':::')) return false;
  if (/^:(?!:)|(?<!:):$/.test(input)) return false;

  const doubleColonParts = input.split('::');
  if (doubleColonParts.length > 2) return false;

  let working = input;
  let ipv4GroupCount = 0;

  // Handle embedded IPv4 tail (e.g. ::ffff:192.0.2.1 or 64:ff9b::192.0.2.33)
  const lastColonIdx = working.lastIndexOf(':');
  const tail = working.slice(lastColonIdx + 1);
  if (tail.includes('.')) {
    if (!parseIpv4Octets(tail)) return false;
    working = `${working.slice(0, lastColonIdx + 1)}0:0`;
    ipv4GroupCount = 2;
  }

  const parts = working.split('::');
  const headGroups = parts[0] ? parts[0].split(':') : [];
  const tailGroups = parts.length === 2 && parts[1] ? parts[1].split(':') : [];

  const isHexHextet = (group: string) => /^[0-9a-fA-F]{1,4}$/.test(group);
  if (!headGroups.every(isHexHextet) || !tailGroups.every(isHexHextet)) {
    return false;
  }

  const totalGroups = headGroups.length + tailGroups.length;
  if (parts.length === 2) {
    return totalGroups < 8 && (totalGroups >= 0 || ipv4GroupCount > 0);
  }
  return totalGroups === 8;
}

/**
 * Strict IPv4 / IPv6 validator.
 * Rejects empty strings, whitespace-padded invalid tokens, hostnames, ports, CIDR suffixes,
 * IPv4 leading zeros (e.g. 01.2.3.4), and out-of-range octets.
 */
export function isValidIp(input: string): boolean {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (parseIpv4Octets(trimmed) !== null) return true;
  return isValidIpv6(trimmed);
}

/**
 * Detects private, loopback, link-local, CGNAT, documentation, multicast, or reserved IPs.
 */
export function isPrivateOrReservedIp(input: string): boolean {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!isValidIp(trimmed)) return false;

  const octets = parseIpv4Octets(trimmed);
  if (octets) {
    const [a, b, c] = octets;
    if (a === 0) return true; // 0.0.0.0/8 (unspecified / current network)
    if (a === 10) return true; // 10.0.0.0/8 (RFC 1918)
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC 1918)
    if (a === 192 && b === 0 && c === 0) return true; // 192.0.0.0/24 (IETF)
    if (a === 192 && b === 0 && c === 2) return true; // 192.0.2.0/24 (TEST-NET-1)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC 1918)
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 (benchmarking)
    if (a === 198 && b === 51 && c === 100) return true; // 198.51.100.0/24 (TEST-NET-2)
    if (a === 203 && b === 0 && c === 113) return true; // 203.0.113.0/24 (TEST-NET-3)
    if (a >= 224) return true; // 224.0.0.0/4 multicast & 240.0.0.0/4 reserved/broadcast
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (lower === '::' || lower === '::1') return true;

  // IPv4-mapped IPv6 ::ffff:a.b.c.d
  const v4MappedMatch = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4MappedMatch) {
    return isPrivateOrReservedIp(v4MappedMatch[1]);
  }

  const firstGroup = lower.split(':')[0];
  if (firstGroup) {
    const val = parseInt(firstGroup, 16);
    if (!Number.isNaN(val)) {
      if ((val & 0xfe00) === 0xfc00) return true; // fc00::/7 Unique Local Address (ULA)
      if ((val & 0xffc0) === 0xfe80) return true; // fe80::/10 Link-Local
      if ((val & 0xff00) === 0xff00) return true; // ff00::/8 Multicast
    }
  }
  if (lower.startsWith('2001:db8:') || lower === '2001:db8::') return true; // Documentation

  return false;
}

export function deriveIpVerdict(input: DeriveIpVerdictInput): IpVerdict {
  const { isPrivate, urlhausState, urlhausThreat } = input;

  if (urlhausState === 'match') {
    const threatNoteEn = urlhausThreat ? ` (threat: "${urlhausThreat}")` : '';
    const threatNoteAr = urlhausThreat ? ` (نوع التهديد: "${urlhausThreat}")` : '';
    return {
      riskLevel: 'High',
      category: 'threat_match',
      geoOnly: false,
      labelEn: 'HIGH RISK — THREAT MATCH',
      labelAr: 'خطر مرتفع — تطابق تهديد مؤكد',
      evidenceEn: `Verified threat intelligence match: this IP is actively listed in abuse.ch URLhaus${threatNoteEn}.`,
      evidenceAr: `تطابق استخباراتي مؤكد: عنوان الـ IP هذا مدرج في قاعدة بيانات التهديدات URLhaus${threatNoteAr}.`,
    };
  }

  if (isPrivate) {
    return {
      riskLevel: 'Low',
      category: 'private_network',
      geoOnly: false,
      labelEn: 'LOW RISK — PRIVATE / RESERVED IP',
      labelAr: 'خطر منخفض — عنوان شبكة محلي أو محجوز',
      evidenceEn: 'Structural assessment: this is a private or reserved network address and is not publicly routable on the internet.',
      evidenceAr: 'تقييم بنيوي: هذا عنوان شبكة محلي أو محجوز (Private/Reserved IP) ولا يتم توجيهه علنياً عبر الإنترنت.',
    };
  }

  const urlhausSuffixEn =
    urlhausState === 'no_match'
      ? 'No active malware-hosting match in URLhaus.'
      : 'URLhaus threat feed was unavailable during this check.';
  const urlhausSuffixAr =
    urlhausState === 'no_match'
      ? 'لا يوجد تطابق نشط لاستضافة برمجيات خبيثة في URLhaus.'
      : 'خدمة فحص التهديدات URLhaus لم تكن متاحة أثناء هذا الفحص.';

  return {
    riskLevel: 'Low',
    category: 'geo_only',
    geoOnly: true,
    labelEn: 'GEOLOCATION ONLY — NOT A FULL REPUTATION CHECK',
    labelAr: 'فحص جغرافي فقط — ليس فحص سمعة شاملاً',
    evidenceEn: `Geolocation lookup only — ${urlhausSuffixEn} Use the deep investigation tools below (AbuseIPDB, Shodan, VirusTotal) to verify spam, open ports, and abuse reputation.`,
    evidenceAr: `نتيجة تحديد موقع جغرافي فقط — ${urlhausSuffixAr} استخدم أدوات التحقيق العميق بالأسفل (AbuseIPDB وShodan وVirusTotal) للتحقق من السمعة الأمنية والبلاغات.`,
  };
}

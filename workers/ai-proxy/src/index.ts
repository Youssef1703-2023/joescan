import * as jose from 'jose';
export { QuotaCounter } from './quota';
export { WatchlistMonitor } from './watchlist';

export interface Env {
  ENVIRONMENT?: string;
  PROJECT_ID?: string;
  FIRESTORE_DATABASE_ID?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  QUOTA_COUNTER?: DurableObjectNamespace;
  WATCHLIST_MONITOR?: DurableObjectNamespace;
  // ─── S03 webhook dispatch policy (required; see wrangler.toml) ───
  /** Comma-separated allowlist of destination hosts, e.g. "siem.example.com, *.hooks.example.net". Absent/empty -> dispatch fails closed (503). */
  WEBHOOK_ALLOWED_HOSTS?: string;
  /** Optional hourly override for the project-wide dispatch limit (default 300). */
  WEBHOOK_PROJECT_HOURLY_LIMIT?: string;
  /** Optional hourly override for the per-account dispatch limit (default 20). */
  WEBHOOK_ACCOUNT_HOURLY_LIMIT?: string;
  /** Optional hourly override for the per-hook delivery limit (default 10). */
  WEBHOOK_HOOK_HOURLY_LIMIT?: string;
}

const FIREBASE_PROJECT_ID = 'gen-lang-client-0439091084';
const DEFAULT_FIRESTORE_DATABASE_ID = 'ai-studio-13222500-ae8c-4550-8b61-6f7dce0d48f6';
const ADMIN_EMAIL = 'joetech.dev.systems@gmail.com';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const ALLOWED_ORIGINS = [
  'https://joescan.me',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

const GROQ_ALLOWED_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'openai/gpt-oss-120b',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';

const OPENROUTER_ALLOWED_MODELS = [
  'openai/gpt-oss-120b:free',
  'openai/gpt-oss-120b',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
];
const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-oss-120b:free';

type SubscriptionTier = 'free' | 'pro' | 'enterprise';

const TIER_LIMITS: Record<SubscriptionTier, number> = {
  free: 10,
  pro: 150,
  enterprise: 2000,
};

const MAX_TOKENS_CEILING = 2048;
const DEFAULT_MAX_TOKENS = 1024;
const MAX_BODY_BYTES = 32 * 1024;
const MAX_MESSAGES = 50;
const MAX_TOTAL_CHARS = 20000;

// ─── S03: Webhook dispatch hardening limits (explicit, bounded) ───
/** Max inbound dispatch request body; enforced before any Firestore lookup. */
const MAX_DISPATCH_BODY_BYTES = 16 * 1024;
/** Max serialized outbound event payload sent to a webhook destination. */
const MAX_DISPATCH_PAYLOAD_BYTES = 8 * 1024;
/** Max webhooks dispatched per request (pre-existing bound, now a constant). */
const MAX_HOOKS_PER_DISPATCH = 10;
/** Max webhook docs inspected from the owner query per request. */
const MAX_WEBHOOK_DOCS_PER_QUERY = 100;
/** Fixed rate-limit window for dispatch controls. */
const WEBHOOK_RATE_WINDOW_SEC = 3600;
const WEBHOOK_DEFAULT_PROJECT_HOURLY_LIMIT = 300;
const WEBHOOK_DEFAULT_ACCOUNT_HOURLY_LIMIT = 20;
const WEBHOOK_DEFAULT_HOOK_HOURLY_LIMIT = 10;
const WEBHOOK_LIMIT_ENV_MAX = 100000;

const WEBHOOK_EVENT_TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const WEBHOOK_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CONTROL_CHARS_PATTERN = /[\u0000-\u001F\u007F]/;

type DispatchSkipReason =
  | 'INVALID_URL'
  | 'HTTPS_REQUIRED'
  | 'URL_CREDENTIALS_REJECTED'
  | 'PORT_NOT_ALLOWED'
  | 'HOST_NOT_ALLOWED'
  | 'HOOK_RATE_LIMITED'
  | 'SIGNING_FAILED';

interface SkippedHook {
  id: string;
  name?: string;
  reason: DispatchSkipReason;
  retryAfter?: number;
}

/** Outbound delivery timeout, retained from the pre-S03 behavior. */
const WEBHOOK_DELIVERY_TIMEOUT_MS = 5000;
// Hostname suffixes that are never resolvable public endpoints. Combined with
// single-label (dot-less) hostnames this is the "obviously local hostname" rule.
const WEBHOOK_LOCAL_HOSTNAME_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
  '.lan',
  '.intranet',
  '.localdomain',
  '.corp',
  '.home',
];

interface CertCache {
  certs: Record<string, string>;
  expiresAt: number;
}
let memoryCertCache: CertCache | null = null;

// Country Centroids for Threat Feed normalization
const COUNTRY_CENTROIDS: Record<string, { name: string; lat: number; lng: number }> = {
  US: { name: 'United States', lat: 37.0902, lng: -95.7129 },
  CN: { name: 'China', lat: 35.8617, lng: 104.1954 },
  RU: { name: 'Russia', lat: 61.5240, lng: 105.3188 },
  DE: { name: 'Germany', lat: 51.1657, lng: 10.4515 },
  NL: { name: 'Netherlands', lat: 52.1326, lng: 5.2913 },
  GB: { name: 'United Kingdom', lat: 55.3781, lng: -3.4360 },
  FR: { name: 'France', lat: 46.2276, lng: 2.2137 },
  JP: { name: 'Japan', lat: 36.2048, lng: 138.2529 },
  IN: { name: 'India', lat: 20.5937, lng: 78.9629 },
  BR: { name: 'Brazil', lat: -14.2350, lng: -51.9253 },
  EG: { name: 'Egypt', lat: 26.8206, lng: 30.8025 },
  SA: { name: 'Saudi Arabia', lat: 23.8859, lng: 45.0792 },
  AE: { name: 'United Arab Emirates', lat: 23.4241, lng: 53.8478 },
  SG: { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
  CA: { name: 'Canada', lat: 56.1304, lng: -106.3468 },
  AU: { name: 'Australia', lat: -25.2744, lng: 133.7751 },
  KR: { name: 'South Korea', lat: 35.9078, lng: 127.7669 },
  IT: { name: 'Italy', lat: 41.8719, lng: 12.5674 },
  ES: { name: 'Spain', lat: 40.4637, lng: -3.7492 },
  PL: { name: 'Poland', lat: 51.9194, lng: 19.1451 },
  TR: { name: 'Turkey', lat: 38.9637, lng: 35.2433 },
  UA: { name: 'Ukraine', lat: 48.3794, lng: 31.1656 },
  RO: { name: 'Romania', lat: 45.9432, lng: 24.9668 },
  BG: { name: 'Bulgaria', lat: 42.7339, lng: 25.4858 },
  CH: { name: 'Switzerland', lat: 46.8182, lng: 8.2275 },
  SE: { name: 'Sweden', lat: 60.1282, lng: 18.6435 },
  NO: { name: 'Norway', lat: 60.4720, lng: 8.4689 },
  FI: { name: 'Finland', lat: 61.9241, lng: 25.7482 },
  DK: { name: 'Denmark', lat: 56.2639, lng: 9.5018 },
  IE: { name: 'Ireland', lat: 53.4129, lng: -8.2439 },
  AT: { name: 'Austria', lat: 47.5162, lng: 14.5501 },
  BE: { name: 'Belgium', lat: 50.5039, lng: 4.4699 },
  CZ: { name: 'Czech Republic', lat: 49.8175, lng: 15.4730 },
  HU: { name: 'Hungary', lat: 47.1625, lng: 19.5033 },
  PT: { name: 'Portugal', lat: 39.3999, lng: -8.2245 },
  GR: { name: 'Greece', lat: 39.0742, lng: 21.8243 },
  IL: { name: 'Israel', lat: 31.0461, lng: 34.8516 },
  ZA: { name: 'South Africa', lat: -30.5595, lng: 22.9375 },
  NG: { name: 'Nigeria', lat: 9.0820, lng: 8.6753 },
  KE: { name: 'Kenya', lat: -1.2921, lng: 36.8219 },
  MX: { name: 'Mexico', lat: 23.6345, lng: -102.5528 },
  AR: { name: 'Argentina', lat: -38.4161, lng: -63.6167 },
  CL: { name: 'Chile', lat: -35.6751, lng: -71.5430 },
  CO: { name: 'Colombia', lat: 4.5709, lng: -74.2973 },
  ID: { name: 'Indonesia', lat: -0.7893, lng: 113.9213 },
  VN: { name: 'Vietnam', lat: 14.0583, lng: 108.2772 },
  TH: { name: 'Thailand', lat: 15.8700, lng: 100.9925 },
  MY: { name: 'Malaysia', lat: 4.2105, lng: 101.9758 },
  PH: { name: 'Philippines', lat: 12.8797, lng: 121.7740 },
  HK: { name: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  TW: { name: 'Taiwan', lat: 23.6978, lng: 120.9605 },
  IR: { name: 'Iran', lat: 32.4279, lng: 53.6880 },
  PK: { name: 'Pakistan', lat: 30.3753, lng: 69.3451 },
  BD: { name: 'Bangladesh', lat: 23.6850, lng: 90.3563 },
  KZ: { name: 'Kazakhstan', lat: 48.0196, lng: 66.9237 },
  NZ: { name: 'New Zealand', lat: -40.9006, lng: 174.8860 },
  MA: { name: 'Morocco', lat: 31.7917, lng: -7.0926 },
  DZ: { name: 'Algeria', lat: 28.0339, lng: 1.6596 },
  TN: { name: 'Tunisia', lat: 33.8869, lng: 9.5375 },
  IQ: { name: 'Iraq', lat: 33.2232, lng: 43.6793 },
  JO: { name: 'Jordan', lat: 30.5852, lng: 36.2384 },
  LB: { name: 'Lebanon', lat: 33.8547, lng: 35.8623 },
  KW: { name: 'Kuwait', lat: 29.3117, lng: 47.4818 },
  QA: { name: 'Qatar', lat: 25.3548, lng: 51.1839 },
  BH: { name: 'Bahrain', lat: 26.0667, lng: 50.5577 },
  OM: { name: 'Oman', lat: 21.4735, lng: 55.9754 },
};

interface ThreatFeedCache {
  data: any;
  expiresAt: number;
}
let memoryThreatFeedCache: ThreatFeedCache | null = null;
const THREAT_FEED_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

async function fetchAndNormalizeThreatFeed(): Promise<any> {
  const now = Date.now();
  if (memoryThreatFeedCache && memoryThreatFeedCache.expiresAt > now) {
    return memoryThreatFeedCache.data;
  }

  const upstreamUrl = 'https://feodotracker.abuse.ch/downloads/ipblocklist.json';
  const res = await fetch(upstreamUrl, {
    headers: {
      'User-Agent': 'JoeScan-Threat-Proxy/1.0 (+https://joescan.me)',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    if (memoryThreatFeedCache) {
      return memoryThreatFeedCache.data;
    }
    throw new Error(`Upstream threat intelligence feed returned HTTP ${res.status}`);
  }

  let rawList: any;
  try {
    rawList = await res.json();
  } catch {
    if (memoryThreatFeedCache) return memoryThreatFeedCache.data;
    throw new Error('Failed to parse upstream threat feed JSON');
  }

  const items = Array.isArray(rawList) ? rawList : (rawList?.entries || []);
  const indicators = items.slice(0, 200).map((item: any) => {
    const countryCode = String(item.country || '').toUpperCase();
    const geo = COUNTRY_CENTROIDS[countryCode] || {
      name: countryCode || 'Unknown',
      lat: 20.0,
      lng: 0.0,
    };
    const isOnline = String(item.status || '').toLowerCase() === 'online';
    return {
      id: `feodo-${item.ip_address || item.ip || Math.random().toString(36).substring(2, 8)}-${item.port || '0'}`,
      ip: item.ip_address || item.ip || 'Unknown',
      port: item.port ? Number(item.port) : null,
      status: isOnline ? 'online' : 'offline',
      hostname: item.hostname || null,
      asNumber: item.as_number ? Number(item.as_number) : null,
      asName: item.as_name || null,
      country: countryCode || 'XX',
      countryName: geo.name,
      coordinates: [geo.lat, geo.lng] as [number, number],
      firstSeen: item.first_seen || item.first_seen_utc || new Date().toISOString(),
      lastOnline: item.last_online || null,
      malware: item.malware || 'Botnet C2',
      severity: isOnline ? 'critical' : 'high',
    };
  });

  const payload = {
    source: 'abuse.ch Feodo Tracker',
    description: 'Active and recently observed Botnet C2 (Command & Control) server infrastructure.',
    updatedAt: new Date().toISOString(),
    itemCount: indicators.length,
    indicators,
  };

  memoryThreatFeedCache = {
    data: payload,
    expiresAt: now + THREAT_FEED_CACHE_TTL_MS,
  };

  return payload;
}

interface WebhookDoc {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
}

// ─── S03: destination policy (fail closed) ───

/**
 * Parses WEBHOOK_ALLOWED_HOSTS into a normalized allowlist.
 * Returns null when the variable is absent/empty — dispatch must then fail
 * closed instead of silently allowing arbitrary hosts.
 * Entry forms: "siem.example.com" (exact match) or "*.example.com"
 * (any-depth subdomain of example.com, not the apex itself).
 */
function parseAllowedHosts(raw: string | undefined): string[] | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const list = trimmed
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 64);
  return list.length > 0 ? list : null;
}

function hostIsAllowed(host: string, allowedHosts: string[]): boolean {
  for (const entry of allowedHosts) {
    if (entry.startsWith('*.')) {
      const suffix = entry.slice(1); // ".example.com"
      if (host.length > suffix.length && host.endsWith(suffix)) return true;
    } else if (host === entry) {
      return true;
    }
  }
  return false;
}

// Textual inspection only: no DNS resolution is ever performed. IP literals
// are evaluated after strict URL parsing, so non-canonical spellings
// (hex/octal/decimal IPv4, unicode dots) have already been normalized by the
// URL parser and cannot smuggle a private address past these checks.

function isBlockedIPv4Octets(octets: number[]): boolean {
  const a = octets[0];
  const b = octets[1];
  const c = octets[2];
  if (a === 0 || a === 10 || a === 127) return true;               // this-network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return true;               // CGNAT 100.64.0.0/10
  if (a === 169 && b === 254) return true;                         // link-local 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true;                // private 172.16.0.0/12
  if (a === 192 && b === 168) return true;                         // private 192.168.0.0/16
  if (a === 192 && b === 0) return true;                           // IETF protocol assignments + TEST-NET-1
  if (a === 198 && (b === 18 || b === 19)) return true;            // benchmarking 198.18.0.0/15
  if (a === 198 && b === 51 && c === 100) return true;             // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true;              // TEST-NET-3
  return a >= 224;                                                 // multicast, reserved, broadcast
}

function isBlockedIPv6(host: string): boolean {
  if (host === '') return true;
  let v6 = host.toLowerCase();
  let embeddedV4: number[] | null = null;

  const lastColon = v6.lastIndexOf(':');
  const tail = v6.slice(lastColon + 1);
  if (tail.includes('.')) {
    // Embedded IPv4 (e.g. ::ffff:10.0.0.1 or 64:ff9b::192.0.2.33).
    const parts = tail.split('.');
    if (parts.length !== 4) return true;
    const octets: number[] = [];
    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part)) return true;
      const octet = Number(part);
      if (octet > 255) return true;
      octets.push(octet);
    }
    embeddedV4 = octets;
    v6 = v6.slice(0, lastColon + 1) + '0:0';
  }

  if (v6.includes(':::')) return true;
  const halves = v6.split('::');
  if (halves.length > 2) return true;
  const left = halves[0] === '' ? [] : halves[0].split(':');
  const right = halves.length === 2 && halves[1] !== '' ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0) return true;
  if (halves.length === 1 && missing !== 0) return true;           // full form must have exactly 8 groups
  if (halves.length === 2 && missing === 0) return true;           // '::' must replace at least one group

  const hextets: number[] = [];
  for (const group of [...left, ...Array<string>(missing).fill('0'), ...right]) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return true;
    hextets.push(parseInt(group, 16));
  }

  const first = hextets[0];
  const second = hextets[1];
  if (first === 0) {
    if (hextets.every(h => h === 0)) return true;                  // unspecified ::
    if (hextets[7] === 1 && hextets.slice(0, 7).every(h => h === 0)) return true; // loopback ::1
    if (hextets[5] === 0xffff) return true;                        // IPv4-mapped ::ffff:0:0/96
    if (hextets.slice(0, 6).every(h => h === 0)) return true;      // deprecated IPv4-compatible
  }
  if (first >= 0xfc00 && first <= 0xfdff) return true;             // fc00::/7 unique local
  if (first >= 0xfe80 && first <= 0xfebf) return true;             // fe80::/10 link-local
  if (first >= 0xff00) return true;                                // ff00::/8 multicast
  if (first === 0x0100) return true;                               // 100::/64 discard-only
  if (first === 0x2001 && second === 0x0000) return true;          // Teredo tunneling
  if (first === 0x2001 && second === 0x0db8) return true;          // documentation
  if (first === 0x2002) return true;                               // deprecated 6to4 tunneling
  if (first === 0x0064 && second === 0xff9b) return true;          // NAT64 64:ff9b::/96 (incl. local-use /48)

  if (embeddedV4 && isBlockedIPv4Octets(embeddedV4)) return true;
  return false;
}

function isLocalWebhookHostname(hostname: string): boolean {
  if (!hostname.includes('.')) return true;                        // single-label hosts resolve locally
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return true;
  return WEBHOOK_LOCAL_HOSTNAME_SUFFIXES.some(suffix => hostname.endsWith(suffix));
}

/**
 * S03 destination policy for webhook delivery targets. Applied to every hook
 * URL — including URLs loaded from Firestore documents — so invalid or
 * dangerous hooks can never dispatch.
 *
 * Policy, in order: bounded length, strict URL parsing, https only, no
 * username/password credentials in the URL, default/443 port only, no
 * loopback/private/link-local/reserved IP literals, no obviously local
 * hostnames, and finally the configured hostname allowlist (fail closed when
 * the allowlist is absent).
 */
function validateWebhookDestination(
  rawUrl: unknown,
  allowedHosts: string[]
): { ok: true; url: URL } | { ok: false; reason: DispatchSkipReason } {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 2048) {
    return { ok: false, reason: 'INVALID_URL' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'INVALID_URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'HTTPS_REQUIRED' };
  }

  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, reason: 'URL_CREDENTIALS_REJECTED' };
  }

  if (parsed.port !== '' && parsed.port !== '443') {
    return { ok: false, reason: 'PORT_NOT_ALLOWED' };
  }

  // Normalize a trailing root dot ("example.com." is the same DNS name).
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (host === '') {
    return { ok: false, reason: 'INVALID_URL' };
  }

  if (host.startsWith('[')) {
    // IPv6 literal (URL parser keeps the brackets in hostname).
    if (!host.endsWith(']') || isBlockedIPv6(host.slice(1, -1))) {
      return { ok: false, reason: 'HOST_NOT_ALLOWED' };
    }
  } else if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const octets = host.split('.').map(octet => Number(octet));
    if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255) || isBlockedIPv4Octets(octets)) {
      return { ok: false, reason: 'HOST_NOT_ALLOWED' };
    }
  }

  if (isLocalWebhookHostname(host) || !hostIsAllowed(host, allowedHosts)) {
    return { ok: false, reason: 'HOST_NOT_ALLOWED' };
  }

  return { ok: true, url: parsed };
}

function containsControlChars(value: string): boolean {
  return CONTROL_CHARS_PATTERN.test(value);
}

interface DispatchBody {
  eventType: string;
  webhookId?: string;
  scanId: string | null;
  target: string | null;
  riskLevel: string;
  data: Record<string, unknown> | null;
}

/**
 * Validates the hostile client-supplied dispatch body. Only well-typed,
 * size-bounded fields ever reach the outbound payload.
 */
function validateDispatchBody(body: unknown): { ok: true; value: DispatchBody } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body: expected a JSON object' };
  }
  const b = body as Record<string, unknown>;

  const rawEventType = b.eventType ?? b.event;
  let eventType = 'scan_complete';
  if (rawEventType !== undefined && rawEventType !== null) {
    if (typeof rawEventType !== 'string' || !WEBHOOK_EVENT_TYPE_PATTERN.test(rawEventType)) {
      return { ok: false, error: 'Invalid eventType' };
    }
    eventType = rawEventType;
  }

  let webhookId: string | undefined;
  if (b.webhookId !== undefined && b.webhookId !== null) {
    if (typeof b.webhookId !== 'string' || !WEBHOOK_ID_PATTERN.test(b.webhookId)) {
      return { ok: false, error: 'Invalid webhookId' };
    }
    webhookId = b.webhookId;
  }

  let scanId: string | null = null;
  if (b.scanId !== undefined && b.scanId !== null) {
    if (typeof b.scanId !== 'string' || b.scanId.length === 0 || b.scanId.length > 256 || containsControlChars(b.scanId)) {
      return { ok: false, error: 'Invalid scanId' };
    }
    scanId = b.scanId;
  }

  let target: string | null = null;
  if (b.target !== undefined && b.target !== null) {
    if (typeof b.target !== 'string' || b.target.length === 0 || b.target.length > 2048 || containsControlChars(b.target)) {
      return { ok: false, error: 'Invalid target' };
    }
    target = b.target;
  }

  let riskLevel = 'Low';
  if (b.riskLevel !== undefined && b.riskLevel !== null) {
    if (typeof b.riskLevel !== 'string' || b.riskLevel.length === 0 || b.riskLevel.length > 32 || containsControlChars(b.riskLevel)) {
      return { ok: false, error: 'Invalid riskLevel' };
    }
    riskLevel = b.riskLevel;
  }

  let data: Record<string, unknown> | null = null;
  if (b.data !== undefined && b.data !== null) {
    if (typeof b.data !== 'object' || Array.isArray(b.data)) {
      return { ok: false, error: 'Invalid data: expected a JSON object' };
    }
    data = b.data as Record<string, unknown>;
  }

  return { ok: true, value: { eventType, webhookId, scanId, target, riskLevel, data } };
}

function readBoundedIntEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, WEBHOOK_LIMIT_ENV_MAX);
}

interface DispatchRateLimits {
  project: number;
  account: number;
  hook: number;
}

function dispatchRateLimits(env: Env): DispatchRateLimits {
  return {
    project: readBoundedIntEnv(env.WEBHOOK_PROJECT_HOURLY_LIMIT, WEBHOOK_DEFAULT_PROJECT_HOURLY_LIMIT),
    account: readBoundedIntEnv(env.WEBHOOK_ACCOUNT_HOURLY_LIMIT, WEBHOOK_DEFAULT_ACCOUNT_HOURLY_LIMIT),
    hook: readBoundedIntEnv(env.WEBHOOK_HOOK_HOURLY_LIMIT, WEBHOOK_DEFAULT_HOOK_HOURLY_LIMIT),
  };
}

function getDispatchRateStub(env: Env, doName: string) {
  if (!env.QUOTA_COUNTER) {
    throw new Error('RATE_LIMITER_UNAVAILABLE');
  }
  return env.QUOTA_COUNTER.get(env.QUOTA_COUNTER.idFromName(doName));
}

async function reserveDispatchWindow(
  stub: any,
  key: string,
  limit: number,
  windowSec: number
): Promise<{ ok: boolean; count: number; limit: number; retryAfter?: number }> {
  try {
    if (typeof stub.reserveWindow === 'function') {
      return await stub.reserveWindow(key, limit, windowSec);
    }
    const res = await stub.fetch('https://quota/window', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, limit, windowSec }),
    });
    if (!res.ok) throw new Error('RATE_LIMITER_UNAVAILABLE');
    return await res.json();
  } catch (err) {
    console.error('Dispatch rate limiter error:', err instanceof Error ? err.message : err);
    throw new Error('RATE_LIMITER_UNAVAILABLE');
  }
}

async function fetchUserWebhooksFromFirestore(
  idToken: string,
  uid: string,
  projectId: string,
  databaseId: string,
  allowedHosts: string[]
): Promise<{ hooks: WebhookDoc[]; rejected: SkippedHook[] }> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents:runQuery`;

  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'webhooks' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'ownerId' },
          op: 'EQUAL',
          value: { stringValue: uid },
        },
      },
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(queryBody),
  });

  if (!res.ok) {
    console.error(`Firestore webhooks query HTTP ${res.status}`);
    throw new Error(`Failed to query user webhooks from Firestore (HTTP ${res.status})`);
  }

  const results = (await res.json()) as any[];
  if (!Array.isArray(results)) return { hooks: [], rejected: [] };

  const hooks: WebhookDoc[] = [];
  const rejected: SkippedHook[] = [];

  // Bound the amount of hostile document data processed per request.
  for (const item of results.slice(0, MAX_WEBHOOK_DOCS_PER_QUERY)) {
    if (!item.document || !item.document.fields) continue;
    const docPath = item.document.name || '';
    const id = docPath.split('/').pop() || '';
    if (!id || id.length > 512) continue;
    const f = item.document.fields;

    // Ownership: only string-valued ownerId exactly equal to the caller's uid.
    const ownerId = f.ownerId?.stringValue;
    if (ownerId !== uid) continue;

    // Hostile-doc field validation: every field is type-checked before use.
    const hookUrl = f.url?.stringValue;
    const destination = validateWebhookDestination(hookUrl, allowedHosts);
    const name =
      typeof f.name?.stringValue === 'string' && f.name.stringValue.length <= 128 && !containsControlChars(f.name.stringValue)
        ? f.name.stringValue
        : 'Webhook';
    if (!destination.ok) {
      rejected.push({ id, name, reason: destination.reason });
      continue;
    }

    // Secret must be a string; an absent/empty secret can never be signed and
    // is skipped explicitly at delivery time (never delivered unsigned).
    const secret = typeof f.secret?.stringValue === 'string' ? f.secret.stringValue : '';
    if (secret.length > 512) {
      rejected.push({ id, name, reason: 'SIGNING_FAILED' });
      continue;
    }

    const active = f.active?.booleanValue !== false;

    // events must be an array of bounded strings; non-strings are dropped.
    const rawEvents = f.events?.arrayValue?.values || [];
    const events = rawEvents
      .map((v: any) => (v && typeof v.stringValue === 'string' ? v.stringValue : null))
      .filter((v: any): v is string => typeof v === 'string' && v.length <= 64 && !containsControlChars(v))
      .slice(0, 32);

    hooks.push({
      id,
      name,
      url: hookUrl as string,
      secret,
      events,
      active,
    });
  }

  return { hooks, rejected };
}

async function computeHmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── S03 webhook destination policy ───
// (The IPv4/IPv6/local-hostname helpers below are consumed by
// validateWebhookDestination above.)

async function getGooglePublicCerts(forceRefresh: boolean = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && memoryCertCache && memoryCertCache.expiresAt > now) {
    return memoryCertCache.certs;
  }

  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    if (memoryCertCache) return memoryCertCache.certs;
    throw new Error(`Failed to fetch Google public certificates (HTTP ${res.status})`);
  }

  const cacheControl = res.headers.get('Cache-Control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
  const ttlSec = Math.max(60, Math.min(maxAgeSec, 86400));

  const certs = (await res.json()) as Record<string, string>;
  memoryCertCache = {
    certs,
    expiresAt: now + ttlSec * 1000,
  };
  return certs;
}

// ─── Admin & Ban Gate (S02) ───
// Admin is decided from claims already verified inside the ID token, so a
// banned admin account can still administer the platform (mirrors the
// Firestore rules, which exempt admins from the ban predicate).
function tokenIsAdmin(userPayload: jose.JWTPayload): boolean {
  return userPayload.admin === true ||
    (userPayload.email === ADMIN_EMAIL && userPayload.email_verified === true);
}

type BanStatus = 'ok' | 'banned' | 'unavailable';

/**
 * Look up the caller's `bannedUsers/{uid}` document over the Firestore REST
 * API using their verified ID token. Only the `active` field is projected, so
 * the ban reason never reaches the Worker, logs, or responses.
 *
 * Distinguishes three outcomes:
 *  - 'ok':          no ban document exists (404), or it exists without
 *                   `active == true` (unban writes `active: false`);
 *  - 'banned':      the document exists and `active` is true;
 *  - 'unavailable': the ban store could not be reached or answered with an
 *                   unexpected error — callers must fail closed (503).
 */
async function fetchCallerBanStatus(
  idToken: string,
  uid: string,
  projectId: string,
  databaseId: string
): Promise<BanStatus> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/bannedUsers/${encodeURIComponent(uid)}?mask.fieldPaths=active`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Accept': 'application/json',
      },
    });
  } catch (err) {
    console.error('Ban status network error:', err instanceof Error ? err.message : err);
    return 'unavailable';
  }

  // A missing ban document means the account is not banned — this is the
  // normal case for every user and must not be treated as a failure.
  if (res.status === 404) {
    return 'ok';
  }

  if (!res.ok) {
    console.error(`Ban status fetch returned HTTP ${res.status}`);
    return 'unavailable';
  }

  let docData: any;
  try {
    docData = await res.json();
  } catch {
    return 'unavailable';
  }

  const fields = docData?.fields || {};
  return fields.active?.booleanValue === true ? 'banned' : 'ok';
}

/**
 * Enforce the ban gate before any authenticated endpoint performs work.
 * Returns a Response to send immediately, or null when the caller may proceed.
 */
async function enforceBanGate(
  idToken: string,
  uid: string,
  userPayload: jose.JWTPayload,
  projectId: string,
  databaseId: string,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  if (tokenIsAdmin(userPayload)) {
    return null;
  }

  const banStatus = await fetchCallerBanStatus(idToken, uid, projectId, databaseId);

  if (banStatus === 'banned') {
    // Deliberately uniform across every endpoint; never includes the reason.
    return new Response(
      JSON.stringify({
        code: 'ACCOUNT_BANNED',
        error: 'Account suspended. Contact support if you believe this is a mistake.',
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (banStatus === 'unavailable') {
    // Fail closed: without a trustworthy ban verdict no endpoint may run.
    return new Response(
      JSON.stringify({
        code: 'BAN_STATUS_UNAVAILABLE',
        error: 'Account status verification is temporarily unavailable. Please retry shortly.',
        retryAfter: 30,
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': '30',
        },
      }
    );
  }

  return null;
}

async function verifyFirebaseIdToken(idToken: string, projectId: string = FIREBASE_PROJECT_ID): Promise<jose.JWTPayload> {
  const protectedHeader = jose.decodeProtectedHeader(idToken);
  if (protectedHeader.alg !== 'RS256') {
    throw new Error('Unsupported token algorithm. Expected RS256.');
  }
  const kid = protectedHeader.kid;
  if (!kid) {
    throw new Error('Token header missing key identifier (kid).');
  }

  let certs = await getGooglePublicCerts(false);
  let cert = certs[kid];
  if (!cert) {
    certs = await getGooglePublicCerts(true);
    cert = certs[kid];
  }
  if (!cert) {
    throw new Error('Key ID not found in Google certificates.');
  }

  const publicKey = await jose.importX509(cert, 'RS256');
  const { payload } = await jose.jwtVerify(idToken, publicKey, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    clockTolerance: 10,
  });

  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
    throw new Error('Missing or empty token subject (sub).');
  }

  if (payload.auth_time && typeof payload.auth_time === 'number') {
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.auth_time > nowSec + 10) {
      throw new Error('Token auth_time is in the future.');
    }
  }

  return payload;
}

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://joescan.me',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Expose-Headers': 'Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
    'Access-Control-Max-Age': '86400',
  };
}

function getCairoDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function getSecondsUntilCairoMidnight(now: Date = new Date()): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const parts = formatter.formatToParts(now);
  let hour = 0, minute = 0, second = 0;
  for (const part of parts) {
    if (part.type === 'hour') hour = parseInt(part.value, 10);
    if (part.type === 'minute') minute = parseInt(part.value, 10);
    if (part.type === 'second') second = parseInt(part.value, 10);
  }
  if (hour === 24) hour = 0;
  const secondsPassedToday = hour * 3600 + minute * 60 + second;
  return Math.max(1, 86400 - secondsPassedToday);
}

interface TierResolution {
  tier: SubscriptionTier;
  limit: number;
}

async function resolveUserTier(
  idToken: string,
  userPayload: jose.JWTPayload,
  projectId: string,
  databaseId: string
): Promise<TierResolution> {
  if (tokenIsAdmin(userPayload)) {
    return { tier: 'enterprise', limit: TIER_LIMITS.enterprise };
  }

  const uid = userPayload.sub;
  if (!uid) {
    return { tier: 'free', limit: TIER_LIMITS.free };
  }

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/users/${encodeURIComponent(uid)}?mask.fieldPaths=tier&mask.fieldPaths=subscriptionExpiry`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Accept': 'application/json',
      },
    });
  } catch (err) {
    console.error('Firestore user doc fetch network error:', err);
    throw new Error('TIER_STORE_UNREACHABLE');
  }

  if (res.status === 404) {
    return { tier: 'free', limit: TIER_LIMITS.free };
  }

  if (!res.ok) {
    console.error(`Firestore user doc fetch returned HTTP ${res.status}`);
    throw new Error('TIER_STORE_UNREACHABLE');
  }

  let docData: any;
  try {
    docData = await res.json();
  } catch {
    throw new Error('TIER_STORE_UNREACHABLE');
  }

  const fields = docData.fields || {};
  const rawTier = fields.tier?.stringValue;

  if (rawTier !== 'pro' && rawTier !== 'enterprise') {
    return { tier: 'free', limit: TIER_LIMITS.free };
  }

  const expiryRaw = fields.subscriptionExpiry?.stringValue || fields.subscriptionExpiry?.timestampValue;
  if (!expiryRaw || typeof expiryRaw !== 'string') {
    return { tier: 'free', limit: TIER_LIMITS.free };
  }

  const expiryMs = new Date(expiryRaw).getTime();
  if (isNaN(expiryMs) || expiryMs <= Date.now()) {
    return { tier: 'free', limit: TIER_LIMITS.free };
  }

  const paidTier = rawTier as 'pro' | 'enterprise';
  return { tier: paidTier, limit: TIER_LIMITS[paidTier] };
}

function getQuotaStub(env: Env, uid: string) {
  if (!env.QUOTA_COUNTER) {
    throw new Error('QUOTA_STORE_UNAVAILABLE');
  }
  const id = env.QUOTA_COUNTER.idFromName(uid);
  return env.QUOTA_COUNTER.get(id);
}

async function checkBurstGuard(stub: any): Promise<{ ok: boolean; retryAfter?: number }> {
  try {
    if (typeof stub.checkBurst === 'function') {
      return await stub.checkBurst(20, 60);
    }
    const res = await stub.fetch('https://quota/burst', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxBurst: 20, windowSec: 60 }),
    });
    if (!res.ok) return { ok: false, retryAfter: 60 };
    return await res.json();
  } catch (err) {
    console.error('DO burst check error:', err);
    throw new Error('QUOTA_STORE_UNAVAILABLE');
  }
}

/**
 * S03: dispatch rate-limit reservations reuse the shared QuotaCounter Durable
 * Object via getDispatchRateStub/reserveDispatchWindow (defined above). Unlike
 * the AI path, these checks are fail-closed: callers translate a thrown error
 * into a 503 instead of dispatching unmetered.
 */
async function reserveQuotaUnit(stub: any, limit: number, day: string): Promise<{ ok: boolean; used: number; limit: number }> {
  try {
    if (typeof stub.reserve === 'function') {
      return await stub.reserve(limit, day);
    }
    const res = await stub.fetch('https://quota/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit, day }),
    });
    if (!res.ok) throw new Error('QUOTA_STORE_UNAVAILABLE');
    return await res.json();
  } catch (err) {
    console.error('DO reserve quota error:', err);
    throw new Error('QUOTA_STORE_UNAVAILABLE');
  }
}

async function peekQuotaUnits(stub: any, day: string): Promise<{ used: number; day: string }> {
  try {
    if (typeof stub.peek === 'function') {
      return await stub.peek(day);
    }
    const res = await stub.fetch(`https://quota/peek?day=${encodeURIComponent(day)}`);
    if (!res.ok) throw new Error('QUOTA_STORE_UNAVAILABLE');
    return await res.json();
  } catch (err) {
    console.error('DO peek quota error:', err);
    throw new Error('QUOTA_STORE_UNAVAILABLE');
  }
}

function getWatchlistStub(env: Env, uid: string) {
  if (!env.WATCHLIST_MONITOR) {
    throw new Error('WATCHLIST_STORE_UNAVAILABLE');
  }
  const id = env.WATCHLIST_MONITOR.idFromName(uid);
  return env.WATCHLIST_MONITOR.get(id);
}

async function syncWatchlistDO(stub: any, targets: any[], revision: number, tier: string): Promise<any> {
  try {
    if (typeof stub.sync === 'function') {
      return await stub.sync(targets, revision, tier);
    }
    const res = await stub.fetch('https://watchlist/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets, revision, tier }),
    });
    return await res.json();
  } catch (err) {
    console.error('DO sync error:', err);
    throw new Error('WATCHLIST_STORE_UNAVAILABLE');
  }
}

async function getWatchlistStateDO(stub: any): Promise<any> {
  try {
    if (typeof stub.getState === 'function') {
      return await stub.getState();
    }
    const res = await stub.fetch('https://watchlist/state');
    if (!res.ok) throw new Error('WATCHLIST_STORE_UNAVAILABLE');
    return await res.json();
  } catch (err) {
    console.error('DO getState error:', err);
    throw new Error('WATCHLIST_STORE_UNAVAILABLE');
  }
}

async function sweepWatchlistNowDO(stub: any): Promise<any> {
  try {
    if (typeof stub.sweepNow === 'function') {
      return await stub.sweepNow();
    }
    const res = await stub.fetch('https://watchlist/sweep-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  } catch (err) {
    console.error('DO sweepNow error:', err);
    throw new Error('WATCHLIST_STORE_UNAVAILABLE');
  }
}

export default {
  async fetch(request: Request, env: Env, ctx?: any): Promise<Response> {
    const corsHeaders = getCorsHeaders(request);

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    // 1. Authenticate via Firebase ID Token
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing or invalid Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const idToken = authHeader.substring(7).trim();
    const projectId = env.PROJECT_ID || FIREBASE_PROJECT_ID;
    const databaseId = env.FIRESTORE_DATABASE_ID || DEFAULT_FIRESTORE_DATABASE_ID;

    let userPayload: jose.JWTPayload;
    try {
      userPayload = await verifyFirebaseIdToken(idToken, projectId);
    } catch (authErr: any) {
      console.warn('ID token verification failed:', authErr?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uid = userPayload.sub as string;

    // ─── Ban gate (S02): runs before EVERY authenticated endpoint ───
    // Quota, threat-feed, webhook dispatch, watchlist, and AI provider paths
    // all sit below this point, so a banned account can never trigger
    // provider, Durable Object, or webhook work.
    const banRejection = await enforceBanGate(idToken, uid, userPayload, projectId, databaseId, corsHeaders);
    if (banRejection) {
      return banRejection;
    }

    const cairoDay = getCairoDay();
    const secondsUntilMidnight = getSecondsUntilCairoMidnight();

    // ─── GET /quota: Non-decrementing balance check ───
    if (request.method === 'GET' && (pathname === '/quota' || pathname === '/api/quota')) {
      let tierInfo: TierResolution;
      try {
        tierInfo = await resolveUserTier(idToken, userPayload, projectId, databaseId);
      } catch {
        return new Response(
          JSON.stringify({
            code: 'TIER_STORE_UNAVAILABLE',
            error: 'Subscription service temporarily unavailable. Please retry shortly.',
            retryAfter: 30,
          }),
          {
            status: 503,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': '30',
            },
          }
        );
      }

      // Degraded mode: DO unavailable -> report unknown usage instead of 503,
      // so the UI quota meter degrades gracefully rather than erroring.
      let peekResult: { used: number; day: string } = { used: -1, day: cairoDay };
      try {
        const stub = getQuotaStub(env, uid);
        peekResult = await peekQuotaUnits(stub, cairoDay);
      } catch (err) {
        console.error('QUOTA_PEEK_FAILED uid=' + uid, err instanceof Error ? err.message : err);
      }

      const resetsAt = new Date(Date.now() + secondsUntilMidnight * 1000).toISOString();

      return new Response(
        JSON.stringify({
          used: peekResult.used,
          limit: tierInfo.limit,
          tier: tierInfo.tier,
          day: cairoDay,
          resetsAt,
          retryAfter: secondsUntilMidnight,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(tierInfo.limit),
            'X-RateLimit-Remaining': String(Math.max(0, tierInfo.limit - peekResult.used)),
            'X-RateLimit-Reset': String(secondsUntilMidnight),
          },
        }
      );
    }

    // ─── GET /threat-feed: Cached abuse.ch Feodo Tracker botnet C2 feed ───
    if (request.method === 'GET' && (pathname === '/threat-feed' || pathname === '/api/threat-feed')) {
      try {
        const feedData = await fetchAndNormalizeThreatFeed();
        return new Response(JSON.stringify(feedData), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=900, s-maxage=900',
          },
        });
      } catch (feedErr: any) {
        console.error('Threat feed fetch error:', feedErr);
        return new Response(
          JSON.stringify({
            error: feedErr?.message || 'Failed to fetch threat feed',
          }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // ─── POST /webhook-dispatch: SIEM Webhook Dispatch with HMAC-SHA256 ───
    // S03 hardened pipeline (each stage fails closed before the next):
    //   1. payload size caps (before ANY Firestore lookup or delivery)
    //   2. strict body/field validation (hostile input never reaches delivery)
    //   3. destination policy must be configured (fail closed when absent)
    //   4. active Enterprise subscription at dispatch time (admin bypass)
    //   5. project-level then per-account request limits (429 + Retry-After),
    //      enforced fail-closed via the QuotaCounter Durable Object
    //   6. Firestore webhook lookup with hostile-document validation
    //   7. per-hook delivery limits before any outbound fetch
    //   8. HMAC signing must succeed or the payload is never delivered
    //   9. outbound fetch: policy-validated HTTPS destination,
    //      redirect:'manual' (any 3xx is a failed delivery), 5s timeout
    if (request.method === 'POST' && (pathname === '/webhook-dispatch' || pathname === '/api/webhook-dispatch')) {
      // (1) Reject oversized dispatch payloads before reading or looking anything up.
      const contentLengthRaw = request.headers.get('Content-Length');
      const contentLength = contentLengthRaw ? parseInt(contentLengthRaw, 10) : NaN;
      if (Number.isFinite(contentLength) && contentLength > MAX_DISPATCH_BODY_BYTES) {
        return new Response(
          JSON.stringify({
            code: 'PAYLOAD_TOO_LARGE',
            error: `Dispatch payload too large (exceeds ${MAX_DISPATCH_BODY_BYTES} byte cap)`,
          }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let dispatchBodyText = '';
      try {
        dispatchBodyText = await request.text();
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to read request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (dispatchBodyText.length > MAX_DISPATCH_BODY_BYTES) {
        return new Response(
          JSON.stringify({
            code: 'PAYLOAD_TOO_LARGE',
            error: `Dispatch payload too large (exceeds ${MAX_DISPATCH_BODY_BYTES} byte cap)`,
          }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let dispatchBody: unknown;
      try {
        dispatchBody = JSON.parse(dispatchBodyText);
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // (2) Validate the hostile request body before it can influence delivery.
      const validated = validateDispatchBody(dispatchBody);
      if (!validated.ok) {
        return new Response(JSON.stringify({ error: validated.error }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { eventType: effectiveEventType, webhookId, scanId, target, riskLevel, data } = validated.value;

      // (3) Destination policy is mandatory — without it, fail closed.
      const allowedHosts = parseAllowedHosts(env.WEBHOOK_ALLOWED_HOSTS);
      if (!allowedHosts) {
        return new Response(
          JSON.stringify({
            code: 'WEBHOOK_POLICY_UNCONFIGURED',
            error: 'Webhook dispatch is unavailable because the destination policy is not configured.',
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // (4) Active Enterprise subscription at dispatch time (admins keep their
      // elevated behavior, consistent with the rest of the Worker's policy).
      let tierInfo: TierResolution;
      try {
        tierInfo = await resolveUserTier(idToken, userPayload, projectId, databaseId);
      } catch {
        return new Response(
          JSON.stringify({
            code: 'TIER_STORE_UNAVAILABLE',
            error: 'Subscription verification is temporarily unavailable. Please retry shortly.',
            retryAfter: 30,
          }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '30' },
          }
        );
      }

      if (tierInfo.tier !== 'enterprise') {
        return new Response(
          JSON.stringify({
            code: 'SUBSCRIPTION_REQUIRED',
            error: 'Webhook dispatch requires an active Enterprise subscription.',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // (5) Project-level and per-account request limits — reserved BEFORE the
      // Firestore lookup and any outbound delivery. Fail closed when the
      // enforcement store is missing or failing.
      const limits = dispatchRateLimits(env);
      try {
        const projectStub = getDispatchRateStub(env, `webhook:project:${projectId}`);
        const projectRes = await reserveDispatchWindow(projectStub, `project:${projectId}`, limits.project, WEBHOOK_RATE_WINDOW_SEC);
        if (!projectRes.ok) {
          const retryAfter = projectRes.retryAfter ?? WEBHOOK_RATE_WINDOW_SEC;
          return new Response(
            JSON.stringify({
              code: 'RATE_LIMIT_EXCEEDED',
              error: 'Project webhook dispatch limit exceeded. Please retry later.',
              retryAfter,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
            }
          );
        }

        const accountStub = getDispatchRateStub(env, `webhook:acct:${uid}`);
        const accountRes = await reserveDispatchWindow(accountStub, `acct:${uid}`, limits.account, WEBHOOK_RATE_WINDOW_SEC);
        if (!accountRes.ok) {
          const retryAfter = accountRes.retryAfter ?? WEBHOOK_RATE_WINDOW_SEC;
          return new Response(
            JSON.stringify({
              code: 'RATE_LIMIT_EXCEEDED',
              error: 'Account webhook dispatch limit exceeded. Please retry later.',
              retryAfter,
            }),
            {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) },
            }
          );
        }
      } catch {
        return new Response(
          JSON.stringify({
            code: 'RATE_LIMITER_UNAVAILABLE',
            error: 'Webhook dispatch is temporarily unavailable. Please retry shortly.',
            retryAfter: 30,
          }),
          {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '30' },
          }
        );
      }

      // (6) Firestore webhook lookup with hostile-document validation. Only
      // reached once every gate above has passed.
      let lookup: { hooks: WebhookDoc[]; rejected: SkippedHook[] };
      try {
        lookup = await fetchUserWebhooksFromFirestore(idToken, uid, projectId, databaseId, allowedHosts);
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to fetch webhook configurations' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const skippedHooks: SkippedHook[] = [...lookup.rejected];

      // Filter matching active webhooks. An explicit webhookId is an exclusive
      // selector (exactly that hook, when active); otherwise the pre-existing
      // event-type matching semantics apply (test_ping matches all hooks).
      let matchingHooks = lookup.hooks.filter(hook => {
        if (!hook.active) return false;
        if (webhookId) return hook.id === webhookId;
        if (effectiveEventType === 'test_ping') return true;
        return hook.events.includes(effectiveEventType) || hook.events.includes('all');
      });

      // Bound: max webhooks per dispatch call
      matchingHooks = matchingHooks.slice(0, MAX_HOOKS_PER_DISPATCH);

      const timestampSec = Math.floor(Date.now() / 1000);
      const outboundEventPayload = {
        event: effectiveEventType,
        timestamp: timestampSec,
        scanId,
        target,
        riskLevel,
        data,
      };
      const rawPayloadString = JSON.stringify(outboundEventPayload);

      // Outbound payload cap — a validated body can still serialize too large.
      if (rawPayloadString.length > MAX_DISPATCH_PAYLOAD_BYTES) {
        return new Response(
          JSON.stringify({
            code: 'PAYLOAD_TOO_LARGE',
            error: `Serialized event payload too large (exceeds ${MAX_DISPATCH_PAYLOAD_BYTES} byte cap)`,
          }),
          { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // (7) Per-hook delivery limits — reserved before any outbound fetch.
      const deliverableHooks: WebhookDoc[] = [];
      for (const hook of matchingHooks) {
        try {
          const hookStub = getDispatchRateStub(env, `webhook:hook:${hook.id}`);
          const hookRes = await reserveDispatchWindow(hookStub, `hook:${hook.id}`, limits.hook, WEBHOOK_RATE_WINDOW_SEC);
          if (hookRes.ok) {
            deliverableHooks.push(hook);
          } else {
            skippedHooks.push({
              id: hook.id,
              name: hook.name,
              reason: 'HOOK_RATE_LIMITED',
              retryAfter: hookRes.retryAfter ?? WEBHOOK_RATE_WINDOW_SEC,
            });
          }
        } catch {
          return new Response(
            JSON.stringify({
              code: 'RATE_LIMITER_UNAVAILABLE',
              error: 'Webhook dispatch is temporarily unavailable. Please retry shortly.',
              retryAfter: 30,
            }),
            {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '30' },
            }
          );
        }
      }

      // If every matched hook was withheld by its delivery limit, answer 429
      // before any outbound delivery has happened.
      const firstHookRetryAfter = skippedHooks.find(s => s.reason === 'HOOK_RATE_LIMITED')?.retryAfter;
      if (deliverableHooks.length === 0 && firstHookRetryAfter !== undefined && matchingHooks.length > 0) {
        return new Response(
          JSON.stringify({
            code: 'RATE_LIMIT_EXCEEDED',
            error: 'Webhook delivery limit exceeded for the selected webhook(s). Please retry later.',
            retryAfter: firstHookRetryAfter,
            skippedHooks,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(firstHookRetryAfter) },
          }
        );
      }

      // (8) + (9) Sign, then deliver. A payload that cannot be signed is never
      // delivered — no empty-signature fallback. dispatchedCount reflects
      // hooks for which an outbound delivery was actually attempted; skipped
      // hooks appear in results/skippedHooks with the reason.
      let deliveryAttempts = 0;
      const dispatchPromises = deliverableHooks.map(async (hook): Promise<Record<string, unknown>> => {
        if (!hook.secret) {
          return { id: hook.id, name: hook.name, url: hook.url, status: 0, ok: false, durationMs: 0, error: 'Delivery skipped: signing failed' };
        }

        const signaturePayload = `${timestampSec}.${rawPayloadString}`;
        let signatureHex = '';
        try {
          signatureHex = await computeHmacSha256Hex(hook.secret, signaturePayload);
        } catch {
          console.warn('HMAC computation failed for hook', hook.id);
          return { id: hook.id, name: hook.name, url: hook.url, status: 0, ok: false, durationMs: 0, error: 'Delivery skipped: signing failed' };
        }
        if (!signatureHex) {
          return { id: hook.id, name: hook.name, url: hook.url, status: 0, ok: false, durationMs: 0, error: 'Delivery skipped: signing failed' };
        }

        deliveryAttempts++;
        const startTime = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), WEBHOOK_DELIVERY_TIMEOUT_MS);

        try {
          const res = await fetch(hook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'JoeScan-SIEM-Dispatcher/1.0 (+https://joescan.me)',
              'X-JoeScan-Timestamp': String(timestampSec),
              'X-JoeScan-Signature': `sha256=${signatureHex}`,
              'X-JoeScan-Event': effectiveEventType,
            },
            body: rawPayloadString,
            signal: controller.signal,
            // S03: redirects are never followed (redirect:'manual') — every
            // hop would bypass the destination/port policy. Any 3xx answer is
            // reported below as a failed delivery, never retried or followed.
            redirect: 'manual',
          });
          clearTimeout(timer);
          const elapsed = Date.now() - startTime;
          const isRedirect = res.status >= 300 && res.status < 400;
          return {
            id: hook.id,
            name: hook.name,
            url: hook.url,
            status: res.status,
            ok: !isRedirect && res.ok,
            durationMs: elapsed,
            error: isRedirect ? `Redirect not followed (HTTP ${res.status})` : (res.ok ? null : `HTTP ${res.status}`),
          };
        } catch {
          clearTimeout(timer);
          const elapsed = Date.now() - startTime;
          const isTimeout = controller.signal.aborted;
          return {
            id: hook.id,
            name: hook.name,
            url: hook.url,
            status: 0,
            ok: false,
            durationMs: elapsed,
            error: isTimeout ? 'Request timed out after 5s' : 'Connection failed',
          };
        }
      });

      const dispatchResults = await Promise.all(dispatchPromises);

      return new Response(
        JSON.stringify({
          success: true,
          event: effectiveEventType,
          dispatchedCount: deliveryAttempts,
          results: dispatchResults,
          ...(skippedHooks.length > 0 ? { skippedHooks } : {}),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ─── GET /watchlist/state: Get current watchlist runtime state & findings ───
    if (request.method === 'GET' && (pathname === '/watchlist/state' || pathname === '/api/watchlist/state')) {
      let stub: any;
      try {
        stub = getWatchlistStub(env, uid);
      } catch {
        return new Response(
          JSON.stringify({ code: 'WATCHLIST_STORE_UNAVAILABLE', error: 'Watchlist service unavailable.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const state = await getWatchlistStateDO(stub);
        return new Response(JSON.stringify(state), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ code: 'WATCHLIST_STORE_UNAVAILABLE', error: err?.message || 'Failed to retrieve watchlist state' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ─── POST /watchlist/sync: Sync watchlist targets with monotonic revision ───
    if (request.method === 'POST' && (pathname === '/watchlist/sync' || pathname === '/api/watchlist/sync')) {
      let quotaStub: any;
      try {
        quotaStub = getQuotaStub(env, uid);
        const burstCheck = await checkBurstGuard(quotaStub);
        if (!burstCheck.ok) {
          const retryAfter = burstCheck.retryAfter || 60;
          return new Response(
            JSON.stringify({ code: 'RATE_LIMIT_EXCEEDED', error: 'Burst rate limit exceeded.', retryAfter }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } }
          );
        }
      } catch {
        // Quota counter unavailable, proceed with sync
      }

      let tierInfo: TierResolution;
      try {
        tierInfo = await resolveUserTier(idToken, userPayload, projectId, databaseId);
      } catch {
        tierInfo = { tier: 'free', limit: TIER_LIMITS.free };
      }

      let bodyText = '';
      try {
        bodyText = await request.text();
      } catch {
        return new Response(JSON.stringify({ error: 'Failed to read request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (bodyText.length > MAX_BODY_BYTES) {
        return new Response(JSON.stringify({ error: 'Payload too large (exceeds 32 KB cap)' }), {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let body: any;
      try {
        body = JSON.parse(bodyText);
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { targets, revision } = body || {};
      let stub: any;
      try {
        stub = getWatchlistStub(env, uid);
      } catch {
        return new Response(
          JSON.stringify({ code: 'WATCHLIST_STORE_UNAVAILABLE', error: 'Watchlist service unavailable.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const syncResult = await syncWatchlistDO(stub, targets, revision, tierInfo.tier);
        const status = syncResult.ok ? 200 : syncResult.error === 'STALE_REVISION' ? 409 : syncResult.error === 'TARGET_LIMIT_EXCEEDED' ? 403 : 400;
        return new Response(JSON.stringify(syncResult), {
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ code: 'WATCHLIST_STORE_UNAVAILABLE', error: err?.message || 'Sync failed' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ─── POST /watchlist/sweep-now: Trigger immediate caller sweep ───
    if (request.method === 'POST' && (pathname === '/watchlist/sweep-now' || pathname === '/api/watchlist/sweep-now')) {
      let quotaStub: any;
      try {
        quotaStub = getQuotaStub(env, uid);
        const burstCheck = await checkBurstGuard(quotaStub);
        if (!burstCheck.ok) {
          const retryAfter = burstCheck.retryAfter || 60;
          return new Response(
            JSON.stringify({ code: 'RATE_LIMIT_EXCEEDED', error: 'Burst rate limit exceeded.', retryAfter }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(retryAfter) } }
          );
        }
      } catch {
        // Quota counter unavailable, proceed with sweep
      }

      let stub: any;
      try {
        stub = getWatchlistStub(env, uid);
      } catch {
        return new Response(
          JSON.stringify({ code: 'WATCHLIST_STORE_UNAVAILABLE', error: 'Watchlist service unavailable.' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const sweepResult = await sweepWatchlistNowDO(stub);
        const status = sweepResult.ok ? 200 : sweepResult.error === 'SWEEP_IN_PROGRESS' ? 409 : 500;
        return new Response(JSON.stringify(sweepResult), {
          status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ code: 'WATCHLIST_STORE_UNAVAILABLE', error: err?.message || 'Sweep execution failed' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Read and enforce body size cap (~32 KB)
    let bodyText = '';
    try {
      bodyText = await request.text();
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to read request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (bodyText.length > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload too large (exceeds 32 KB cap)' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { provider, messages, model, response_format, temperature, max_tokens, prompt, systemPrompt, schemaObj } = payload;

    // Validate Provider
    if (provider !== 'groq' && provider !== 'openrouter') {
      return new Response(
        JSON.stringify({ error: `Unsupported provider '${provider}'. Must be 'groq' or 'openrouter'.` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Model Allowlist Validation (§3)
    let selectedModel: string;
    if (provider === 'groq') {
      if (model && !GROQ_ALLOWED_MODELS.includes(model)) {
        return new Response(
          JSON.stringify({ error: `Model '${model}' is not permitted for Groq provider. Allowed models: ${GROQ_ALLOWED_MODELS.join(', ')}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      selectedModel = model || GROQ_DEFAULT_MODEL;
    } else {
      if (model && !OPENROUTER_ALLOWED_MODELS.includes(model)) {
        return new Response(
          JSON.stringify({ error: `Model '${model}' is not permitted for OpenRouter provider. Allowed models: ${OPENROUTER_ALLOWED_MODELS.join(', ')}` }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      selectedModel = model || OPENROUTER_DEFAULT_MODEL;
    }

    // Clamp max_tokens and temperature (§3)
    const clampedMaxTokens = typeof max_tokens === 'number'
      ? Math.max(1, Math.min(Math.floor(max_tokens), MAX_TOKENS_CEILING))
      : DEFAULT_MAX_TOKENS;

    const clampedTemperature = typeof temperature === 'number'
      ? Math.max(0.0, Math.min(2.0, temperature))
      : 0.7;

    // Build standard messages array if prompt/systemPrompt were passed
    let finalMessages = messages;
    if (!Array.isArray(finalMessages)) {
      if (prompt) {
        let sysContent = systemPrompt || 'You are a friendly cybersecurity expert.';
        if (schemaObj) {
          const schemaDetails = Object.keys(schemaObj.properties || {}).map(k => ' - ' + k).join('\n');
          sysContent = `${sysContent}\n\nCRITICAL: You MUST output ONLY valid JSON. The JSON MUST contain exactly the following keys:\n${schemaDetails}`;
        }
        finalMessages = [
          { role: 'system', content: sysContent },
          { role: 'user', content: prompt }
        ];
      } else {
        return new Response(JSON.stringify({ error: 'Missing messages or prompt in payload' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Enforce message count and length caps
    if (finalMessages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: `Too many messages (max ${MAX_MESSAGES} allowed)` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const totalChars = finalMessages.reduce(
      (sum: number, m: any) => sum + (typeof m.content === 'string' ? m.content.length : 0),
      0
    );
    if (totalChars > MAX_TOTAL_CHARS) {
      return new Response(
        JSON.stringify({ error: `Total message content too long (max ${MAX_TOTAL_CHARS.toLocaleString()} characters)` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Burst Guard Check before Firestore read (§8)
    // Durable Object availability is best-effort: a brief DO outage must not
    // block the chat. Fail open — provider caps (max_tokens, timeout) and the
    // auth layer still protect the endpoint. Metering resumes when DO recovers.
    let quotaStub: any = null;
    try {
      quotaStub = getQuotaStub(env, uid);
    } catch (err) {
      console.error('QUOTA_DO_BINDING_FAILED uid=' + uid, err instanceof Error ? err.message : err);
      quotaStub = null;
    }

    let quotaDegraded = false;
    if (quotaStub) {
      try {
        const burstCheck = await checkBurstGuard(quotaStub);
        if (!burstCheck.ok) {
          const retryAfter = burstCheck.retryAfter || 60;
          return new Response(
            JSON.stringify({
              code: 'RATE_LIMIT_EXCEEDED',
              error: 'Burst rate limit exceeded. Please slow down and try again shortly.',
              retryAfter,
            }),
            {
              status: 429,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Retry-After': String(retryAfter),
              },
            }
          );
        }
      } catch (err) {
        console.error('BURST_CHECK_FAILED uid=' + uid, err instanceof Error ? err.message : err);
        quotaDegraded = true; // fail open
      }
    } else {
      quotaDegraded = true;
    }

    // 4. Resolve Effective Tier & Limit (§1, §2)
    let tierInfo: TierResolution;
    try {
      tierInfo = await resolveUserTier(idToken, userPayload, projectId, databaseId);
    } catch {
      return new Response(
        JSON.stringify({
          code: 'TIER_STORE_UNAVAILABLE',
          error: 'User subscription verification service unavailable. Please retry shortly.',
          retryAfter: 30,
        }),
        {
          status: 503,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': '30',
          },
        }
      );
    }

    // 5. Reserve Quota BEFORE Provider Call (§4, §5)
    // DO unavailable -> fail open (serve the request), mark quota-degraded.
    // Metering resumes automatically when the DO recovers.
    let reserveResult: { ok: boolean; used: number; limit: number };
    if (quotaStub) {
      try {
        reserveResult = await reserveQuotaUnit(quotaStub, tierInfo.limit, cairoDay);
      } catch (err) {
        console.error('QUOTA_RESERVE_FAILED uid=' + uid, err instanceof Error ? err.message : err);
        quotaDegraded = true;
        reserveResult = { ok: true, used: -1, limit: tierInfo.limit };
      }
    } else {
      quotaDegraded = true;
      reserveResult = { ok: true, used: -1, limit: tierInfo.limit };
    }

    if (!reserveResult.ok) {
      return new Response(
        JSON.stringify({
          code: 'AI_DAILY_QUOTA_EXCEEDED',
          error: `Daily AI request quota reached (${reserveResult.used}/${reserveResult.limit} used for ${tierInfo.tier} tier). Quota resets at midnight Cairo time.`,
          limit: reserveResult.limit,
          used: reserveResult.used,
          tier: tierInfo.tier,
          retryAfter: secondsUntilMidnight,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(secondsUntilMidnight),
            'X-RateLimit-Limit': String(reserveResult.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(secondsUntilMidnight),
          },
        }
      );
    }

    const rateLimitHeaders: Record<string, string> = {
      'X-RateLimit-Limit': String(reserveResult.limit),
      'X-RateLimit-Remaining': String(Math.max(0, reserveResult.limit - reserveResult.used)),
      'X-RateLimit-Reset': String(secondsUntilMidnight),
    };
    if (quotaDegraded) {
      rateLimitHeaders['X-Quota-Degraded'] = 'true';
    }

    // 6. Forward Request to Upstream AI Provider
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      if (provider === 'groq') {
        const apiKey = env.GROQ_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'Groq provider secret not configured on proxy' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', ...rateLimitHeaders },
          });
        }

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: finalMessages,
            temperature: clampedTemperature,
            max_tokens: clampedMaxTokens,
            ...(response_format ? { response_format } : {}),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!groqRes.ok) {
          console.error(`Groq upstream error status: ${groqRes.status}`);
          return new Response(JSON.stringify({ error: `Upstream AI provider error (status ${groqRes.status})` }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', ...rateLimitHeaders },
          });
        }

        const data = await groqRes.json();
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', ...rateLimitHeaders },
        });

      } else {
        const apiKey = env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'OpenRouter provider secret not configured on proxy' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', ...rateLimitHeaders },
          });
        }

        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://joescan.me',
            'X-Title': 'JoeScan AI Cyber Assistant',
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: finalMessages,
            temperature: clampedTemperature,
            max_tokens: clampedMaxTokens,
            ...(response_format ? { response_format } : {}),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!orRes.ok) {
          console.error(`OpenRouter upstream error status: ${orRes.status}`);
          return new Response(JSON.stringify({ error: `Upstream AI provider error (status ${orRes.status})` }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', ...rateLimitHeaders },
          });
        }

        const data = await orRes.json();
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', ...rateLimitHeaders },
        });
      }
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr?.name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'Upstream AI provider request timed out' }), {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', ...rateLimitHeaders },
        });
      }
      console.error('Proxy fetch failed:', fetchErr);
      return new Response(JSON.stringify({ error: 'Internal AI proxy error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', ...rateLimitHeaders },
      });
    }
  },
};

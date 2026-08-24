import * as jose from 'jose';
export { QuotaCounter } from './quota';

export interface Env {
  ENVIRONMENT?: string;
  PROJECT_ID?: string;
  FIRESTORE_DATABASE_ID?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  QUOTA_COUNTER?: DurableObjectNamespace;
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

async function fetchUserWebhooksFromFirestore(
  idToken: string,
  uid: string,
  projectId: string,
  databaseId: string
): Promise<WebhookDoc[]> {
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
  if (!Array.isArray(results)) return [];

  const webhooks: WebhookDoc[] = [];
  for (const item of results) {
    if (!item.document || !item.document.fields) continue;
    const docPath = item.document.name || '';
    const id = docPath.split('/').pop() || '';
    const f = item.document.fields;

    const ownerId = f.ownerId?.stringValue;
    if (ownerId !== uid) continue;

    const hookUrl = f.url?.stringValue;
    if (!hookUrl || (!hookUrl.startsWith('http://') && !hookUrl.startsWith('https://'))) continue;

    const secret = f.secret?.stringValue || '';
    const active = f.active?.booleanValue !== false;
    const rawEvents = f.events?.arrayValue?.values || [];
    const events = rawEvents.map((v: any) => v.stringValue).filter(Boolean);
    const name = f.name?.stringValue || 'Webhook';

    webhooks.push({
      id,
      name,
      url: hookUrl,
      secret,
      events,
      active,
    });
  }

  return webhooks;
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
  const isAdmin = userPayload.admin === true ||
    (userPayload.email === ADMIN_EMAIL && userPayload.email_verified === true);

  if (isAdmin) {
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

      let peekResult: { used: number; day: string };
      try {
        const stub = getQuotaStub(env, uid);
        peekResult = await peekQuotaUnits(stub, cairoDay);
      } catch {
        return new Response(
          JSON.stringify({
            code: 'QUOTA_STORE_UNAVAILABLE',
            error: 'Quota service temporarily unavailable. Please retry shortly.',
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
    if (request.method === 'POST' && (pathname === '/webhook-dispatch' || pathname === '/api/webhook-dispatch')) {
      let dispatchBody: any;
      try {
        dispatchBody = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { eventType, event, scanId, target, riskLevel, data, webhookId } = dispatchBody || {};
      const effectiveEventType = eventType || event || 'scan_complete';

      let userWebhooks: WebhookDoc[] = [];
      try {
        userWebhooks = await fetchUserWebhooksFromFirestore(idToken, uid, projectId, databaseId);
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'Failed to fetch webhook configurations' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filter matching active webhooks
      let matchingHooks = userWebhooks.filter(hook => {
        if (!hook.active) return false;
        if (webhookId && hook.id === webhookId) return true;
        if (effectiveEventType === 'test_ping') return true;
        return hook.events.includes(effectiveEventType) || hook.events.includes('all');
      });

      // Bound: max 10 webhooks per dispatch call
      matchingHooks = matchingHooks.slice(0, 10);

      const timestampSec = Math.floor(Date.now() / 1000);
      const outboundEventPayload = {
        event: effectiveEventType,
        timestamp: timestampSec,
        scanId: scanId || null,
        target: target || null,
        riskLevel: riskLevel || 'Low',
        data: data || null,
      };
      const rawPayloadString = JSON.stringify(outboundEventPayload);

      // Dispatch to each webhook concurrently with 5s timeout
      const dispatchPromises = matchingHooks.map(async (hook) => {
        const startTime = Date.now();
        const signaturePayload = `${timestampSec}.${rawPayloadString}`;
        let signatureHex = '';
        try {
          signatureHex = await computeHmacSha256Hex(hook.secret, signaturePayload);
        } catch (sigErr) {
          console.warn('HMAC computation failed for hook', hook.id, sigErr);
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);

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
          });
          clearTimeout(timer);
          const elapsed = Date.now() - startTime;
          return {
            id: hook.id,
            name: hook.name,
            url: hook.url,
            status: res.status,
            ok: res.ok,
            durationMs: elapsed,
            error: res.ok ? null : `HTTP ${res.status}`,
          };
        } catch (fetchErr: any) {
          clearTimeout(timer);
          const elapsed = Date.now() - startTime;
          const isTimeout = fetchErr?.name === 'AbortError';
          return {
            id: hook.id,
            name: hook.name,
            url: hook.url,
            status: 0,
            ok: false,
            durationMs: elapsed,
            error: isTimeout ? 'Request timed out after 5s' : (fetchErr?.message || 'Connection failed'),
          };
        }
      });

      const dispatchResults = await Promise.all(dispatchPromises);

      return new Response(
        JSON.stringify({
          success: true,
          event: effectiveEventType,
          dispatchedCount: dispatchResults.length,
          results: dispatchResults,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
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
    let quotaStub: any;
    try {
      quotaStub = getQuotaStub(env, uid);
    } catch {
      return new Response(
        JSON.stringify({
          code: 'QUOTA_STORE_UNAVAILABLE',
          error: 'Quota service temporarily unavailable. Please retry shortly.',
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
    } catch {
      return new Response(
        JSON.stringify({
          code: 'QUOTA_STORE_UNAVAILABLE',
          error: 'Rate limiter temporarily unavailable. Please retry shortly.',
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
    let reserveResult: { ok: boolean; used: number; limit: number };
    try {
      reserveResult = await reserveQuotaUnit(quotaStub, tierInfo.limit, cairoDay);
    } catch {
      return new Response(
        JSON.stringify({
          code: 'QUOTA_STORE_UNAVAILABLE',
          error: 'Quota reservation service unavailable. Please retry shortly.',
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

    const rateLimitHeaders = {
      'X-RateLimit-Limit': String(reserveResult.limit),
      'X-RateLimit-Remaining': String(Math.max(0, reserveResult.limit - reserveResult.used)),
      'X-RateLimit-Reset': String(secondsUntilMidnight),
    };

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

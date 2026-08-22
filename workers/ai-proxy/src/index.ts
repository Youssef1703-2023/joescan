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

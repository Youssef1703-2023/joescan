import * as jose from 'jose';

export interface Env {
  ENVIRONMENT?: string;
  PROJECT_ID?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

const FIREBASE_PROJECT_ID = 'gen-lang-client-0439091084';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

const ALLOWED_ORIGINS = [
  'https://joescan.me',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];

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

  const certs = await res.json() as Record<string, string>;
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
    // Force one refresh if kid is unknown (key rotation)
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

function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://joescan.me',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request: Request, env: Env, ctx?: any): Promise<Response> {
    const corsHeaders = getCorsHeaders(request);

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Authenticate via Firebase ID Token
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized: missing or invalid Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const idToken = authHeader.substring(7).trim();
    const projectId = env.PROJECT_ID || FIREBASE_PROJECT_ID;

    let userPayload: jose.JWTPayload;
    try {
      userPayload = await verifyFirebaseIdToken(idToken, projectId);
    } catch (authErr: any) {
      console.warn('ID token verification failed:', authErr?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Read and enforce body size cap (~32 KB)
    let bodyText = '';
    try {
      bodyText = await request.text();
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to read request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (bodyText.length > 32 * 1024) {
      return new Response(JSON.stringify({ error: 'Payload too large (exceeds 32 KB cap)' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let payload: any;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { provider, messages, model, response_format, temperature, max_tokens, prompt, systemPrompt, schemaObj } = payload;

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
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Enforce message count and length caps
    if (finalMessages.length > 50) {
      return new Response(JSON.stringify({ error: 'Too many messages (max 50 allowed)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const totalChars = finalMessages.reduce((sum: number, m: any) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
    if (totalChars > 20000) {
      return new Response(JSON.stringify({ error: 'Total message content too long (max 20,000 characters)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. Route to provider
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    try {
      if (provider === 'groq') {
        const apiKey = env.GROQ_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'Groq provider secret not configured on proxy' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model || 'llama-3.3-70b-versatile',
            messages: finalMessages,
            temperature: typeof temperature === 'number' ? temperature : 0.7,
            max_tokens: typeof max_tokens === 'number' ? max_tokens : 1024,
            ...(response_format ? { response_format } : {}),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!groqRes.ok) {
          console.error(`Groq upstream error status: ${groqRes.status}`);
          return new Response(JSON.stringify({ error: `Upstream AI provider error (status ${groqRes.status})` }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const data = await groqRes.json();
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } else if (provider === 'openrouter') {
        const apiKey = env.OPENROUTER_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: 'OpenRouter provider secret not configured on proxy' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
            model: model || 'openai/gpt-oss-120b:free',
            messages: finalMessages,
            temperature: typeof temperature === 'number' ? temperature : 0.7,
            max_tokens: typeof max_tokens === 'number' ? max_tokens : 1024,
            ...(response_format ? { response_format } : {}),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!orRes.ok) {
          console.error(`OpenRouter upstream error status: ${orRes.status}`);
          return new Response(JSON.stringify({ error: `Upstream AI provider error (status ${orRes.status})` }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const data = await orRes.json();
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } else {
        clearTimeout(timeoutId);
        return new Response(JSON.stringify({ error: `Unsupported provider '${provider}'. Must be 'groq' or 'openrouter'.` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (fetchErr?.name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'Upstream AI provider request timed out' }), {
          status: 504,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      console.error('Proxy fetch failed:', fetchErr);
      return new Response(JSON.stringify({ error: 'Internal AI proxy error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

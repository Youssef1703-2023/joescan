import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The ban gate tests exercise post-authentication behavior, so Firebase JWT
// verification is stubbed at the crypto boundary. Tokens are looked up in a
// map and unknown tokens fail verification exactly like an invalid signature
// would. No real credentials, certificates, or network access are involved.
const h = vi.hoisted(() => ({
  payloads: new Map<string, Record<string, unknown>>(),
}));

vi.mock('jose', () => ({
  decodeProtectedHeader: (_token: string) => ({ alg: 'RS256', kid: 'test-kid' }),
  importX509: async () => ({}),
  jwtVerify: async (token: string) => {
    const payload = h.payloads.get(token);
    if (!payload) {
      throw new Error('signature verification failed');
    }
    return { payload, protectedHeader: { alg: 'RS256', kid: 'test-kid' } };
  },
}));

import handler from './index';
import type { Env } from './index';
import { QuotaCounter } from './quota';

const CERTS_URL_FRAGMENT = 'securetoken@system.gserviceaccount.com';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/test-project/databases/test-db/documents';

const USER_TOKEN = 'tok-user';
const ADMIN_TOKEN = 'tok-admin';
const USER_UID = 'uid-1';
const AI_BODY = JSON.stringify({ provider: 'groq', messages: [{ role: 'user', content: 'hello' }] });

// Minimal in-memory Durable Object namespace backed by the real QuotaCounter
// class, so S03's fail-closed dispatch limiter exercises production logic
// offline. Each name gets its own persistent storage for the test run.
function makeQuotaNamespace(): DurableObjectNamespace {
  const instances = new Map<string, QuotaCounter>();
  const makeState = () => {
    const store = new Map<string, unknown>();
    return {
      storage: {
        get: async (key: string) => store.get(key),
        put: async (key: string, value: unknown) => { store.set(key, value); },
      },
    } as unknown as DurableObjectState;
  };
  return {
    idFromName: (name: string) => name,
    get: (name: string) => {
      if (!instances.has(name)) instances.set(name, new QuotaCounter(makeState(), {}));
      return instances.get(name) as unknown as DurableObjectStub;
    },
  } as unknown as DurableObjectNamespace;
}

interface RecordedCall {
  url: string;
  init: any;
}

type BanDocMode = 'absent' | 'active' | 'inactive' | 'network-error' | 'http-500' | 'bad-json';
type UserTierDocMode = 'absent' | 'enterprise' | 'pro' | 'network-error';

let calls: RecordedCall[];
let banDocMode: BanDocMode;
let userTierDocMode: UserTierDocMode;
let webhookQueryDocs: any[];
let providerCalls: number;
let webhookDeliveryCalls: number;
let webhookDeliveryStatus: number;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function banDocResponse(): Response {
  const name = `${FIRESTORE_BASE}/bannedUsers/${USER_UID}`;
  switch (banDocMode) {
    case 'absent':
      return jsonResponse({ error: { code: 404, message: 'No document found', status: 'NOT_FOUND' } }, 404);
    case 'active':
      return jsonResponse({ name, fields: { active: { booleanValue: true } } });
    case 'inactive':
      return jsonResponse({ name, fields: { active: { booleanValue: false } } });
    case 'http-500':
      return new Response('internal firestore error', { status: 500 });
    case 'bad-json':
      return new Response('<html>gateway error page</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    case 'network-error':
      throw new Error('simulated network outage');
  }
}

function installFetchMock(): void {
  const mockFetch = vi.fn(async (input: any, init?: any): Promise<Response> => {
    const url = typeof input === 'string' ? input : String(input.url);
    calls.push({ url, init });

    if (url.includes(CERTS_URL_FRAGMENT)) {
      return jsonResponse({ 'test-kid': '-----BEGIN CERTIFICATE-----TEST-----END CERTIFICATE-----' });
    }
    if (url.includes('/documents/bannedUsers/')) {
      return banDocResponse();
    }
    if (url.includes(':runQuery')) {
      return jsonResponse(webhookQueryDocs);
    }
    if (url.includes('/documents/users/')) {
      if (userTierDocMode === 'network-error') {
        throw new Error('simulated tier store outage');
      }
      if (userTierDocMode === 'enterprise' || userTierDocMode === 'pro') {
        return jsonResponse({
          name: `${FIRESTORE_BASE}/users/${USER_UID}`,
          fields: {
            tier: { stringValue: userTierDocMode },
            subscriptionExpiry: { timestampValue: new Date(Date.now() + 30 * 86400 * 1000).toISOString() },
          },
        });
      }
      return jsonResponse({ error: { code: 404, message: 'No document found', status: 'NOT_FOUND' } }, 404);
    }
    if (url.startsWith('https://api.groq.com')) {
      providerCalls++;
      return jsonResponse({ id: 'chatcmpl-test', choices: [{ message: { role: 'assistant', content: 'ok' } }] });
    }
    if (url.startsWith('https://hooks.example.test')) {
      webhookDeliveryCalls++;
      if (webhookDeliveryStatus === 302) {
        // Redirect answer with a Location the policy must never follow.
        return new Response(null, { status: 302, headers: { Location: 'https://evil.example.test/next' } });
      }
      return jsonResponse({ received: true });
    }
    throw new Error(`Unexpected fetch in test: ${url}`);
  });
  vi.stubGlobal('fetch', mockFetch);
}

function authedRequest(url: string, method: string, token: string, body?: string): Request {
  return new Request(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body } : {}),
  });
}

const aiRequest = (token: string) =>
  authedRequest('https://proxy.joescan.test/api/ai', 'POST', token, AI_BODY);

const quotaRequest = (token: string) =>
  authedRequest('https://proxy.joescan.test/quota', 'GET', token);

const watchlistStateRequest = (token: string) =>
  authedRequest('https://proxy.joescan.test/watchlist/state', 'GET', token);

function webhookDispatchRequest(token: string): Request {
  return authedRequest(
    'https://proxy.joescan.test/webhook-dispatch',
    'POST',
    token,
    JSON.stringify({ eventType: 'scan_complete', scanId: 'scan-1', target: 'example.test', riskLevel: 'Low' })
  );
}

const baseEnv: Omit<Env, 'QUOTA_COUNTER'> = {
  PROJECT_ID: 'test-project',
  FIRESTORE_DATABASE_ID: 'test-db',
  GROQ_API_KEY: 'test-groq-key',
  // S03: destination policy required for webhook dispatch (fail closed when
  // absent) and a working limiter store (fail closed when unavailable).
  WEBHOOK_ALLOWED_HOSTS: 'hooks.example.test',
};

// Fresh env per test so Durable Object windows never leak between cases.
let env: Env;

const banStoreCalls = () => calls.filter(c => c.url.includes('/documents/bannedUsers/')).length;
const tierStoreCalls = () => calls.filter(c => c.url.includes('/documents/users/')).length;
const runQueryCalls = () => calls.filter(c => c.url.includes(':runQuery')).length;

beforeEach(() => {
  calls = [];
  banDocMode = 'absent';
  userTierDocMode = 'absent';
  webhookQueryDocs = [];
  providerCalls = 0;
  webhookDeliveryCalls = 0;
  webhookDeliveryStatus = 200;
  env = { ...baseEnv, QUOTA_COUNTER: makeQuotaNamespace() };
  h.payloads.set(USER_TOKEN, { sub: USER_UID, email: 'user@example.test', email_verified: true });
  h.payloads.set(ADMIN_TOKEN, { sub: 'uid-admin', email: 'admin@example.test', admin: true });
  installFetchMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
  h.payloads.clear();
});

describe('S02 worker ban gate', () => {
  describe('actively banned user is rejected before any downstream work', () => {
    beforeEach(() => {
      banDocMode = 'active';
    });

    it('AI provider path: uniform JSON 403, zero provider and tier-store calls', async () => {
      const res = await handler.fetch(aiRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(403);
      expect(body.code).toBe('ACCOUNT_BANNED');
      expect(body.error).toContain('Account suspended');
      // The ban reason must never be exposed.
      expect(JSON.stringify(body)).not.toContain('reason');
      expect(providerCalls).toBe(0);
      expect(tierStoreCalls()).toBe(0);
      expect(runQueryCalls()).toBe(0);
      expect(banStoreCalls()).toBe(1);
    });

    it('webhook-dispatch path: no webhook query and no outbound delivery', async () => {
      webhookQueryDocs = [{
        document: {
          name: `${FIRESTORE_BASE}/webhooks/hook-1`,
          fields: {
            ownerId: { stringValue: USER_UID },
            url: { stringValue: 'https://hooks.example.test/siem' },
            secret: { stringValue: 'hook-secret' },
            name: { stringValue: 'SIEM' },
            active: { booleanValue: true },
            events: { arrayValue: { values: [{ stringValue: 'scan_complete' }] } },
          },
        },
      }];

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(403);
      expect(body.code).toBe('ACCOUNT_BANNED');
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
    });

    it('quota path: no tier resolution and no Durable Object work', async () => {
      const res = await handler.fetch(quotaRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(403);
      expect(body.code).toBe('ACCOUNT_BANNED');
      expect(tierStoreCalls()).toBe(0);
    });

    it('watchlist state path: 403 takes precedence over the DO-unavailable 503', async () => {
      const res = await handler.fetch(watchlistStateRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(403);
      expect(body.code).toBe('ACCOUNT_BANNED');
      // Without the gate this endpoint would answer 503 WATCHLIST_STORE_UNAVAILABLE.
      expect(JSON.stringify(body)).not.toContain('WATCHLIST_STORE_UNAVAILABLE');
    });

    it('admin tokens bypass the gate entirely (no ban lookup, full service)', async () => {
      const res = await handler.fetch(aiRequest(ADMIN_TOKEN), env);

      expect(res.status).toBe(200);
      expect(providerCalls).toBe(1);
      expect(banStoreCalls()).toBe(0);
    });
  });

  describe('absent or inactive ban records proceed normally', () => {
    it('no ban document (404) -> request proceeds to the provider', async () => {
      banDocMode = 'absent';
      const res = await handler.fetch(aiRequest(USER_TOKEN), env);

      expect(res.status).toBe(200);
      expect(providerCalls).toBe(1);
      expect(banStoreCalls()).toBe(1);
    });

    it('ban document with active=false (unbanned) -> request proceeds', async () => {
      banDocMode = 'inactive';
      const res = await handler.fetch(aiRequest(USER_TOKEN), env);

      expect(res.status).toBe(200);
      expect(providerCalls).toBe(1);
    });

    it('webhook-dispatch proceeds when the ban document is absent', async () => {
      banDocMode = 'absent';
      userTierDocMode = 'enterprise'; // S03: dispatch requires an active enterprise subscription
      webhookQueryDocs = [{
        document: {
          name: `${FIRESTORE_BASE}/webhooks/hook-1`,
          fields: {
            ownerId: { stringValue: USER_UID },
            url: { stringValue: 'https://hooks.example.test/siem' },
            secret: { stringValue: 'hook-secret' },
            name: { stringValue: 'SIEM' },
            active: { booleanValue: true },
            events: { arrayValue: { values: [{ stringValue: 'scan_complete' }] } },
          },
        },
      }];

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.dispatchedCount).toBe(1);
      expect(webhookDeliveryCalls).toBe(1);
      expect(banStoreCalls()).toBe(1);
    });
  });

  describe('ban store failures fail closed with a retryable 503', () => {
    it('network error reaching the ban store -> 503, zero downstream work', async () => {
      banDocMode = 'network-error';
      const res = await handler.fetch(aiRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(503);
      expect(res.headers.get('Retry-After')).toBe('30');
      expect(body.code).toBe('BAN_STATUS_UNAVAILABLE');
      expect(providerCalls).toBe(0);
      expect(tierStoreCalls()).toBe(0);
      expect(runQueryCalls()).toBe(0);
    });

    it('ban store answers HTTP 500 -> 503, zero downstream work', async () => {
      banDocMode = 'http-500';
      const res = await handler.fetch(aiRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(503);
      expect(body.code).toBe('BAN_STATUS_UNAVAILABLE');
      expect(providerCalls).toBe(0);
      expect(tierStoreCalls()).toBe(0);
    });

    it('ban store returns an unparseable body -> 503, zero downstream work', async () => {
      banDocMode = 'bad-json';
      const res = await handler.fetch(aiRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(503);
      expect(body.code).toBe('BAN_STATUS_UNAVAILABLE');
      expect(providerCalls).toBe(0);
    });

    it('quota path also fails closed when the ban store is down', async () => {
      banDocMode = 'http-500';
      const res = await handler.fetch(quotaRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(503);
      expect(body.code).toBe('BAN_STATUS_UNAVAILABLE');
      expect(tierStoreCalls()).toBe(0);
    });
  });

  describe('authentication still precedes the ban gate', () => {
    it('invalid token -> 401 with no ban-store lookup', async () => {
      const res = await handler.fetch(aiRequest('tok-unknown'), env);

      expect(res.status).toBe(401);
      expect(banStoreCalls()).toBe(0);
      expect(providerCalls).toBe(0);
    });

    it('missing Authorization header -> 401 with no ban-store lookup', async () => {
      const res = await handler.fetch(
        new Request('https://proxy.joescan.test/api/ai', { method: 'POST', body: AI_BODY }),
        env
      );

      expect(res.status).toBe(401);
      expect(banStoreCalls()).toBe(0);
    });
  });
});

describe('S03 webhook dispatch hardening', () => {
  function hookDoc(url: string, secret: string = 'hook-secret'): any {
    return {
      document: {
        name: `${FIRESTORE_BASE}/webhooks/hook-1`,
        fields: {
          ownerId: { stringValue: USER_UID },
          url: { stringValue: url },
          secret: { stringValue: secret },
          name: { stringValue: 'SIEM' },
          active: { booleanValue: true },
          events: { arrayValue: { values: [{ stringValue: 'scan_complete' }] } },
        },
      },
    };
  }

  function enableHook(url: string, secret: string = 'hook-secret'): void {
    userTierDocMode = 'enterprise';
    webhookQueryDocs = [hookDoc(url, secret)];
  }

  const deliveryInit = (): any => calls.find(c => c.url.startsWith('https://hooks.example.test'))?.init;

  async function fillDispatchWindow(doName: string, key: string, limit: number): Promise<void> {
    const stub: any = (env.QUOTA_COUNTER as any).get(doName);
    for (let i = 0; i < limit; i++) {
      await stub.reserveWindow(key, limit, 3600);
    }
  }

  describe('destination policy', () => {
    it('happy path: enterprise caller with a policy-valid hook delivers once, signed, without following redirects', async () => {
      enableHook('https://hooks.example.test/siem');

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.event).toBe('scan_complete');
      expect(body.dispatchedCount).toBe(1);
      expect(webhookDeliveryCalls).toBe(1);
      expect(deliveryInit().redirect).toBe('manual');
      expect(deliveryInit().headers['X-JoeScan-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
      expect(deliveryInit().headers['X-JoeScan-Event']).toBe('scan_complete');
      expect(body.results[0].ok).toBe(true);
    });

    it('explicit port 443 is allowed', async () => {
      enableHook('https://hooks.example.test:443/siem');

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.dispatchedCount).toBe(1);
      expect(webhookDeliveryCalls).toBe(1);
    });

    it.each([
      ['http://hooks.example.test/siem', 'HTTPS_REQUIRED'],
      ['https://user:pass@hooks.example.test/siem', 'URL_CREDENTIALS_REJECTED'],
      ['https://hooks.example.test:8080/siem', 'PORT_NOT_ALLOWED'],
      ['https://hooks.example.test:8443/siem', 'PORT_NOT_ALLOWED'],
      ['https://127.0.0.1/siem', 'HOST_NOT_ALLOWED'],
      ['https://10.0.0.5/siem', 'HOST_NOT_ALLOWED'],
      ['https://192.168.1.10/siem', 'HOST_NOT_ALLOWED'],
      ['https://169.254.169.254/latest/meta-data/', 'HOST_NOT_ALLOWED'],
      ['https://[::1]/siem', 'HOST_NOT_ALLOWED'],
      ['https://localhost/siem', 'HOST_NOT_ALLOWED'],
      ['https://siem.local/collect', 'HOST_NOT_ALLOWED'],
      ['https://intranet/siem', 'HOST_NOT_ALLOWED'],
      ['https://untrusted.example.test/siem', 'HOST_NOT_ALLOWED'],
      ['not a url', 'INVALID_URL'],
    ])('rejects %s at query time (%s) with no delivery', async (url, reason) => {
      enableHook(url);

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.dispatchedCount).toBe(0);
      expect(body.results).toEqual([]);
      expect(webhookDeliveryCalls).toBe(0);
      expect(body.skippedHooks).toHaveLength(1);
      expect(body.skippedHooks[0].reason).toBe(reason);
    });
  });

  describe('request body bounds and shape', () => {
    it('oversize body -> 413 before the rate limiter, webhook query, and delivery', async () => {
      enableHook('https://hooks.example.test/siem');
      const oversizeBody = JSON.stringify({ eventType: 'scan_complete', data: { blob: 'x'.repeat(17 * 1024) } });

      const res = await handler.fetch(authedRequest(
        'https://proxy.joescan.test/webhook-dispatch', 'POST', USER_TOKEN, oversizeBody
      ), env);
      const body = await res.json() as any;

      expect(res.status).toBe(413);
      expect(body.code).toBe('PAYLOAD_TOO_LARGE');
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
      // The dispatch limiter windows were never consumed: the account window
      // is still empty, so one reserve succeeds with count 1.
      const accountStub: any = (env.QUOTA_COUNTER as any).get(`webhook:acct:${USER_UID}`);
      const probe = await accountStub.reserveWindow(`acct:${USER_UID}`, 20, 3600);
      expect(probe.count).toBe(1);
    });

    it.each([
      'null',
      '[1, 2, 3]',
      '"just a string"',
      '{invalid json',
      '{"eventType": 42}',
      '{"scanId": 7}',
      '{"target": true}',
      '{"data": "not-an-object"}',
    ])('malformed body %s -> 400 before webhook query and delivery', async (rawBody) => {
      enableHook('https://hooks.example.test/siem');

      const res = await handler.fetch(authedRequest(
        'https://proxy.joescan.test/webhook-dispatch', 'POST', USER_TOKEN, rawBody
      ), env);

      expect(res.status).toBe(400);
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
    });

    it('oversize derived outbound payload -> 413 before any delivery', async () => {
      enableHook('https://hooks.example.test/siem');
      // Fits inside the 16 KB request cap but serializes past the 8 KB outbound cap.
      const body = JSON.stringify({ eventType: 'scan_complete', data: { blob: 'y'.repeat(9 * 1024) } });

      const res = await handler.fetch(authedRequest(
        'https://proxy.joescan.test/webhook-dispatch', 'POST', USER_TOKEN, body
      ), env);
      const json = await res.json() as any;

      expect(res.status).toBe(413);
      expect(json.code).toBe('PAYLOAD_TOO_LARGE');
      expect(webhookDeliveryCalls).toBe(0);
    });
  });

  describe('tier enforcement at dispatch time', () => {
    it('free-tier caller denied before hook query and delivery', async () => {
      userTierDocMode = 'absent';
      webhookQueryDocs = [hookDoc('https://hooks.example.test/siem')];

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(403);
      expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
    });

    it('pro-tier caller denied as well (Enterprise only)', async () => {
      userTierDocMode = 'pro';
      webhookQueryDocs = [hookDoc('https://hooks.example.test/siem')];

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(403);
      expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
    });

    it('tier store outage fails closed with retryable 503 before hook query and delivery', async () => {
      userTierDocMode = 'network-error';
      webhookQueryDocs = [hookDoc('https://hooks.example.test/siem')];

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(503);
      expect(res.headers.get('Retry-After')).toBe('30');
      expect(body.code).toBe('TIER_STORE_UNAVAILABLE');
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
    });

    it('admin tokens keep their elevated behavior and may dispatch', async () => {
      userTierDocMode = 'enterprise';
      // The hook must be owned by the admin account's uid to pass ownership.
      webhookQueryDocs = [{
        document: {
          name: `${FIRESTORE_BASE}/webhooks/hook-1`,
          fields: {
            ownerId: { stringValue: 'uid-admin' },
            url: { stringValue: 'https://hooks.example.test/siem' },
            secret: { stringValue: 'hook-secret' },
            name: { stringValue: 'SIEM' },
            active: { booleanValue: true },
            events: { arrayValue: { values: [{ stringValue: 'scan_complete' }] } },
          },
        },
      }];

      const res = await handler.fetch(webhookDispatchRequest(ADMIN_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.dispatchedCount).toBe(1);
      expect(webhookDeliveryCalls).toBe(1);
      expect(banStoreCalls()).toBe(0);
    });
  });

  describe('fail-closed dispatch rate limits', () => {
    it('account hourly limit exceeded -> 429 with Retry-After before hook query and delivery', async () => {
      enableHook('https://hooks.example.test/siem');
      await fillDispatchWindow(`webhook:acct:${USER_UID}`, `acct:${USER_UID}`, 20);

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('3600');
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error).toContain('Account');
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
    });

    it('project hourly limit exceeded -> 429 with Retry-After before hook query and delivery', async () => {
      enableHook('https://hooks.example.test/siem');
      await fillDispatchWindow('webhook:project:test-project', 'project:test-project', 300);

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('3600');
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.error).toContain('Project');
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
    });

    it('per-hook delivery limit exceeded -> 429 before any outbound delivery', async () => {
      enableHook('https://hooks.example.test/siem');
      await fillDispatchWindow('webhook:hook:hook-1', 'hook:hook-1', 10);

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('3600');
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(body.skippedHooks[0].reason).toBe('HOOK_RATE_LIMITED');
      expect(webhookDeliveryCalls).toBe(0);
    });

    it('missing QUOTA_COUNTER binding -> 503 fail-closed before hook query and delivery', async () => {
      enableHook('https://hooks.example.test/siem');
      const degradedEnv: Env = { ...env, QUOTA_COUNTER: undefined };

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), degradedEnv);
      const body = await res.json() as any;

      expect(res.status).toBe(503);
      expect(res.headers.get('Retry-After')).toBe('30');
      expect(body.code).toBe('RATE_LIMITER_UNAVAILABLE');
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
    });

    it('failing limiter store -> 503 fail-closed before hook query and delivery', async () => {
      enableHook('https://hooks.example.test/siem');
      const brokenNamespace = {
        idFromName: () => { throw new Error('limiter store down'); },
        get: () => { throw new Error('limiter store down'); },
      } as unknown as DurableObjectNamespace;
      const degradedEnv: Env = { ...env, QUOTA_COUNTER: brokenNamespace };

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), degradedEnv);
      const body = await res.json() as any;

      expect(res.status).toBe(503);
      expect(body.code).toBe('RATE_LIMITER_UNAVAILABLE');
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
    });
  });

  describe('delivery safety', () => {
    it('a 3xx answer is a failed delivery and is never followed', async () => {
      enableHook('https://hooks.example.test/siem');
      webhookDeliveryStatus = 302;

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.dispatchedCount).toBe(1);
      expect(webhookDeliveryCalls).toBe(1);
      expect(body.results[0].status).toBe(302);
      expect(body.results[0].ok).toBe(false);
      expect(body.results[0].error).toContain('Redirect not followed');
      // Exactly one delivery call: the Location target was never fetched.
      expect(calls.filter(c => c.url.startsWith('https://hooks.example.test'))).toHaveLength(1);
      expect(deliveryInit().redirect).toBe('manual');
    });

    it('an empty webhook secret causes no delivery and no signature', async () => {
      enableHook('https://hooks.example.test/siem', '');

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.dispatchedCount).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
      expect(body.results[0].ok).toBe(false);
      expect(body.results[0].error).toContain('signing failed');
      expect(JSON.stringify(body.results[0])).not.toContain('sha256=');
    });

    it('a failing HMAC backend causes no delivery and no empty signature', async () => {
      enableHook('https://hooks.example.test/siem');
      vi.stubGlobal('crypto', {
        subtle: {
          importKey: async () => { throw new Error('HMAC backend unavailable'); },
          sign: async () => { throw new Error('HMAC backend unavailable'); },
        },
      } as unknown as Crypto);

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), env);
      const body = await res.json() as any;

      expect(res.status).toBe(200);
      expect(body.dispatchedCount).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
      expect(body.results[0].ok).toBe(false);
      expect(body.results[0].error).toContain('signing failed');
    });

    it('a policy-unconfigured deployment fails closed with 503 and no delivery', async () => {
      enableHook('https://hooks.example.test/siem');
      const unconfiguredEnv: Env = { ...env, WEBHOOK_ALLOWED_HOSTS: undefined };

      const res = await handler.fetch(webhookDispatchRequest(USER_TOKEN), unconfiguredEnv);
      const body = await res.json() as any;

      expect(res.status).toBe(503);
      expect(body.code).toBe('WEBHOOK_POLICY_UNCONFIGURED');
      expect(runQueryCalls()).toBe(0);
      expect(webhookDeliveryCalls).toBe(0);
    });
  });
});

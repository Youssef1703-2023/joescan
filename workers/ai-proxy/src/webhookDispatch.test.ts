import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// S03 acceptance tests for POST /webhook-dispatch. Firebase JWT verification is
// stubbed at the crypto boundary exactly like in index.test.ts; every other
// dependency (Firestore REST, delivery fetch, rate-limiter Durable Object) is
// served by offline in-memory mocks. No real services are contacted.
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
const ALLOWED_HOOK_HOST = 'https://hooks.example.test';

const USER_TOKEN = 'tok-user';
const ADMIN_TOKEN = 'tok-admin';
const USER_UID = 'uid-1';

// ─── Offline Durable Object namespace backed by the real QuotaCounter ───
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

type UserTierDocMode = 'absent' | 'enterprise' | 'expired' | 'noExpiry' | 'network-error';

let calls: RecordedCall[];
let userTierDocMode: UserTierDocMode;
let webhookQueryDocs: any[];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function userDocResponse(): Response {
  const name = `${FIRESTORE_BASE}/users/${USER_UID}`;
  switch (userTierDocMode) {
    case 'absent':
      return jsonResponse({ error: { code: 404, message: 'No document found', status: 'NOT_FOUND' } }, 404);
    case 'enterprise':
      return jsonResponse({
        name,
        fields: {
          tier: { stringValue: 'enterprise' },
          subscriptionExpiry: { timestampValue: new Date(Date.now() + 30 * 86400 * 1000).toISOString() },
        },
      });
    case 'expired':
      return jsonResponse({
        name,
        fields: {
          tier: { stringValue: 'enterprise' },
          subscriptionExpiry: { timestampValue: new Date(Date.now() - 86400 * 1000).toISOString() },
        },
      });
    case 'noExpiry':
      return jsonResponse({ name, fields: { tier: { stringValue: 'enterprise' } } });
    case 'network-error':
      throw new Error('simulated tier store outage');
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
      return jsonResponse({ error: { code: 404, message: 'No document found', status: 'NOT_FOUND' } }, 404);
    }
    if (url.includes(':runQuery')) {
      return jsonResponse(webhookQueryDocs);
    }
    if (url.includes('/documents/users/')) {
      return userDocResponse();
    }
    // Any other URL is an outbound delivery attempt. Accept it so that the
    // recorded call list can assert exactly which destinations were contacted.
    return jsonResponse({ received: true });
  });
  vi.stubGlobal('fetch', mockFetch);
}

function dispatchRequest(token: string, body: unknown, extraHeaders: Record<string, string> = {}): Request {
  return new Request('https://proxy.joescan.test/webhook-dispatch', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

const STANDARD_BODY = { eventType: 'scan_complete', scanId: 'scan-1', target: 'example.test', riskLevel: 'Low' };

function hookDoc(id: string, url: string, extraFields: Record<string, unknown> = {}) {
  return {
    document: {
      name: `${FIRESTORE_BASE}/webhooks/${id}`,
      fields: {
        ownerId: { stringValue: USER_UID },
        url: { stringValue: url },
        secret: { stringValue: 'hook-secret' },
        name: { stringValue: 'SIEM' },
        active: { booleanValue: true },
        events: { arrayValue: { values: [{ stringValue: 'scan_complete' }] } },
        ...extraFields,
      },
    },
  };
}

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    PROJECT_ID: 'test-project',
    FIRESTORE_DATABASE_ID: 'test-db',
    WEBHOOK_ALLOWED_HOSTS: 'hooks.example.test, *.siem.example.net',
    QUOTA_COUNTER: makeQuotaNamespace(),
    ...overrides,
  };
}

const runQueryCalls = () => calls.filter(c => c.url.includes(':runQuery')).length;
const tierStoreCalls = () => calls.filter(c => c.url.includes('/documents/users/')).length;
// Delivery-ish fetches: anything that is not the Firestore REST API or the
// Google cert store. Rejected destinations must never appear here.
const externalFetches = () =>
  calls.filter(c => !c.url.includes('firestore.googleapis.com') && !c.url.includes(CERTS_URL_FRAGMENT));
const deliveriesTo = (prefix: string) => externalFetches().filter(c => c.url.startsWith(prefix)).length;

beforeEach(() => {
  calls = [];
  userTierDocMode = 'enterprise';
  webhookQueryDocs = [];
  installFetchMock();
});

afterEach(() => {
  vi.unstubAllGlobals();
  h.payloads.clear();
});

beforeEach(() => {
  h.payloads.set(USER_TOKEN, { sub: USER_UID, email: 'user@example.test', email_verified: true });
  h.payloads.set(ADMIN_TOKEN, { sub: 'uid-admin', email: 'admin@example.test', admin: true });
});

describe('S03 webhook dispatch: allowed delivery', () => {
  it('delivers a valid event over HTTPS to an allowlisted destination with HMAC headers', async () => {
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`)];

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.dispatchedCount).toBe(1);
    expect(body.results[0].ok).toBe(true);
    expect(body.results[0].status).toBe(200);
    expect(deliveriesTo(ALLOWED_HOOK_HOST)).toBe(1);

    const delivery = externalFetches()[0];
    expect(delivery.init.method).toBe('POST');
    // S03: redirects are never followed (redirect:'manual'); a 3xx answer is
    // reported as a failed delivery by the handler.
    expect(delivery.init.redirect).toBe('manual');
    // 5s delivery timeout is retained via an abort signal.
    expect(delivery.init.signal).toBeInstanceOf(AbortSignal);
    // HMAC signature is present and hex-encoded.
    const sig = delivery.init.headers['X-JoeScan-Signature'];
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(delivery.init.headers['X-JoeScan-Event']).toBe('scan_complete');

    const outbound = JSON.parse(delivery.init.body);
    expect(outbound.event).toBe('scan_complete');
    expect(outbound.scanId).toBe('scan-1');
    expect(outbound.target).toBe('example.test');
    expect(outbound.riskLevel).toBe('Low');
    // The webhook secret and HMAC input must never be serialized outbound.
    expect(delivery.init.body).not.toContain('hook-secret');
  });

  it('wildcard allowlist entries match subdomains but not the apex domain', async () => {
    webhookQueryDocs = [
      hookDoc('hook-sub', 'https://north.siem.example.net/ingest'),
      hookDoc('hook-apex', 'https://siem.example.net/ingest'),
    ];

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.dispatchedCount).toBe(1);
    expect(deliveriesTo('https://north.siem.example.net')).toBe(1);
    expect(deliveriesTo('https://siem.example.net')).toBe(0);
    const skipped = body.skippedHooks.find((s: any) => s.id === 'hook-apex');
    expect(skipped.reason).toBe('HOST_NOT_ALLOWED');
  });

  it('webhookId selects only the matching hook', async () => {
    webhookQueryDocs = [
      hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/one`),
      hookDoc('hook-2', `${ALLOWED_HOOK_HOST}/two`),
    ];

    const res = await handler.fetch(
      dispatchRequest(USER_TOKEN, { ...STANDARD_BODY, webhookId: 'hook-1' }),
      makeEnv()
    );
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.dispatchedCount).toBe(1);
    expect(deliveriesTo(`${ALLOWED_HOOK_HOST}/one`)).toBe(1);
    expect(deliveriesTo(`${ALLOWED_HOOK_HOST}/two`)).toBe(0);
  });

  it('admin tokens dispatch without a subscription lookup', async () => {
    userTierDocMode = 'absent';
    // The hook must be owned by the admin account's uid to pass ownership.
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`, { ownerId: { stringValue: 'uid-admin' } })];

    const res = await handler.fetch(dispatchRequest(ADMIN_TOKEN, STANDARD_BODY), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.dispatchedCount).toBe(1);
    expect(tierStoreCalls()).toBe(0);
  });
});

describe('S03 webhook dispatch: destination policy', () => {
  it.each([
    ['plaintext HTTP', 'http://hooks.example.test/siem', 'HTTPS_REQUIRED'],
    ['malformed URL', 'not-a-valid-url', 'INVALID_URL'],
    ['empty URL', '', 'INVALID_URL'],
    ['credentialed URL', 'https://user:pass@hooks.example.test/siem', 'URL_CREDENTIALS_REJECTED'],
    ['non-allowlisted host', 'https://evil.example.net/collect', 'HOST_NOT_ALLOWED'],
    ['disallowed port', 'https://hooks.example.test:8443/siem', 'PORT_NOT_ALLOWED'],
    ['plaintext FTP scheme', 'ftp://hooks.example.test/siem', 'HTTPS_REQUIRED'],
    ['loopback IP literal', 'https://127.0.0.1/siem', 'HOST_NOT_ALLOWED'],
    ['private IP literal', 'https://192.168.1.10/siem', 'HOST_NOT_ALLOWED'],
    ['link-local metadata IP', 'https://169.254.169.254/latest', 'HOST_NOT_ALLOWED'],
    ['IPv6 loopback literal', 'https://[::1]/siem', 'HOST_NOT_ALLOWED'],
    ['localhost hostname', 'https://localhost/siem', 'HOST_NOT_ALLOWED'],
  ])('rejects %s without any outbound fetch', async (_label, url, expectedReason) => {
    webhookQueryDocs = [hookDoc('hook-bad', url)];

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.dispatchedCount).toBe(0);
    expect(body.skippedHooks).toHaveLength(1);
    expect(body.skippedHooks[0].id).toBe('hook-bad');
    expect(body.skippedHooks[0].reason).toBe(expectedReason);
    expect(externalFetches()).toHaveLength(0);
  });

  it('fails closed with 503 when the destination policy is not configured', async () => {
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`)];

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), makeEnv({ WEBHOOK_ALLOWED_HOSTS: undefined }));
    const body = await res.json() as any;

    expect(res.status).toBe(503);
    expect(body.code).toBe('WEBHOOK_POLICY_UNCONFIGURED');
    // Fail closed before any store access or delivery.
    expect(tierStoreCalls()).toBe(0);
    expect(runQueryCalls()).toBe(0);
    expect(externalFetches()).toHaveLength(0);
  });
});

describe('S03 webhook dispatch: oversized payload rejection', () => {
  it('rejects a body over the 16 KB cap with 413 before the Firestore lookup', async () => {
    const oversized = { ...STANDARD_BODY, data: { blob: 'x'.repeat(17 * 1024) } };

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, oversized), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(413);
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(runQueryCalls()).toBe(0);
    expect(externalFetches()).toHaveLength(0);
  });

  it('rejects a validated body whose serialized outbound event exceeds the 8 KB cap', async () => {
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`)];
    // Body stays under the 16 KB inbound cap, but the outbound payload is capped at 8 KB.
    const chunky = { ...STANDARD_BODY, data: { blob: 'y'.repeat(9 * 1024) } };

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, chunky), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(413);
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(externalFetches()).toHaveLength(0);
  });
});

describe('S03 webhook dispatch: subscription enforcement at dispatch time', () => {
  it('rejects a free-tier (non-enterprise) account with 403 before the hook lookup', async () => {
    userTierDocMode = 'absent';

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(403);
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
    expect(runQueryCalls()).toBe(0);
    expect(externalFetches()).toHaveLength(0);
  });

  it('rejects an expired enterprise subscription with 403', async () => {
    userTierDocMode = 'expired';

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(403);
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
    expect(externalFetches()).toHaveLength(0);
  });

  it('rejects a paid tier with no subscription expiry with 403', async () => {
    userTierDocMode = 'noExpiry';

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(403);
    expect(body.code).toBe('SUBSCRIPTION_REQUIRED');
    expect(externalFetches()).toHaveLength(0);
  });

  it('fails closed with 503 when the tier store is unreachable', async () => {
    userTierDocMode = 'network-error';

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(503);
    expect(body.code).toBe('TIER_STORE_UNAVAILABLE');
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(runQueryCalls()).toBe(0);
    expect(externalFetches()).toHaveLength(0);
  });
});

describe('S03 webhook dispatch: durable, fail-closed rate limits', () => {
  it('project-level limit returns 429 with Retry-After before any hook lookup or delivery', async () => {
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`)];
    const env = makeEnv({ WEBHOOK_PROJECT_HOURLY_LIMIT: '1' });

    const first = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), env);
    expect(first.status).toBe(200);
    expect(deliveriesTo(ALLOWED_HOOK_HOST)).toBe(1);

    const runQueryBefore = runQueryCalls();
    const second = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), env);
    const secondBody = await second.json() as any;

    expect(second.status).toBe(429);
    expect(secondBody.code).toBe('RATE_LIMIT_EXCEEDED');
    const retryAfter = Number(second.headers.get('Retry-After'));
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(3600);
    expect(secondBody.retryAfter).toBe(retryAfter);
    // No additional webhook lookups or outbound work after the limit was hit.
    // (The global S02 ban gate still performs its own bannedUsers lookup per
    // request, so total call count is not zero — only store/delivery work is.)
    const runQueryAfter = runQueryCalls();
    expect(runQueryAfter - runQueryBefore).toBe(0);
    expect(deliveriesTo(ALLOWED_HOOK_HOST)).toBe(1);
  });

  it('per-account limit returns 429 with Retry-After before delivery', async () => {
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`)];
    const env = makeEnv({ WEBHOOK_ACCOUNT_HOURLY_LIMIT: '1' });

    const first = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), env);
    expect(first.status).toBe(200);

    const second = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), env);
    const secondBody = await second.json() as any;

    expect(second.status).toBe(429);
    expect(secondBody.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(second.headers.get('Retry-After')).toBeTruthy();
    expect(deliveriesTo(ALLOWED_HOOK_HOST)).toBe(1);
  });

  it('per-hook delivery limit returns 429 before any outbound fetch when all hooks are withheld', async () => {
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`)];
    const env = makeEnv({ WEBHOOK_HOOK_HOURLY_LIMIT: '1' });

    const first = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), env);
    expect(first.status).toBe(200);
    expect(deliveriesTo(ALLOWED_HOOK_HOST)).toBe(1);

    const second = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), env);
    const secondBody = await second.json() as any;

    expect(second.status).toBe(429);
    expect(secondBody.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(secondBody.skippedHooks[0].reason).toBe('HOOK_RATE_LIMITED');
    expect(second.headers.get('Retry-After')).toBeTruthy();
    expect(deliveriesTo(ALLOWED_HOOK_HOST)).toBe(1);
  });

  it('rate-limited hooks are skipped individually while other hooks still deliver', async () => {
    webhookQueryDocs = [
      hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/one`),
      hookDoc('hook-2', `${ALLOWED_HOOK_HOST}/two`),
    ];
    const env = makeEnv({ WEBHOOK_HOOK_HOURLY_LIMIT: '1' });

    // Consume hook-1's hourly delivery allowance.
    const first = await handler.fetch(
      dispatchRequest(USER_TOKEN, { ...STANDARD_BODY, webhookId: 'hook-1' }),
      env
    );
    expect(first.status).toBe(200);

    // Second dispatch matches both hooks: hook-1 is withheld, hook-2 delivers.
    const second = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), env);
    const secondBody = await second.json() as any;

    expect(second.status).toBe(200);
    expect(secondBody.dispatchedCount).toBe(1);
    expect(secondBody.skippedHooks).toHaveLength(1);
    expect(secondBody.skippedHooks[0].id).toBe('hook-1');
    expect(secondBody.skippedHooks[0].reason).toBe('HOOK_RATE_LIMITED');
    expect(secondBody.skippedHooks[0].retryAfter).toBeGreaterThan(0);
    expect(deliveriesTo(`${ALLOWED_HOOK_HOST}/one`)).toBe(1);
    expect(deliveriesTo(`${ALLOWED_HOOK_HOST}/two`)).toBe(1);
  });

  it('fails closed with 503 and no delivery when the limiter store is unavailable', async () => {
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`)];

    const res = await handler.fetch(
      dispatchRequest(USER_TOKEN, STANDARD_BODY),
      makeEnv({ QUOTA_COUNTER: undefined })
    );
    const body = await res.json() as any;

    expect(res.status).toBe(503);
    expect(body.code).toBe('RATE_LIMITER_UNAVAILABLE');
    expect(res.headers.get('Retry-After')).toBe('30');
    expect(runQueryCalls()).toBe(0);
    expect(externalFetches()).toHaveLength(0);
  });
});

describe('S03 webhook dispatch: HMAC signing never bypassed', () => {
  it('refuses delivery when the hook has no secret instead of sending an empty signature', async () => {
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`, { secret: { stringValue: '' } })];

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.dispatchedCount).toBe(0);
    expect(body.results[0].ok).toBe(false);
    expect(body.results[0].error).toContain('signing failed');
    expect(externalFetches()).toHaveLength(0);
  });

  it('refuses delivery when HMAC computation throws', async () => {
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`)];
    const env = makeEnv();
    const signingFailure = vi.spyOn((globalThis as any).crypto.subtle, 'importKey').mockRejectedValueOnce(new Error('subtle unavailable'));

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), env);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.dispatchedCount).toBe(0);
    expect(body.results[0].ok).toBe(false);
    expect(body.results[0].error).toContain('signing failed');
    expect(externalFetches()).toHaveLength(0);
    signingFailure.mockRestore();
  });
});

describe('S03 webhook dispatch: hostile request validation', () => {
  it.each([
    ['non-string eventType', { ...STANDARD_BODY, eventType: 123 }],
    ['eventType with illegal characters', { ...STANDARD_BODY, eventType: 'bad event!!' }],
    ['oversized eventType', { ...STANDARD_BODY, eventType: 'a'.repeat(65) }],
    ['non-string webhookId', { ...STANDARD_BODY, webhookId: 42 }],
    ['webhookId with path traversal', { ...STANDARD_BODY, webhookId: '../../etc' }],
    ['oversized webhookId', { ...STANDARD_BODY, webhookId: 'a'.repeat(129) }],
    ['non-string target', { ...STANDARD_BODY, target: { nested: true } }],
    ['target with control characters', { ...STANDARD_BODY, target: 'bad\u0000target' }],
    ['non-string riskLevel', { ...STANDARD_BODY, riskLevel: ['High'] }],
    ['array data', { ...STANDARD_BODY, data: ['not', 'an', 'object'] }],
    ['string data', { ...STANDARD_BODY, data: 'not-an-object' }],
  ])('returns 400 for %s without any store access or delivery', async (_label, body) => {
    webhookQueryDocs = [hookDoc('hook-1', `${ALLOWED_HOOK_HOST}/siem`)];

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, body), makeEnv());

    expect(res.status).toBe(400);
    expect(runQueryCalls()).toBe(0);
    expect(externalFetches()).toHaveLength(0);
  });

  it('returns 400 for a non-object JSON body (e.g. null) without delivery', async () => {
    const req = new Request('https://proxy.joescan.test/webhook-dispatch', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${USER_TOKEN}`, 'Content-Type': 'application/json' },
      body: 'null',
    });

    const res = await handler.fetch(req, makeEnv());

    expect(res.status).toBe(400);
    expect(runQueryCalls()).toBe(0);
    expect(externalFetches()).toHaveLength(0);
  });

  it('skips inactive hooks and hooks whose Firestore fields have hostile types', async () => {
    webhookQueryDocs = [
      hookDoc('hook-off', `${ALLOWED_HOOK_HOST}/off`, { active: { booleanValue: false } }),
      hookDoc('hook-bad-owner', `${ALLOWED_HOOK_HOST}/bad-owner`, { ownerId: { stringValue: 'someone-else' } }),
      hookDoc('hook-url-type', `${ALLOWED_HOOK_HOST}/url-type`, { url: { integerValue: 7 } }),
      hookDoc('hook-ok', `${ALLOWED_HOOK_HOST}/ok`),
    ];

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), makeEnv());
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.dispatchedCount).toBe(1);
    expect(deliveriesTo(`${ALLOWED_HOOK_HOST}/ok`)).toBe(1);
    expect(externalFetches()).toHaveLength(1);
  });

  it('returns 502 without leaking internal error details when the hook query fails', async () => {
    const env = makeEnv();
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : String(input.url);
      calls.push({ url, init });
      if (url.includes(CERTS_URL_FRAGMENT)) {
        return jsonResponse({ 'test-kid': 'cert' });
      }
      if (url.includes('/documents/bannedUsers/')) {
        return jsonResponse({ error: { code: 404, message: 'No document found', status: 'NOT_FOUND' } }, 404);
      }
      if (url.includes('/documents/users/')) {
        return userDocResponse();
      }
      if (url.includes(':runQuery')) {
        return new Response('upstream exploded: internal-project-details', { status: 500 });
      }
      return jsonResponse({ received: true });
    }));

    const res = await handler.fetch(dispatchRequest(USER_TOKEN, STANDARD_BODY), env);
    const body = await res.json() as any;

    expect(res.status).toBe(502);
    expect(body.error).toBe('Failed to fetch webhook configurations');
    expect(JSON.stringify(body)).not.toContain('internal-project-details');
    expect(externalFetches()).toHaveLength(0);
    globalThis.fetch = originalFetch;
  });
});

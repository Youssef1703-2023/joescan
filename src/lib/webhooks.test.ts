import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  fetch: vi.fn(),
  getIdToken: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'scans'),
  addDoc: mocks.addDoc,
  doc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn((n: number) => n),
}));

vi.mock('./firebase', () => ({
  auth: { currentUser: { uid: 'user-1', getIdToken: mocks.getIdToken } },
  db: {},
}));

import { saveScan } from './webhooks';
import { PASSWORD_SCAN_TARGET } from './scanLabels';

const FAKE_PASSWORD = 'Qz7!Falcon$Moth92';
const FAKE_PASSWORD_PREFIX = FAKE_PASSWORD.substring(0, 3);

describe('saveScan (S01 password-fragment guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_AI_PROXY_URL', 'https://proxy.example.test');
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.addDoc.mockResolvedValue({ id: 'scan-abc' });
    mocks.getIdToken.mockResolvedValue('id-token');
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, event: 'scan_complete', dispatchedCount: 0, results: [] }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('persists and dispatches the constant target for password scans, even when a caller supplies a sensitive target', async () => {
    const docRef = await saveScan({
      userId: 'user-1',
      target: FAKE_PASSWORD_PREFIX + '...',
      type: 'password',
      riskLevel: 'High',
      securityScore: 10,
      reportText: 'ok',
    });

    expect(docRef.id).toBe('scan-abc');

    const persisted = mocks.addDoc.mock.calls[0][1];
    expect(persisted.type).toBe('password');
    expect(persisted.target).toBe(PASSWORD_SCAN_TARGET);
    const persistedJson = JSON.stringify(persisted);
    expect(persistedJson).not.toContain(FAKE_PASSWORD);
    expect(persistedJson).not.toContain(FAKE_PASSWORD_PREFIX);

    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toBe('https://proxy.example.test/webhook-dispatch');
    const body = JSON.parse(init.body);
    expect(body.target).toBe(PASSWORD_SCAN_TARGET);
    expect(body.scanId).toBe('scan-abc');
    expect(body.eventType).toBe('threat_detected');
    expect(body.data.type).toBe('password');
    expect(init.body).not.toContain(FAKE_PASSWORD);
    expect(init.body).not.toContain(FAKE_PASSWORD_PREFIX);
  });

  it('preserves the caller-supplied target and behavior for non-password scans', async () => {
    const docRef = await saveScan({
      userId: 'user-1',
      target: 'victim@example.com',
      type: 'email',
      riskLevel: 'Low',
    });

    expect(docRef.id).toBe('scan-abc');

    const persisted = mocks.addDoc.mock.calls[0][1];
    expect(persisted.target).toBe('victim@example.com');
    expect(persisted.type).toBe('email');

    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    const [url, init] = mocks.fetch.mock.calls[0];
    expect(url).toBe('https://proxy.example.test/webhook-dispatch');
    const body = JSON.parse(init.body);
    expect(body.target).toBe('victim@example.com');
    expect(body.eventType).toBe('scan_complete');
    expect(body.data.type).toBe('email');
  });
});

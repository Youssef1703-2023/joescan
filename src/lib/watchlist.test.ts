import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  canonicalizeValue,
  computeNextDueTime,
  deriveDeterministicFindingId,
  WatchlistMonitor,
  WATCHLIST_TIER_LIMITS,
} from '../../workers/ai-proxy/src/watchlist';
import {
  fetchWatchlistState,
  syncWatchlist,
  sweepWatchlistNow,
  getLocalRevision,
  getNextRevision,
} from './watchlist';

describe('Watchlist Canonicalization and Validation', () => {
  it('validates and canonicalizes IPv4 addresses', () => {
    expect(canonicalizeValue('ip', ' 192.168.1.1 ')).toEqual({ ok: true, value: '192.168.1.1' });
    expect(canonicalizeValue('ip', '10.0.0.255')).toEqual({ ok: true, value: '10.0.0.255' });
    expect(canonicalizeValue('ip', '999.1.1.1').ok).toBe(false);
    expect(canonicalizeValue('ip', 'not-an-ip').ok).toBe(false);
  });

  it('validates and canonicalizes domain names', () => {
    expect(canonicalizeValue('domain', ' HTTPS://Example.COM/ ')).toEqual({ ok: true, value: 'example.com' });
    expect(canonicalizeValue('domain', 'sub.domain.co.uk.')).toEqual({ ok: true, value: 'sub.domain.co.uk' });
    expect(canonicalizeValue('domain', 'http://api.joescan.me:8080/path')).toEqual({ ok: true, value: 'api.joescan.me' });
    expect(canonicalizeValue('domain', 'invalid domain with spaces').ok).toBe(false);
  });

  it('validates email and phone formats', () => {
    expect(canonicalizeValue('email', ' User@Example.COM ')).toEqual({ ok: true, value: 'user@example.com' });
    expect(canonicalizeValue('email', 'invalid-email').ok).toBe(false);

    expect(canonicalizeValue('phone', ' +1 (555) 123-4567 ')).toEqual({ ok: true, value: '+15551234567' });
    expect(canonicalizeValue('phone', '12').ok).toBe(false);
  });

  it('enforces string length ceiling', () => {
    const longString = 'a'.repeat(300);
    expect(canonicalizeValue('domain', longString).ok).toBe(false);
  });
});

describe('Deterministic Finding IDs', () => {
  it('generates consistent, deterministic ids', () => {
    const id1 = deriveDeterministicFindingId('tgt_1', 'port_opened', '80');
    const id2 = deriveDeterministicFindingId('tgt_1', 'port_opened', '80');
    const id3 = deriveDeterministicFindingId('tgt_1', 'port_opened', '443');

    expect(id1).toBe('tgt_1:port_opened:80');
    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
  });
});

describe('WatchlistMonitor Durable Object Core Logic', () => {
  let mockStorage: Map<string, any>;
  let mockState: any;
  let monitor: WatchlistMonitor;

  beforeEach(() => {
    mockStorage = new Map();
    mockState = {
      storage: {
        get: vi.fn(async (key: string) => mockStorage.get(key)),
        put: vi.fn(async (key: string, val: any) => mockStorage.set(key, val)),
        deleteAlarm: vi.fn(async () => {}),
        setAlarm: vi.fn(async () => {}),
      },
    };
    monitor = new WatchlistMonitor(mockState, {});
  });

  it('enforces tier limits on sync', async () => {
    const targets = [
      { id: '1', type: 'ip' as const, value: '1.1.1.1' },
      { id: '2', type: 'ip' as const, value: '8.8.8.8' },
    ];

    const freeRes = await monitor.sync(targets, 1, 'free');
    expect(freeRes.ok).toBe(false);
    expect(freeRes.error).toBe('TARGET_LIMIT_EXCEEDED');

    const proRes = await monitor.sync(targets, 1, 'pro');
    expect(proRes.ok).toBe(true);
    expect(proRes.targetCount).toBe(2);
  });

  it('rejects stale revisions', async () => {
    const targets = [{ id: '1', type: 'ip' as const, value: '1.1.1.1' }];

    const first = await monitor.sync(targets, 2, 'free');
    expect(first.ok).toBe(true);

    const stale = await monitor.sync(targets, 2, 'free');
    expect(stale.ok).toBe(false);
    expect(stale.error).toBe('STALE_REVISION');

    const higher = await monitor.sync(targets, 3, 'free');
    expect(higher.ok).toBe(true);
  });

  it('rejects duplicate targets in sync payload', async () => {
    const targets = [
      { id: '1', type: 'ip' as const, value: '1.1.1.1' },
      { id: '2', type: 'ip' as const, value: '1.1.1.1' },
    ];

    const res = await monitor.sync(targets, 1, 'pro');
    expect(res.ok).toBe(false);
    expect(res.error).toBe('DUPLICATE_TARGET');
  });

  it('arms alarm for schedulable targets and goes dormant when none exist', async () => {
    const ipTarget = [{ id: '1', type: 'ip' as const, value: '1.1.1.1' }];
    await monitor.sync(ipTarget, 1, 'free');
    expect(mockState.storage.setAlarm).toHaveBeenCalled();

    const emailOnly = [{ id: '2', type: 'email' as const, value: 'test@example.com' }];
    await monitor.sync(emailOnly, 2, 'free');
    expect(mockState.storage.deleteAlarm).toHaveBeenCalled();
  });
});

describe('Watchlist Client API Helper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('manages local monotonic revisions', () => {
    expect(getLocalRevision()).toBe(1);
    expect(getNextRevision()).toBe(2);
    expect(getNextRevision()).toBe(3);
  });
});

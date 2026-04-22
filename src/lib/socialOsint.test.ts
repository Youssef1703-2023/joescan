import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('socialOsint', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns categorized hit results from the API flow', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ platforms: [{ name: 'AcmeHub', category: 'Social Media' }] }))
      .mockResolvedValueOnce(jsonResponse({ queryId: 'query-1', totalPlatforms: 2 }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'completed',
        results: [
          { platform: 'AcmeHub', url: 'https://acme.example/john_doe', status: 'hit', responseTime: 123 },
          { platform: 'GhostTown', url: 'https://ghost.example/john_doe', status: 'miss', responseTime: 100 },
        ],
      }));

    vi.stubGlobal('fetch', fetchMock);

    const { searchUsername } = await import('./socialOsint');
    const promise = searchUsername('john_doe');

    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      username: 'john_doe',
      totalPlatforms: 2,
      status: 'completed',
      hits: [
        {
          platform: 'AcmeHub',
          url: 'https://acme.example/john_doe',
          status: 'hit',
          responseTime: 123,
          category: 'social',
        },
      ],
    });
  });

  it('rejects invalid usernames before calling the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { searchUsername } = await import('./socialOsint');

    await expect(searchUsername('bad user name')).rejects.toThrow('INVALID_USERNAME');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces rate-limit failures from the provider', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ platforms: [] }))
      .mockResolvedValueOnce(jsonResponse({ error: 'slow down' }, 429));

    vi.stubGlobal('fetch', fetchMock);

    const { searchUsername } = await import('./socialOsint');

    await expect(searchUsername('john_doe')).rejects.toThrow('RATE_LIMIT');
  });
});

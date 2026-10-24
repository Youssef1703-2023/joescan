import { describe, expect, it, vi } from 'vitest';
import {
  URLHAUS_URL_ENDPOINT,
  combineUrlhausResults,
  interpretUrlhausBody,
  presentUrlhaus,
  queryUrlhaus,
  queryUrlhausUrl,
  urlhausAuthKey,
  urlScanVerdict,
  urlSecurityScore,
  urlVerdictCopy,
} from './urlhausCheck';

const matchBody = {
  query_status: 'ok',
  urls: [{ threat: 'malware_download', date_added: '2024-01-02', tags: ['elf'] }],
};

function responded(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

describe('URLhaus result modeling', () => {
  it('accepts a confirmed no_results response as a non-match', async () => {
    const fetchImpl = vi.fn(async () => responded({ query_status: 'no_results' }));
    const result = await queryUrlhaus('example.com', fetchImpl);
    expect(result.state).toBe('no_match');
    const presented = presentUrlhaus(result);
    expect(presented.status).toBe('pass');
    expect(presented.persisted).toBe('NO MATCH');
    expect(presented.detail).toContain('no_results');
    expect(presented.detail).not.toMatch(/not evidence that the host is safe/i);
    expect(urlScanVerdict(0, result.state)).toBe('safe');
  });

  it('keeps a confirmed match as a failure without inventing a threat type', () => {
    const parsed = interpretUrlhausBody(matchBody);
    expect(parsed).toMatchObject({ state: 'match', threat: 'malware_download', dateAdded: '2024-01-02' });
    const presented = presentUrlhaus(parsed);
    expect(presented.status).toBe('fail');
    expect(presented.persisted).toBe('MATCH');
    expect(presented.severity).toBe(30);
    const untyped = presentUrlhaus(interpretUrlhausBody({ query_status: 'ok', urls: [{}] }));
    expect(untyped.status).toBe('fail');
    expect(untyped.detail).toContain('did not include a threat type');
    expect(untyped.detail).not.toContain('malware_download');
  });

  it('treats an HTTP error as unavailable even when the body says no_results', async () => {
    const fetchImpl = vi.fn(async () => responded({ query_status: 'no_results' }, false, 401));
    const result = await queryUrlhaus('example.com', fetchImpl);
    expect(presentUrlhaus(result)).toMatchObject({ status: 'unknown', persisted: 'UNAVAILABLE', severity: 0 });
    expect(presentUrlhaus(result).detail).toMatch(/not evidence that the host is safe/i);
    expect(urlScanVerdict(0, result.state)).toBe('incomplete');
    expect(urlSecurityScore('incomplete', 0)).toBeNull();
    expect(urlVerdictCopy('incomplete').desc).not.toMatch(/no threats detected/i);
  });

  it('treats a thrown network error as unavailable', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const result = await queryUrlhaus('example.com', fetchImpl);
    expect(result.state).toBe('unavailable');
    expect(presentUrlhaus(result).persisted).toBe('UNAVAILABLE');
    expect(urlScanVerdict(0, 'unavailable')).toBe('incomplete');
  });

  it('treats a timeout as unavailable', async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit): Promise<never> => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
      });
    }));
    const result = await queryUrlhaus('example.com', fetchImpl, 15);
    expect(result.state).toBe('unavailable');
  });

  it('treats a malformed payload as unavailable', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(responded({ unexpected: true }))
      .mockResolvedValueOnce(responded(null))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } })
      .mockResolvedValueOnce(responded({ query_status: 'no_results', urls: [{ threat: 'x' }] }));
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await queryUrlhaus('example.com', fetchImpl);
      expect(result.state).toBe('unavailable');
      expect(presentUrlhaus(result).status).not.toBe('pass');
    }
    expect(urlScanVerdict(55, 'unavailable')).toBe('dangerous');
    expect(urlScanVerdict(25, 'unavailable')).toBe('suspicious');
    expect(urlVerdictCopy('safe').desc).toMatch(/no threats detected/i);
  });

  describe('queryUrlhausUrl (/v1/url/) and combined host+url results', () => {
    it('interprets a URL-level top-level match response and triggers match verdict', async () => {
      const fetchImpl = vi.fn(async (endpoint: string, init?: RequestInit) => {
        expect(endpoint).toBe(URLHAUS_URL_ENDPOINT);
        expect(String(init?.body)).toBe('url=https%3A%2F%2Fevil.example.com%2Fpayload.exe');
        return responded({
          query_status: 'ok',
          id: '2910441',
          url_status: 'online',
          threat: 'malware_download',
          date_added: '2025-02-10 12:00:00 UTC',
          tags: ['Mozi', 'mips'],
        });
      });

      const result = await queryUrlhausUrl('https://evil.example.com/payload.exe', fetchImpl);
      expect(result).toEqual({
        state: 'match',
        threat: 'malware_download',
        dateAdded: '2025-02-10 12:00:00 UTC',
        tags: ['Mozi', 'mips'],
      });
      expect(urlScanVerdict(0, result.state)).toBe('suspicious');

      const combined = combineUrlhausResults({ state: 'no_match', tags: [] }, result);
      expect(combined.state).toBe('match');
      expect(combined.threat).toBe('malware_download');
    });

    it('interprets a URL-level no_results response as no_match', async () => {
      const fetchImpl = vi.fn(async () => responded({ query_status: 'no_results' }));
      const result = await queryUrlhausUrl('https://clean.example.com/welcome', fetchImpl);
      expect(result).toEqual({ state: 'no_match', tags: [] });

      const combined = combineUrlhausResults({ state: 'no_match', tags: [] }, result);
      expect(combined.state).toBe('no_match');
    });

    it('returns unavailable on empty URL, HTTP error, timeout, or contradictory payload', async () => {
      expect((await queryUrlhausUrl('   ')).state).toBe('unavailable');

      const httpErrFetch = vi.fn(async () => responded({ query_status: 'no_results' }, false, 502));
      expect((await queryUrlhausUrl('https://example.com/a', httpErrFetch)).state).toBe('unavailable');

      const timeoutFetch = vi.fn((_url: string, init?: RequestInit): Promise<never> => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        });
      }));
      expect((await queryUrlhausUrl('https://example.com/a', timeoutFetch, 10)).state).toBe('unavailable');

      const badBodyFetch = vi.fn(async () => responded({
        query_status: 'no_results',
        url_status: 'online',
        threat: 'malware_download',
      }));
      expect((await queryUrlhausUrl('https://example.com/a', badBodyFetch)).state).toBe('unavailable');

      const combined = combineUrlhausResults({ state: 'no_match', tags: [] }, { state: 'unavailable', tags: [] });
      expect(combined.state).toBe('unavailable');
    });
  });

  describe('Auth-Key header and urlhausAuthKey() resolver', () => {
    it('omits Auth-Key header when no authKey is provided or when it is blank', async () => {
      const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.headers).toEqual({ Accept: 'application/json' });
        expect((init?.headers as Record<string, string>)['Auth-Key']).toBeUndefined();
        return responded({ query_status: 'no_results' });
      });

      await queryUrlhaus('example.com', fetchImpl);
      await queryUrlhaus('example.com', fetchImpl, 15_000, '   ');
      await queryUrlhausUrl('https://example.com/test', fetchImpl);
      await queryUrlhausUrl('https://example.com/test', fetchImpl, 15_000, '');
      expect(fetchImpl).toHaveBeenCalledTimes(4);
    });

    it('sends the Auth-Key header when a non-empty authKey is provided to queryUrlhaus and queryUrlhausUrl', async () => {
      const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
        expect(init?.headers).toEqual({
          Accept: 'application/json',
          'Auth-Key': 'secret-abuse-ch-key',
        });
        return responded({ query_status: 'no_results' });
      });

      const hostRes = await queryUrlhaus('example.com', fetchImpl, 15_000, '  secret-abuse-ch-key  ');
      const urlRes = await queryUrlhausUrl('https://example.com/path', fetchImpl, 15_000, 'secret-abuse-ch-key');
      expect(hostRes.state).toBe('no_match');
      expect(urlRes.state).toBe('no_match');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it('resolves VITE_URLHAUS_AUTH_KEY from import.meta.env and returns empty string when unset', () => {
      try {
        vi.stubEnv('VITE_URLHAUS_AUTH_KEY', '');
        expect(urlhausAuthKey()).toBe('');

        vi.stubEnv('VITE_URLHAUS_AUTH_KEY', '  my-test-key-123  ');
        expect(urlhausAuthKey()).toBe('my-test-key-123');
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});

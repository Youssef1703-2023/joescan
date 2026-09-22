import { describe, expect, it, vi } from 'vitest';
import {
  interpretUrlhausBody,
  presentUrlhaus,
  queryUrlhaus,
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
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UrlAnalyzer from './UrlAnalyzer';

const mocks = vi.hoisted(() => ({
  saveScan: vi.fn(),
}));

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: new Proxy({}, {
    get: () => ({ children, ...props }: { children?: React.ReactNode }) => <div {...props}>{children}</div>,
  }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    lang: 'en',
    t: (key: string) => ({ url_title: 'URL Analyzer', url_placeholder: 'https://example.com' }[key] || key),
  }),
}));

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
}));

vi.mock('../lib/webhooks', () => ({
  saveScan: mocks.saveScan,
}));

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(() => 'timestamp'),
}));

vi.mock('../lib/generatePDF', () => ({
  generateReportPDF: vi.fn(),
}));

vi.mock('./MiniHistory', () => ({ default: () => null }));

function provider(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

function mockFetch(urlhaus: () => unknown) {
  return vi.fn(async (url: string) => {
    if (String(url).includes('urlhaus-api.abuse.ch')) return urlhaus();
    return provider({}, false, 503);
  });
}

async function scan() {
  render(<UrlAnalyzer />);
  fireEvent.change(screen.getByLabelText('Link to check'), { target: { value: 'https://example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /check link/i }));
  await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
  return mocks.saveScan.mock.calls[0][0] as { reportText: string; riskLevel: string; securityScore: number | null };
}

describe('UrlAnalyzer URLhaus outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.saveScan.mockResolvedValue({ id: 'scan-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('records a confirmed no_results response as a non-match', async () => {
    vi.stubGlobal('fetch', mockFetch(() => provider({ query_status: 'no_results' })));
    const saved = await scan();
    expect(saved.reportText).toContain('URLhaus: NO MATCH');
    expect(saved.riskLevel).toBe('Low');
    expect(screen.getByText('No threats detected. This URL appears safe based on our analysis.')).toBeTruthy();
    expect(screen.getByText(/query_status no_results/)).toBeTruthy();
  });

  it('records a confirmed URLhaus match as a failure', async () => {
    vi.stubGlobal('fetch', mockFetch(() => provider({
      query_status: 'ok',
      urls: [{ threat: 'malware_download', date_added: '2024-01-02', tags: ['elf'] }],
    })));
    const saved = await scan();
    expect(saved.reportText).toContain('URLhaus: MATCH');
    expect(saved.reportText).not.toContain('URLhaus: NO MATCH');
    expect(screen.getByText(/MATCH FOUND/)).toBeTruthy();
    expect(screen.queryByText(/No threats detected/)).toBeNull();
  });

  it('does not turn an HTTP 401 into a clean result', async () => {
    vi.stubGlobal('fetch', mockFetch(() => provider({ query_status: 'no_results' }, false, 401)));
    const saved = await scan();
    expect(saved.reportText).toContain('URLhaus: UNAVAILABLE');
    expect(saved.reportText).not.toContain('Clean');
    expect(saved.riskLevel).toBe('Unknown');
    expect(saved.securityScore).toBeNull();
    expect(screen.getByText('INCOMPLETE')).toBeTruthy();
    expect(screen.getByText('UNAVAILABLE')).toBeTruthy();
    expect(screen.queryByText(/No threats detected/)).toBeNull();
    expect(screen.queryByText(/NOT found/)).toBeNull();
  });

  it('does not turn a thrown network error into a clean result', async () => {
    vi.stubGlobal('fetch', mockFetch(() => {
      throw new TypeError('Failed to fetch');
    }));
    const saved = await scan();
    expect(saved.reportText).toContain('URLhaus: UNAVAILABLE');
    expect(saved.riskLevel).toBe('Unknown');
    expect(screen.queryByText(/No threats detected/)).toBeNull();
  });

  it('does not turn a malformed payload into a clean result', async () => {
    vi.stubGlobal('fetch', mockFetch(() => provider({ query_status: 'error' })));
    const saved = await scan();
    expect(saved.reportText).toContain('URLhaus: UNAVAILABLE');
    expect(saved.reportText).not.toContain('URLhaus: NO MATCH');
    expect(screen.getByText(/not evidence that the host is safe/)).toBeTruthy();
    expect(screen.queryByText(/No threats detected/)).toBeNull();
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IpAnalyzer from './IpAnalyzer';

const mocks = vi.hoisted(() => ({
  saveScan: vi.fn(),
  generateReportPDF: vi.fn(),
}));

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: () => ({ children, ...props }: { children?: React.ReactNode }) => (
        <div {...props}>{children}</div>
      ),
    },
  ),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    lang: 'en',
    t: (key: string) =>
      ({
        ip_title: 'IP Analyzer',
        ip_desc: 'Check an IP address.',
        ip_placeholder: 'Enter IP address',
        ip_invalid_format: 'Invalid IP format',
        action_plan: 'Action plan',
        audit: 'Audit',
      })[key] || key,
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
  generateReportPDF: mocks.generateReportPDF,
}));

vi.mock('./MiniHistory', () => ({ default: () => null }));

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const target = String(url);
      if (target.includes('api.ipify.org')) {
        return { ok: true, json: async () => ({ ip: '9.9.9.9' }) };
      }
      if (target.includes('ipapi.co')) {
        return {
          ok: true,
          json: async () => ({
            ip: '8.8.8.8',
            org: 'Test ISP',
            asn: 'AS123',
            country_name: 'Testland',
            city: 'Test City',
            region: 'Test Region',
            latitude: 1,
            longitude: 2,
          }),
        };
      }
      if (target.includes('urlhaus-api.abuse.ch')) {
        return { ok: true, json: async () => ({ query_status: 'no_results' }) };
      }
      return { ok: false, status: 503, json: async () => ({}) };
    }),
  );
}

async function scan(value: string) {
  render(<IpAnalyzer />);
  // Re-query the input fresh: the motion mock returns a new component type
  // on every access, so a node held across a render may be detached.
  fireEvent.change(screen.getByPlaceholderText('Enter IP address'), {
    target: { value },
  });
  fireEvent.click(screen.getByRole('button', { name: /audit/i }));
  await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
}

function deepLink(label: string) {
  return screen.getByText(label).closest('a') as HTMLAnchorElement;
}

describe('IpAnalyzer scanned identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.saveScan.mockResolvedValue({ id: 'scan-1' });
    stubFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the scanned IP in the card, PDF and deep links after the box is edited', async () => {
    // Regression test: the old card read the live `ip` input state, so
    // editing the box after a scan silently repointed the header, the PDF
    // export and all three investigation links at an IP never scanned.
    await scan('8.8.8.8');
    expect(mocks.saveScan).toHaveBeenCalledWith(
      expect.objectContaining({ target: '8.8.8.8' }),
    );

    fireEvent.change(screen.getByPlaceholderText('Enter IP address'), {
      target: { value: '1.1.1.1' },
    });

    expect(screen.getByText('8.8.8.8')).toBeTruthy();
    expect(screen.queryByText('1.1.1.1')).toBeNull();
    expect(deepLink('AbuseIPDB Lookup').getAttribute('href')).toBe(
      'https://www.abuseipdb.com/check/8.8.8.8',
    );
    expect(deepLink('Shodan Scanner').getAttribute('href')).toBe(
      'https://www.shodan.io/host/8.8.8.8',
    );
    expect(deepLink('VirusTotal Scan').getAttribute('href')).toBe(
      'https://www.virustotal.com/gui/ip-address/8.8.8.8',
    );

    fireEvent.click(screen.getByRole('button', { name: /download report/i }));
    await waitFor(() => expect(mocks.generateReportPDF).toHaveBeenCalledTimes(1));
    expect(mocks.generateReportPDF).toHaveBeenCalledWith(
      expect.objectContaining({ target: '8.8.8.8' }),
      'ip',
      'en',
    );
  });

  it('trims padded input in the card and links', async () => {
    await scan('  8.8.8.8  ');
    expect(mocks.saveScan).toHaveBeenCalledWith(
      expect.objectContaining({ target: '8.8.8.8' }),
    );
    expect(screen.getByText('8.8.8.8')).toBeTruthy();
    expect(deepLink('AbuseIPDB Lookup').getAttribute('href')).toBe(
      'https://www.abuseipdb.com/check/8.8.8.8',
    );
  });

  it('keeps a scanned private IP in the card after the box is edited', async () => {
    await scan('192.168.1.1');
    fireEvent.change(screen.getByPlaceholderText('Enter IP address'), {
      target: { value: '10.0.0.9' },
    });
    expect(screen.getByText('192.168.1.1')).toBeTruthy();
    expect(deepLink('AbuseIPDB Lookup').getAttribute('href')).toBe(
      'https://www.abuseipdb.com/check/192.168.1.1',
    );
  });
});

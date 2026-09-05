import React from 'react';
// @ts-ignore - types resolved at test runtime by vitest
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import ScanHistory from './ScanHistory';

const mocks = vi.hoisted(() => ({
  getDocs: vi.fn(),
  createObjectURL: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'scans'),
  query: vi.fn(() => 'history-query'),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: mocks.getDocs,
  deleteDoc: vi.fn(),
  doc: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
}));

vi.mock('./IntelligenceReport', () => ({ default: () => null }));

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: new Proxy({}, {
    get: () => ({ children, ...props }: any) => <div {...props}>{children}</div>,
  }),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    lang: 'en',
    t: (key: string) => ({
      scan_history_title: 'Scan History',
      history_subtitle: 'All your scans',
      action_export: 'Export',
      search_scans: 'Search scans',
      filter_all: 'All',
      filter_risk: 'Risk',
      status_badge_low: 'Low',
      status_badge_medium: 'Medium',
      status_badge_high: 'High',
      nav_email: 'Email',
      nav_password: 'Password',
      nav_phone: 'Phone',
      nav_url: 'URL',
      nav_username: 'Username',
      nav_social: 'Social',
      nav_message: 'Message',
      nav_ip: 'IP',
      no_history_found: 'No history found',
      delete: 'Delete',
    }[key] || key),
  }),
}));

const LEGACY_PASSWORD_TARGET = 'Qz7...';

function firestoreDoc(id: string, data: any) {
  return { id, data: () => data };
}

async function blobToText(blob: Blob): Promise<string> {
  if (typeof (blob as any).text === 'function') {
    return await blob.text();
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('ScanHistory CSV export (S01 leak guard)', () => {
  let capturedBlob: Blob | null = null;

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: mocks.createObjectURL,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    capturedBlob = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mocks.createObjectURL.mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-csv';
    });
    mocks.getDocs.mockResolvedValue({
      docs: [
        firestoreDoc('p1', {
          type: 'password',
          target: LEGACY_PASSWORD_TARGET,
          riskLevel: 'High',
          securityScore: 68,
          createdAt: { toDate: () => new Date('2026-01-02T08:30:00Z') },
        }),
        firestoreDoc('e1', {
          type: 'email',
          target: 'victim@example.com',
          riskLevel: 'Low',
          createdAt: { toDate: () => new Date('2026-01-01T10:00:00Z') },
        }),
      ],
    });
  });

  it('exports the constant label for password scans, including legacy records with a prefixed target', async () => {
    const user = userEvent.setup();
    render(<ScanHistory />);

    expect(await screen.findByText('victim@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /export/i }));

    expect(capturedBlob).toBeInstanceOf(Blob);
    const csv = await blobToText(capturedBlob as Blob);

    expect(csv).toContain('"password","Password check"');
    expect(csv).not.toContain(LEGACY_PASSWORD_TARGET);
    expect(csv).not.toContain('Qz7');
    expect(csv).toContain('"email","victim@example.com"');
    expect(csv).toContain('Type,Target,Risk Level,Score,Date');
  });
});

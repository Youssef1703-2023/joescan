import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmailAnalyzer from './EmailAnalyzer';

const mocks = vi.hoisted(() => ({
  saveScan: vi.fn(),
  fetchCombinedEmailExposure: vi.fn(),
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
        email_invalid_domain: 'This email domain does not exist.',
        email_invalid_format: 'Please enter a valid email address.',
      })[key] || key,
  }),
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({ addNotification: vi.fn() }),
}));

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: { uid: 'user-1', getIdToken: async () => 'token' } },
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { LIST: 'list' },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'scans'),
  serverTimestamp: vi.fn(() => 'timestamp'),
  query: vi.fn(() => 'q'),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((_q: unknown, cb: (snapshot: { docs: unknown[] }) => void) => {
    cb({ docs: [] });
    return () => {};
  }),
  doc: vi.fn(),
  deleteDoc: vi.fn(),
  writeBatch: vi.fn(() => ({ delete: vi.fn(), commit: vi.fn() })),
}));

vi.mock('../lib/webhooks', () => ({
  saveScan: mocks.saveScan,
}));

vi.mock('../lib/combinedEmailExposure', () => ({
  fetchCombinedEmailExposure: mocks.fetchCombinedEmailExposure,
}));

vi.mock('../lib/gemini', () => ({
  analyzeEmailExposure: vi.fn(),
  translateReport: vi.fn(),
}));

vi.mock('../lib/emailExposure', () => ({
  assessEmailBreaches: vi.fn(() => ({})),
  EmailSourceError: class EmailSourceError extends Error {},
}));

vi.mock('../lib/emailEvidence', () => ({
  groupEmailEvidence: vi.fn(() => []),
}));

vi.mock('../lib/appAttestation', () => ({
  appAttestationHeaders: vi.fn(async () => ({})),
}));

vi.mock('./AdditionalEmailSource', () => ({ default: () => null }));

vi.mock('../lib/generatePDF', () => ({
  generateReportPDF: vi.fn(),
}));

function attempts(): unknown[] {
  try {
    return JSON.parse(window.localStorage.getItem('joescan:scan-attempts:v1') || '[]');
  } catch {
    return [];
  }
}

async function submitEmail(email: string) {
  render(<EmailAnalyzer />);
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole('button', { name: /check email/i }));
}

describe('EmailAnalyzer MX validation order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.saveScan.mockResolvedValue({ id: 'scan-1' });
    mocks.fetchCombinedEmailExposure.mockResolvedValue({
      riskLevel: 'Low',
      reportText: 'No breaches found.',
      actionPlan: 'Keep monitoring.',
      securityScore: 90,
      scoreFactors: [],
      scoreImprovement: [],
      breaches: [],
      source: 'test',
      checkedAt: '2026-10-28',
      assessmentVersion: 3,
      evidenceGroups: [],
      sourceStatuses: { xposedornot: 'complete', leakcheck: 'complete' },
      coverageIncomplete: false,
      language: 'en',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does NOT consume a scan attempt for an email whose domain has no MX records', async () => {
    // Regression test: the MX check used to run AFTER consumeScanAttempt(),
    // so a fake-domain email burned one of the 12/minute attempts before
    // showing the invalid-domain error.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(String(url)).toContain('dns.google/resolve');
        return { json: async () => ({ Status: 3 }) };
      }),
    );
    await submitEmail('user@heloo.com');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This email domain does not exist.',
      ),
    );
    expect(attempts()).toHaveLength(0);
    expect(mocks.saveScan).not.toHaveBeenCalled();
  });

  it('falls back to scanning when the MX lookup itself fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await submitEmail('user@example.com');
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
    expect(attempts()).toHaveLength(1);
  });
});

describe('EmailAnalyzer typo suggestion (no silent domain rewrite)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.saveScan.mockResolvedValue({ id: 'scan-1' });
    mocks.fetchCombinedEmailExposure.mockResolvedValue({
      riskLevel: 'Low',
      reportText: 'No breaches found.',
      actionPlan: 'Keep monitoring.',
      securityScore: 90,
      scoreFactors: [],
      scoreImprovement: [],
      breaches: [],
      source: 'test',
      checkedAt: '2026-10-28',
      assessmentVersion: 3,
      evidenceGroups: [],
      sourceStatuses: { xposedornot: 'complete', leakcheck: 'complete' },
      coverageIncomplete: false,
      language: 'en',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a tap-to-adopt suggestion (and consumes nothing) for a typo domain with no MX', async () => {
    // Regression test: the old code silently rewrote gmial.com -> gmail.com
    // on blur and at submit, so the scan attached to a different address
    // than the one typed. Now the typed address is kept, the invalid-domain
    // error is shown, and the correction is only offered as a suggestion.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ Status: 3 }) })),
    );
    await submitEmail('user@gmial.com');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'This email domain does not exist.',
      ),
    );
    expect(
      screen.getByRole('button', { name: /did you mean user@gmail\.com/i }),
    ).toBeTruthy();
    expect(attempts()).toHaveLength(0);
    expect(mocks.saveScan).not.toHaveBeenCalled();
  });

  it('clicking the suggestion fills the corrected address into the input', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ Status: 3 }) })),
    );
    await submitEmail('user@gmial.com');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /did you mean user@gmail\.com/i }),
      ).toBeTruthy(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: /did you mean user@gmail\.com/i }),
    );
    expect(
      (screen.getByPlaceholderText('you@example.com') as HTMLInputElement).value,
    ).toBe('user@gmail.com');
  });

  it('blur does NOT rewrite the domain in the input', async () => {
    render(<EmailAnalyzer />);
    const input = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(input, { target: { value: 'user@gmial.com' } });
    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toBe('user@gmial.com');
  });

  it('scans the TYPED address when the typo domain actually has MX records', async () => {
    // A real domain that merely sits close to a common provider must never
    // be rewritten: the scan runs on exactly what the user typed.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({ Status: 0, Answer: [{ data: '1 mail.gmial.com.' }] }),
      })),
    );
    await submitEmail('user@gmial.com');
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
    expect(mocks.saveScan).toHaveBeenCalledWith(
      expect.objectContaining({ emailScanned: 'user@gmial.com' }),
    );
    expect(
      screen.queryByRole('button', { name: /did you mean/i }),
    ).toBeNull();
  });
});

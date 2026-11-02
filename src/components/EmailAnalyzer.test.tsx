import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EmailAnalyzer from './EmailAnalyzer';

const mocks = vi.hoisted(() => ({
  saveScan: vi.fn(),
  fetchCombinedEmailExposure: vi.fn(),
  addNotification: vi.fn(),
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
        watch_disabled: 'Save for follow-up',
        watch_enabled: 'Saved for follow-up',
        watch_tooltip: 'Keeps this address on a follow-up list stored in this browser.',
      })[key] || key,
  }),
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({ addNotification: mocks.addNotification }),
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

describe('EmailAnalyzer follow-up flag (no fake monitoring)', () => {
  const makeExposure = () => ({
    riskLevel: 'Low' as const,
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

  function savedFlags(): string[] {
    try {
      return JSON.parse(window.localStorage.getItem('joescan:watched-emails:v1') || '[]');
    } catch {
      return [];
    }
  }

  function typeAndSubmit(value: string) {
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value },
    });
    fireEvent.click(screen.getByRole('button', { name: /check email/i }));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mocks.saveScan.mockResolvedValue({ id: 'scan-1' });
    mocks.fetchCombinedEmailExposure.mockResolvedValue(makeExposure());
    // Domain has MX records, so the scan runs and the report card renders.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        json: async () => ({ Status: 0, Answer: [{ data: '1 mail.example.com.' }] }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists the flag locally and never claims active monitoring', async () => {
    await submitEmail('user@example.com');
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
    const button = await screen.findByRole('button', { name: 'Save for follow-up' });

    fireEvent.click(button);

    expect(savedFlags()).toEqual(['user@example.com']);
    expect(screen.getByRole('button', { name: 'Saved for follow-up' })).toBeTruthy();

    expect(mocks.addNotification).toHaveBeenCalledTimes(1);
    const notification = mocks.addNotification.mock.calls[0][0];
    expect(notification.title).toBe('Saved for follow-up');
    expect(notification.type).toBe('info');
    expect(notification.message).toContain('saved in this browser only');
    // The old copy promised a "continuous monitoring queue" and breach alerts;
    // nothing sweeps email targets, so that promise must not come back.
    expect(notification.message).not.toMatch(
      /continuous monitoring queue|alerted of new breaches/i,
    );
  });

  it('restores the flag after a remount and stays silent when toggled off', async () => {
    const first = render(<EmailAnalyzer />);
    typeAndSubmit('user@example.com');
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Save for follow-up' }));
    expect(savedFlags()).toEqual(['user@example.com']);
    first.unmount();

    // Fresh mount: the flag must come back from storage instead of vanishing
    // with the old component state.
    render(<EmailAnalyzer />);
    typeAndSubmit('user@example.com');
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Saved for follow-up' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Saved for follow-up' }));
    expect(savedFlags()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Save for follow-up' })).toBeTruthy();
    // Only the save notified; clearing the local flag adds no toast.
    expect(mocks.addNotification).toHaveBeenCalledTimes(1);
  });

  it('renders the report summary through translation keys', async () => {
    // The card used to hardcode English ("SECURITY SCORE", "ASSESSMENT",
    // "01 / SOURCE EVIDENCE") regardless of language. The test locale is 'en'
    // and the mock `t` echoes unknown keys, so a rendered key proves the
    // component asks for the translation instead of printing English.
    await submitEmail('user@example.com');
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
    await screen.findByRole('button', { name: 'Save for follow-up' });

    expect(screen.getByText('email_report_score_label')).toBeTruthy();
    expect(screen.getByText('email_report_assessment')).toBeTruthy();
    expect(screen.getByText('email_report_section_evidence')).toBeTruthy();
    expect(screen.queryByText('SECURITY SCORE')).toBeNull();
    expect(screen.queryByText('01 / SOURCE EVIDENCE')).toBeNull();
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import UsernameAnalyzer from './UsernameAnalyzer';

const mocks = vi.hoisted(() => ({
  saveScan: vi.fn(),
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
        username_title: 'OSINT Username',
        username_desc: 'Investigate digital footprints.',
        username_placeholder: 'e.g. shadow_hacker_99',
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

vi.mock('./MiniHistory', () => ({ default: () => null }));

function mockHudson(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(body) })),
  );
}

async function scan(username: string) {
  render(<UsernameAnalyzer />);
  fireEvent.change(screen.getByPlaceholderText('e.g. shadow_hacker_99'), {
    target: { value: username },
  });
  fireEvent.click(screen.getByRole('button', { name: /audit/i }));
  await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
  return mocks.saveScan.mock.calls[0][0] as { riskLevel: string; target: string };
}

describe('UsernameAnalyzer saved scan risk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveScan.mockResolvedValue({ id: 'scan-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves High on the FIRST scan when stealers are found (not the previous scan risk)', async () => {
    // Regression test: the old code read just-set React state here, so a
    // first scan with stealers found saved 'Low' (the pre-scan state).
    mockHudson({
      stealers: [{ computer_name: 'PC-1', operating_system: 'Windows' }],
      total_results: 1,
    });
    const saved = await scan('shadow_hacker_99');
    expect(saved.target).toBe('shadow_hacker_99');
    expect(saved.riskLevel).toBe('High');
  });

  it('saves Low for a clean result', async () => {
    mockHudson({ stealers: [], total_results: 0 });
    const saved = await scan('clean_user');
    expect(saved.riskLevel).toBe('Low');
  });
});

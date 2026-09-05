import React from 'react';
// @ts-ignore - types resolved at test runtime by vitest
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import IntelligenceReport from './IntelligenceReport';

const mocks = vi.hoisted(() => ({
  html2canvas: vi.fn(),
  pdfSave: vi.fn(),
  getUserTier: vi.fn(),
}));

vi.mock('html2canvas', () => ({
  default: mocks.html2canvas,
}));

vi.mock('jspdf', () => ({
  default: class {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    addImage() {}
    save(filename: string) {
      mocks.pdfSave(filename);
    }
  },
}));

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
  getUserTier: mocks.getUserTier,
  SubscriptionTier: 'free',
}));

const LEGACY_PASSWORD_TARGET = 'Qz7...';

const baseScan = {
  id: 'abcdefgh12345678',
  riskLevel: 'High' as const,
  securityScore: 68,
  createdAt: new Date('2026-01-02T08:30:00Z'),
};

describe('IntelligenceReport (S01 dossier masking)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserTier.mockResolvedValue('free');
    mocks.html2canvas.mockResolvedValue({
      width: 100,
      height: 200,
      toDataURL: () => 'data:image/png;base64,AAA',
    });
  });

  it('omits the target hash and shows no password fragment for legacy password scans', async () => {
    render(
      <IntelligenceReport
        scan={{ ...baseScan, type: 'password', target: LEGACY_PASSWORD_TARGET }}
        onClose={() => {}}
      />,
    );

    expect(await screen.findByText('********')).toBeInTheDocument();

    const linkableHash = btoa(LEGACY_PASSWORD_TARGET).substring(0, 20).toUpperCase();
    expect(screen.queryByText(/Target Hash/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Qz7');
    expect(document.body.textContent).not.toContain(linkableHash);
  });

  it('uses a fixed non-secret filename for password scan PDF exports', async () => {
    const user = userEvent.setup();
    render(
      <IntelligenceReport
        scan={{ ...baseScan, type: 'password', target: LEGACY_PASSWORD_TARGET }}
        onClose={() => {}}
      />,
    );

    await screen.findByText('********');
    await user.click(screen.getByRole('button', { name: /export pdf/i }));

    await waitFor(() => expect(mocks.pdfSave).toHaveBeenCalledTimes(1));
    expect(mocks.pdfSave).toHaveBeenCalledWith('joescan_dossier_password_check.pdf');
    expect(mocks.pdfSave.mock.calls[0][0]).not.toMatch(/qz7/i);
  });

  it('keeps target hash and derived filename for non-password scans', async () => {
    const user = userEvent.setup();
    render(
      <IntelligenceReport
        scan={{ ...baseScan, type: 'email', target: 'victim@example.com', riskLevel: 'Low' }}
        onClose={() => {}}
      />,
    );

    const expectedHash = btoa('victim@example.com').substring(0, 20).toUpperCase();
    const hashLabel = await screen.findByText(/Target Hash:/);
    expect(hashLabel.closest('div')?.textContent).toContain(expectedHash);

    await user.click(screen.getByRole('button', { name: /export pdf/i }));
    await waitFor(() => expect(mocks.pdfSave).toHaveBeenCalledTimes(1));
    expect(mocks.pdfSave).toHaveBeenCalledWith('joescan_dossier_victim_example_com.pdf');
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PhoneAnalyzer from './PhoneAnalyzer';

const mocks = vi.hoisted(() => ({
  saveScan: vi.fn(),
  analyzePhoneExposure: vi.fn(),
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
    t: (key: string) => key,
  }),
}));

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
}));

vi.mock('firebase/firestore', () => ({
  serverTimestamp: vi.fn(() => 'timestamp'),
}));

vi.mock('../lib/webhooks', () => ({
  saveScan: mocks.saveScan,
}));

vi.mock('../lib/gemini', () => ({
  analyzePhoneExposure: mocks.analyzePhoneExposure,
}));

vi.mock('../lib/generatePDF', () => ({
  generateReportPDF: mocks.generateReportPDF,
}));

vi.mock('./MiniHistory', () => ({ default: () => null }));

async function submitPhone(value: string) {
  render(<PhoneAnalyzer />);
  fireEvent.change(screen.getByPlaceholderText('e.g. +1 555 019 2093'), {
    target: { value },
  });
  fireEvent.click(screen.getByRole('button', { name: /audit/i }));
}

describe('PhoneAnalyzer saved/exported number', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveScan.mockResolvedValue({ id: 'scan-1' });
    mocks.analyzePhoneExposure.mockResolvedValue({
      riskLevel: 'Low',
      reportText: 'No exposure found.',
      actionPlan: 'Keep monitoring.',
      carrier: null,
      country: 'Egypt',
    });
  });

  it('saves the normalized E.164 number, not the raw typed string', async () => {
    // Regression test: the analyzer scanned the libphonenumber-normalized
    // number but saved the raw input, so history attached to a different
    // looking number than the one shown in the verified card.
    await submitPhone('+20 10 1234 5678');
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
    expect(mocks.saveScan).toHaveBeenCalledWith(
      expect.objectContaining({ target: '+20 10 12345678' }),
    );
    expect(mocks.analyzePhoneExposure).toHaveBeenCalledWith(
      '+20 10 12345678',
      'en',
      true,
      'Egypt',
    );
  });

  it('drops the national trunk zero from saved, exported and linked numbers', async () => {
    // The sharp case: '+20 010...' is the same number as '+20 10...', but
    // the raw digits (2001012345678) would dial/search a wrong number.
    await submitPhone('+20 010 1234 5678');
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
    expect(mocks.saveScan).toHaveBeenCalledWith(
      expect.objectContaining({ target: '+20 10 12345678' }),
    );
    // Verified card shows the normalized form.
    expect(screen.getByTitle('+20 10 12345678')).toBeTruthy();
    // WhatsApp deep link uses the normalized digits, not the raw ones.
    const whatsapp = screen
      .getByText('Search WhatsApp')
      .closest('a') as HTMLAnchorElement;
    expect(whatsapp.getAttribute('href')).toBe(
      'https://api.whatsapp.com/send/?phone=201012345678',
    );
    // PDF export targets the normalized number too.
    fireEvent.click(screen.getByRole('button', { name: /download report/i }));
    await waitFor(() => expect(mocks.generateReportPDF).toHaveBeenCalledTimes(1));
    expect(mocks.generateReportPDF).toHaveBeenCalledWith(
      expect.objectContaining({ target: '+20 10 12345678' }),
      'phone',
      'en',
    );
  });

  it('rejects an invalid number without scanning or saving', async () => {
    await submitPhone('not-a-phone');
    await waitFor(() =>
      expect(screen.getByText('phone_invalid_format')).toBeTruthy(),
    );
    expect(mocks.analyzePhoneExposure).not.toHaveBeenCalled();
    expect(mocks.saveScan).not.toHaveBeenCalled();
  });
});

describe('PhoneAnalyzer country selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function typePhoneAndSelectCountry(typed: string, code: string) {
    render(<PhoneAnalyzer />);
    fireEvent.change(screen.getByPlaceholderText('e.g. +1 555 019 2093'), {
      target: { value: typed },
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: code },
    });
    // Re-query: the motion mock remounts the subtree on every render, so
    // a node held across the select change is detached afterwards.
    return screen.getByPlaceholderText(
      'e.g. +1 555 019 2093',
    ) as HTMLInputElement;
  }

  it('normalizes the trunk zero in the input when a country is picked', async () => {
    // Regression test: picking a country used to prepend its code as a
    // raw string, so the box showed '+20 010...' while the scan and the
    // verified card used '+20 10...'. The box must show what will be
    // scanned.
    const input = await typePhoneAndSelectCountry('01012345678', '+20');
    expect(input.value).toBe('+20 10 12345678');
  });

  it('leaves a partial number exactly as composed when a country is picked', async () => {
    // A number too short to parse must not be rewritten: the old prepend
    // behaviour is preserved for anything libphonenumber cannot validate.
    const input = await typePhoneAndSelectCountry('01012', '+20');
    expect(input.value).toBe('+20 01012');
  });

  it('normalizes a manually typed trunk-zero number on re-selecting its code', async () => {
    const input = await typePhoneAndSelectCountry('+20 010 1234 5678', '+20');
    expect(input.value).toBe('+20 10 12345678');
  });
});

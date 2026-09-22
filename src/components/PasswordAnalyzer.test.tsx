import React from 'react';
// @ts-ignore - types resolved at test runtime by vitest
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordAnalyzer from './PasswordAnalyzer';
import { PATTERN_ANALYSIS_LIMIT } from '../lib/passwordStrength';

const mocks = vi.hoisted(() => ({
  saveScan: vi.fn(),
  fetch: vi.fn(),
  digest: vi.fn(),
}));

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
      pwd_vault_title: 'Password Vault',
      pwd_vault_desc: 'Check password exposure',
      pwd_gen_settings: 'Generator Settings',
      pwd_generate: 'Generate Password',
      pwd_gen_length: 'Length',
      pwd_req_upper: 'A-Z',
      pwd_req_lower: 'a-z',
      pwd_gen_numbers: '0-9',
      pwd_req_symbols: '!@#$',
      pwd_req_length: 'At least 8 characters',
      pwd_req_number: 'Numbers',
      pwd_req_special: 'Symbols',
      pwd_req_no_patterns: 'No common patterns',
      pwd_placeholder: 'e.g. MySuperSecret123!',
      pwd_deep_audit: 'Deep Audit',
      pwd_risk_assessed: 'Risk Assessed',
      pwd_exposure: 'Exposure',
      pwd_download_report: 'Download Report',
      pwd_resistance_score: 'Resistance Score',
      pwd_remediation: 'Remediation Plan',
      pwd_why_score: 'Why this score',
      pwd_strength_0: 'Very Weak',
      pwd_strength_1: 'Weak',
      pwd_strength_2: 'Fair',
      pwd_strength_3: 'Good',
      pwd_strength_4: 'Strong',
    }[key] || key),
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

const FAKE_PASSWORD = 'Qz7!Falcon$Moth92';
const FAKE_PASSWORD_PREFIX = FAKE_PASSWORD.substring(0, 3);
const FAKE_HASH_HEX = Array.from(new Uint8Array([0x61, 0x62, 0x63, 0xd4, 0x5e]))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('');

describe('PasswordAnalyzer (S01 leak guard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { subtle: { digest: mocks.digest } });
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.digest.mockResolvedValue(new Uint8Array([0x61, 0x62, 0x63, 0xd4, 0x5e]).buffer);
    mocks.fetch.mockResolvedValue({ ok: true, text: async () => '0000000000:12\n' });
    mocks.saveScan.mockResolvedValue({ id: 'scan-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves a password scan with the constant target and no password value, prefix, or hash', async () => {
    const user = userEvent.setup();
    render(<PasswordAnalyzer />);

    const input = screen.getByPlaceholderText('e.g. MySuperSecret123!');
    await user.type(input, FAKE_PASSWORD);
    await user.click(screen.getByRole('button', { name: /deep audit/i }));

    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));

    const payload = mocks.saveScan.mock.calls[0][0];
    expect(payload.type).toBe('password');
    expect(payload.target).toBe('Password check');
    expect(payload.userId).toBe('user-1');

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(FAKE_PASSWORD);
    expect(serialized).not.toContain(FAKE_PASSWORD_PREFIX);
    expect(serialized).not.toContain(FAKE_HASH_HEX.toUpperCase());
    expect(serialized).not.toContain(FAKE_HASH_HEX.toLowerCase());
  });

  it('only contacts the breach database with k-anonymity hashing (no raw password on the wire)', async () => {
    const user = userEvent.setup();
    render(<PasswordAnalyzer />);

    await user.type(screen.getByPlaceholderText('e.g. MySuperSecret123!'), FAKE_PASSWORD);
    await user.click(screen.getByRole('button', { name: /deep audit/i }));

    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const [url] = mocks.fetch.mock.calls[0];
    expect(String(url)).toContain('https://api.pwnedpasswords.com/range/');
    expect(String(url)).not.toContain(FAKE_PASSWORD);
    expect(String(url)).not.toContain(FAKE_PASSWORD_PREFIX);
    expect(String(url)).toContain(FAKE_HASH_HEX.substring(0, 5));
  });

  it('hides the password by default and reveals it only while show is on', () => {
    render(<PasswordAnalyzer />);
    const field = () => screen.getByLabelText('Password') as HTMLInputElement;
    expect(field().type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field().type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(field().type).toBe('password');
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('scores a fully met password at 100 and a weak password much lower', async () => {
    const user = userEvent.setup();
    render(<PasswordAnalyzer />);
    const input = screen.getByPlaceholderText('e.g. MySuperSecret123!');
    fireEvent.change(input, { target: { value: 'Nimbus-Quartz-47!' } });
    expect(screen.getByText('Strong')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /deep audit/i }));
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
    const strong = mocks.saveScan.mock.calls[0][0];
    expect(strong.securityScore).toBe(100);
    expect(strong.securityScore).toBeGreaterThanOrEqual(0);
    expect(strong.securityScore).toBeLessThanOrEqual(100);
    expect(JSON.stringify(strong)).not.toMatch(/entropy|crack time|years to crack/i);
    expect(screen.getByText('100')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('e.g. MySuperSecret123!'), { target: { value: 'password' } });
    expect(screen.getByText('Weak')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /deep audit/i }));
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(2));
    const weak = mocks.saveScan.mock.calls[1][0];
    expect(weak.securityScore).toBe(33);
    expect(weak.securityScore).toBeLessThan(50);
    expect(weak.target).toBe('Password check');
  });

  it('does not present a short or repeated-block password as strong', async () => {
    const user = userEvent.setup();
    render(<PasswordAnalyzer />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Aa1!' } });
    expect(screen.queryByText('Strong')).toBeNull();
    expect(screen.queryByText('Good')).toBeNull();
    expect(screen.getByText('Weak')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Aa1!Aa1!' } });
    expect(screen.queryByText('Strong')).toBeNull();
    expect(screen.queryByText('Good')).toBeNull();
    await user.click(screen.getByRole('button', { name: /deep audit/i }));
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
    expect(mocks.saveScan.mock.calls[0][0].securityScore).toBeLessThanOrEqual(66);

    mocks.saveScan.mockClear();

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Qz7!Qz7!Qz7!Qz7!' } });
    expect(screen.queryByText('Strong')).toBeNull();
    expect(screen.queryByText('Good')).toBeNull();
    await user.click(screen.getByRole('button', { name: /deep audit/i }));
    await waitFor(() => expect(mocks.saveScan).toHaveBeenCalledTimes(1));
    expect(mocks.saveScan.mock.calls[0][0].securityScore).toBeLessThanOrEqual(66);

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: `Aa1!${'x'.repeat(PATTERN_ANALYSIS_LIMIT * 40)}` } });
    const pasted = screen.getByLabelText('Password') as HTMLInputElement;
    expect(pasted.maxLength).toBe(PATTERN_ANALYSIS_LIMIT);
    expect(pasted.value.length).toBeLessThanOrEqual(PATTERN_ANALYSIS_LIMIT);
    expect(pasted.type).toBe('password');
  });
});

import React from 'react';
// @ts-ignore - types resolved at test runtime by vitest
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SocialOsintScanner from './SocialOsintScanner';

const mocks = vi.hoisted(() => ({
  searchUsername: vi.fn(),
  analyzeSocialFootprint: vi.fn(),
  addDoc: vi.fn(),
  generateReportPDF: vi.fn(),
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
      audit: 'Audit',
      social_title: 'Social Media OSINT',
      social_desc: 'Scan social platforms',
      social_placeholder: 'e.g. john_doe',
      social_scanning: 'Scanning platforms...',
      social_scanning_desc: 'Enumerating username across 700+ global platforms...',
      social_found_on: 'Found on',
      social_platforms: 'platforms',
      social_not_found: 'No accounts found for this username.',
      social_category_social: 'Social Media',
      social_category_professional: 'Professional',
      social_category_gaming: 'Gaming',
      social_category_forums: 'Forums & Communities',
      social_category_other: 'Other',
      social_visit_profile: 'Visit Profile',
      social_ai_analyzing: 'AI is analyzing your digital footprint...',
      social_rate_limit: 'Rate limit reached. Please wait a few minutes and try again.',
      social_exposure_summary: 'Exposure Summary',
      exposure: 'Exposure',
      action_plan: 'Action Plan',
      download_report: 'Download PDF',
      security_score_title: 'Security Posture Score',
      score_factors: 'Score Factors',
      score_improvement: 'How to Improve',
    }[key] || key),
  }),
}));

vi.mock('../lib/socialOsint', () => ({
  searchUsername: mocks.searchUsername,
}));

vi.mock('../lib/gemini', () => ({
  analyzeSocialFootprint: mocks.analyzeSocialFootprint,
}));

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => 'scans'),
  addDoc: mocks.addDoc,
  serverTimestamp: vi.fn(() => 'timestamp'),
}));

vi.mock('../lib/generatePDF', () => ({
  generateReportPDF: mocks.generateReportPDF,
}));

describe('SocialOsintScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addDoc.mockResolvedValue({ id: 'scan-1' });
  });

  it('renders results, AI analysis, and exports a report on the happy path', async () => {
    mocks.searchUsername.mockImplementation(async (_username: string, onProgress?: (status: string, checked: number, total: number) => void) => {
      onProgress?.('running', 12, 725);
      return {
        username: 'john_doe',
        totalPlatforms: 725,
        status: 'completed',
        hits: [
          { platform: 'GitHub', url: 'https://github.com/john_doe', status: 'hit', category: 'professional' },
          { platform: 'Reddit', url: 'https://reddit.com/u/john_doe', status: 'hit', category: 'forums' },
        ],
      };
    });

    mocks.analyzeSocialFootprint.mockResolvedValue({
      riskLevel: 'High',
      reportText: 'Accounts across multiple communities increase correlation risk.',
      actionPlan: '1. Remove unused profiles\\n2. Enable MFA',
      securityScore: 42,
      scoreFactors: ['Cross-platform reuse'],
      scoreImprovement: ['Use unique profile details'],
    });

    const user = userEvent.setup();
    render(<SocialOsintScanner />);

    fireEvent.change(screen.getByLabelText('Social Media OSINT'), { target: { value: 'john_doe' } });
    await user.click(screen.getByRole('button', { name: /audit/i }));

    expect(await screen.findByText('Accounts across multiple communities increase correlation risk.')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Reddit')).toBeInTheDocument();
    expect(mocks.analyzeSocialFootprint).toHaveBeenCalledWith('john_doe', ['GitHub', 'Reddit'], 'en');

    const downloadButton = screen.getByRole('button', { name: /download pdf/i });
    expect(downloadButton).toBeInTheDocument();

    await user.click(downloadButton);

    expect(mocks.generateReportPDF).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.addDoc).toHaveBeenCalledTimes(1));
  });

  it('shows a no-hit state without running AI analysis', async () => {
    mocks.searchUsername.mockResolvedValue({
      username: 'quiet_user',
      totalPlatforms: 725,
      status: 'completed',
      hits: [],
    });

    const user = userEvent.setup();
    render(<SocialOsintScanner />);

    fireEvent.change(screen.getByLabelText('Social Media OSINT'), { target: { value: 'quiet_user' } });
    await user.click(screen.getByRole('button', { name: /audit/i }));

    expect(await screen.findByText('No accounts found for this username.')).toBeInTheDocument();
    expect(screen.getByText('quiet_user')).toBeInTheDocument();
    expect(mocks.analyzeSocialFootprint).not.toHaveBeenCalled();
  });

  it('shows the provider rate-limit message', async () => {
    mocks.searchUsername.mockRejectedValue(new Error('RATE_LIMIT'));

    const user = userEvent.setup();
    render(<SocialOsintScanner />);

    fireEvent.change(screen.getByLabelText('Social Media OSINT'), { target: { value: 'busy_user' } });
    await user.click(screen.getByRole('button', { name: /audit/i }));

    expect(await screen.findByText('Rate limit reached. Please wait a few minutes and try again.')).toBeInTheDocument();
  });
});

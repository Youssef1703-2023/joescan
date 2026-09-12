import React from 'react';
// @ts-ignore - types resolved at test runtime by vitest
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Watchlist from './Watchlist';

const mocks = vi.hoisted(() => ({
  fetchWatchlistState: vi.fn(),
  syncWatchlist: vi.fn(),
  sweepWatchlistNow: vi.fn(),
  getUserTier: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  addNotification: vi.fn(),
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
    t: (key: string) => key,
  }),
}));

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: [],
    addNotification: mocks.addNotification,
  }),
}));

vi.mock('../lib/firebase', () => ({
  auth: {
    currentUser: { uid: 'user-123', email: 'test@joescan.me' },
  },
  db: {},
  getUserTier: mocks.getUserTier,
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: mocks.getDocs,
  addDoc: mocks.addDoc,
  deleteDoc: mocks.deleteDoc,
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => ({})),
}));

vi.mock('../lib/watchlist', () => ({
  fetchWatchlistState: mocks.fetchWatchlistState,
  syncWatchlist: mocks.syncWatchlist,
  sweepWatchlistNow: mocks.sweepWatchlistNow,
}));

describe('Watchlist Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserTier.mockResolvedValue('pro');
    mocks.getDocs.mockResolvedValue({
      docs: [
        {
          id: 'doc-ip-1',
          data: () => ({
            userId: 'user-123',
            type: 'ip',
            value: '1.2.3.4',
            createdAt: {},
          }),
        },
        {
          id: 'doc-email-1',
          data: () => ({
            userId: 'user-123',
            type: 'email',
            value: 'admin@joescan.me',
            createdAt: {},
          }),
        },
        {
          id: 'doc-phone-1',
          data: () => ({
            userId: 'user-123',
            type: 'phone',
            value: '+15551234567',
            createdAt: {},
          }),
        },
      ],
    });

    mocks.fetchWatchlistState.mockResolvedValue({
      revision: 1,
      lastSweptAt: Date.now() - 3600000,
      sweepInProgress: false,
      targets: [
        {
          id: 'doc-ip-1',
          type: 'ip',
          value: '1.2.3.4',
          status: 'clean',
          baselineEstablished: true,
          lastChecked: Date.now() - 3600000,
          nextDueAt: Date.now() + 82800000,
          lastConfirmedAt: Date.now(),
        },
      ],
      findings: [],
    });
  });

  it('renders targets with authoritative DO runtime state and correct labels', async () => {
    render(<Watchlist />);

    await waitFor(() => {
      expect(screen.getByText('1.2.3.4')).toBeInTheDocument();
      expect(screen.getByText('admin@joescan.me')).toBeInTheDocument();
      expect(screen.getByText('+15551234567')).toBeInTheDocument();
    });

    // Check status badges & labels
    expect(screen.getByText(/No new findings/i)).toBeInTheDocument();
    expect(screen.getByText(/^On demand$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Not supported/i).length).toBeGreaterThanOrEqual(1);
  });

  it('triggers sweep all on button click', async () => {
    mocks.sweepWatchlistNow.mockResolvedValue({ ok: true, sweptCount: 1 });
    render(<Watchlist />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Check now' })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByText('Check now'));
    await waitFor(() => {
      expect(mocks.sweepWatchlistNow).toHaveBeenCalled();
    });
  });
  it('shows runtime failure without claiming monitoring is active', async () => {
    mocks.fetchWatchlistState.mockRejectedValueOnce(new Error('offline'));
    render(<Watchlist />);
    expect(await screen.findByText('Status unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No new findings')).not.toBeInTheDocument();
  });
  it('filters saved items by their identifier', async () => {
    render(<Watchlist />);
    await screen.findByText('1.2.3.4');
    fireEvent.change(screen.getByLabelText('Search watchlist'), {target:{value:'admin@'}});
    expect(screen.queryByText('1.2.3.4')).not.toBeInTheDocument();
    expect(screen.getByText('admin@joescan.me')).toBeInTheDocument();
  });
  it('prevents persistence when the server rejects the new target', async () => {
    mocks.syncWatchlist.mockRejectedValueOnce(new Error('Target rejected'));
    render(<Watchlist />);
    await screen.findByText('1.2.3.4');
    fireEvent.change(screen.getByLabelText('Address or identifier'), {target:{value:'8.8.8.8'}});
    fireEvent.click(screen.getByRole('button', {name:'Continue'}));
    fireEvent.click(screen.getByRole('button', {name:'Save item'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Target rejected');
    expect(mocks.addDoc).not.toHaveBeenCalled();
  });

});

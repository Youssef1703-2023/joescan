import { auth } from './firebase';

export type WatchlistTargetType = 'ip' | 'domain' | 'email' | 'phone';
export type WatchlistFrequency = 'daily' | 'weekly';

export type TargetStatus =
  | 'monitoring'
  | 'threat_detected'
  | 'evaluating'
  | 'baseline_established'
  | 'clean'
  | 'stale_unconfirmed'
  | 'unsupported'
  | 'on_demand';

export interface WatchlistTargetState {
  id: string;
  type: WatchlistTargetType;
  value: string;
  frequency: WatchlistFrequency;
  scheduleTime?: string;
  scheduleDay?: string;
  nextDueAt: number;
  status: TargetStatus;
  baselineEstablished: boolean;
  lastChecked: number | null;
  lastError: string | null;
  threatDetails?: string;
  lastConfirmedAt: number;
}

export interface WatchlistFinding {
  id: string;
  targetId: string;
  kind: string;
  detail: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  detectedAt: number;
}

export interface WatchlistStateResponse {
  revision: number;
  lastSweptAt: number | null;
  sweepInProgress: boolean;
  targets: WatchlistTargetState[];
  findings: WatchlistFinding[];
}

export interface SyncTargetInput {
  id?: string;
  type: WatchlistTargetType;
  value: string;
  frequency?: WatchlistFrequency;
  scheduleTime?: string;
  scheduleDay?: string;
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  message?: string;
  revision?: number;
  targetCount?: number;
  limit?: number;
}

export interface SweepResult {
  ok: boolean;
  error?: string;
  message?: string;
  sweptCount?: number;
  findingsCount?: number;
  lastSweptAt?: number;
}

const REVISION_STORAGE_KEY = 'joescan_watchlist_revision';

export function getLocalRevision(): number {
  try {
    const raw = localStorage.getItem(REVISION_STORAGE_KEY);
    const parsed = parseInt(raw || '1', 10);
    return isNaN(parsed) || parsed < 1 ? 1 : parsed;
  } catch {
    return 1;
  }
}

export function saveLocalRevision(rev: number): void {
  try {
    localStorage.setItem(REVISION_STORAGE_KEY, String(rev));
  } catch {
    // Ignore localStorage errors
  }
}

export function getNextRevision(): number {
  const current = getLocalRevision();
  const next = current + 1;
  saveLocalRevision(next);
  return next;
}

function getProxyEndpoint(path: string): string {
  const proxyUrl = import.meta.env.VITE_AI_PROXY_URL;
  if (!proxyUrl) {
    throw new Error('AI proxy service URL is not configured.');
  }
  return proxyUrl.replace(/\/+$/, '') + path;
}

export async function fetchWatchlistState(): Promise<WatchlistStateResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required.');
  }

  const idToken = await user.getIdToken();
  const endpoint = getProxyEndpoint('/watchlist/state');

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || `Watchlist state error (HTTP ${res.status})`);
  }

  const data = (await res.json()) as WatchlistStateResponse;
  if (data.revision && data.revision > getLocalRevision()) {
    saveLocalRevision(data.revision);
  }
  return data;
}

export async function syncWatchlist(targets: SyncTargetInput[], revision?: number): Promise<SyncResult> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required.');
  }

  const idToken = await user.getIdToken();
  const endpoint = getProxyEndpoint('/watchlist/sync');
  const targetRevision = revision ?? getNextRevision();

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      targets,
      revision: targetRevision,
    }),
  });

  const data = (await res.json()) as SyncResult;
  if (!res.ok || !data.ok) {
    throw new Error(data.message || data.error || `Watchlist sync failed (HTTP ${res.status})`);
  }

  if (data.revision) {
    saveLocalRevision(data.revision);
  }
  return data;
}

export async function sweepWatchlistNow(): Promise<SweepResult> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required.');
  }

  const idToken = await user.getIdToken();
  const endpoint = getProxyEndpoint('/watchlist/sweep-now');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  const data = (await res.json()) as SweepResult;
  if (!res.ok || !data.ok) {
    throw new Error(data.message || data.error || `Watchlist sweep failed (HTTP ${res.status})`);
  }

  return data;
}

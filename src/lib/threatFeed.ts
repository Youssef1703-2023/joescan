import { auth } from './firebase';

export interface ThreatIndicator {
  id: string;
  ip: string;
  port: number | null;
  status: 'online' | 'offline';
  hostname: string | null;
  asNumber: number | null;
  asName: string | null;
  country: string;
  countryName: string;
  coordinates: [number, number]; // [lat, lng]
  firstSeen: string;
  lastOnline: string | null;
  malware: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ThreatFeedResponse {
  source: string;
  description: string;
  updatedAt: string;
  itemCount: number;
  indicators: ThreatIndicator[];
}

export async function fetchThreatFeed(): Promise<ThreatFeedResponse> {
  const proxyUrl = import.meta.env.VITE_AI_PROXY_URL;
  if (!proxyUrl) {
    throw new Error('AI proxy service URL is not configured.');
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required. Please sign in to access threat intelligence.');
  }

  const idToken = await user.getIdToken();
  const endpoint = proxyUrl.replace(/\/+$/, '') + '/threat-feed';

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Threat feed error (HTTP ${res.status})`);
  }

  return (await res.json()) as ThreatFeedResponse;
}

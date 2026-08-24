import { auth, db } from './firebase';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';

export interface WebhookDispatchResult {
  id: string;
  name?: string;
  url: string;
  status: number;
  ok: boolean;
  durationMs: number;
  error?: string | null;
}

export interface WebhookDispatchResponse {
  success: boolean;
  event: string;
  dispatchedCount: number;
  results: WebhookDispatchResult[];
}

export interface WebhookDispatchParams {
  eventType?: string;
  event?: string;
  scanId?: string;
  target?: string;
  riskLevel?: string;
  data?: any;
  webhookId?: string;
}

/**
 * Dispatch events to user-configured SIEM webhooks through the Cloudflare Worker proxy.
 * The Worker signs payloads with HMAC-SHA256 using the webhook's secret.
 * Updates lastTriggered and failCount in Firestore based on the dispatch outcome.
 */
export async function dispatchWebhooks(params: WebhookDispatchParams): Promise<WebhookDispatchResponse> {
  const proxyUrl = import.meta.env.VITE_AI_PROXY_URL;
  if (!proxyUrl) {
    throw new Error('AI proxy service URL is not configured.');
  }

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required for webhook dispatch.');
  }

  const idToken = await user.getIdToken();
  const endpoint = proxyUrl.replace(/\/+$/, '') + '/webhook-dispatch';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Webhook dispatch failed (HTTP ${res.status})`);
  }

  const data = (await res.json()) as WebhookDispatchResponse;

  // Cosmetic bookkeeping: update lastTriggered and failCount on caller's owned webhook documents
  if (Array.isArray(data.results)) {
    for (const result of data.results) {
      if (!result.id) continue;
      try {
        const webhookRef = doc(db, 'webhooks', result.id);
        if (result.ok) {
          await updateDoc(webhookRef, {
            lastTriggered: new Date().toISOString(),
            failCount: 0,
          });
        } else {
          await updateDoc(webhookRef, {
            lastTriggered: new Date().toISOString(),
            failCount: increment(1),
          });
        }
      } catch (updateErr) {
        console.warn(`[Webhooks] Could not update status for webhook ${result.id}:`, updateErr);
      }
    }
  }

  return data;
}

/**
 * Shared helper to save a scan document to Firestore and automatically
 * trigger SIEM webhook dispatch in the background.
 */
export async function saveScan(scanData: any) {
  const docRef = await addDoc(collection(db, 'scans'), scanData);

  // Background SIEM webhook dispatch (non-blocking)
  const target = scanData.target || scanData.emailScanned || scanData.urlScanned || scanData.ipScanned || '';
  const riskLevel = scanData.riskLevel || 'Low';
  const isThreat = String(riskLevel).toLowerCase() === 'high' || String(riskLevel).toLowerCase() === 'critical';

  dispatchWebhooks({
    eventType: isThreat ? 'threat_detected' : 'scan_complete',
    scanId: docRef.id,
    target: target,
    riskLevel: riskLevel,
    data: {
      type: scanData.type || 'scan',
      securityScore: scanData.securityScore,
      breachesCount: Array.isArray(scanData.breaches) ? scanData.breaches.length : undefined,
    },
  }).catch((err) => {
    console.warn('[Webhooks] Background dispatch error:', err);
  });

  return docRef;
}

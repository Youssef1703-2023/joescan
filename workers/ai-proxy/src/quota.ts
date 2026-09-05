export interface QuotaData {
  day: string;
  count: number;
}

export interface BurstData {
  windowStart: number;
  count: number;
}

export interface ReserveResult {
  ok: boolean;
  used: number;
  limit: number;
}

export interface PeekResult {
  used: number;
  day: string;
}

export interface BurstResult {
  ok: boolean;
  retryAfter?: number;
}

export interface WindowData {
  windowStart: number;
  count: number;
}

export interface WindowResult {
  ok: boolean;
  count: number;
  limit: number;
  retryAfter?: number;
}

export class QuotaCounter implements DurableObject {
  private state: DurableObjectState;
  private env: any;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }

  async reserve(limit: number, day: string): Promise<ReserveResult> {
    const data = (await this.state.storage.get<QuotaData>('quota')) || { day, count: 0 };
    let count = data.day === day ? (data.count || 0) : 0;

    if (count >= limit) {
      return { ok: false, used: count, limit };
    }

    count += 1;
    await this.state.storage.put<QuotaData>('quota', { day, count });
    return { ok: true, used: count, limit };
  }

  async peek(day: string): Promise<PeekResult> {
    const data = (await this.state.storage.get<QuotaData>('quota')) || { day, count: 0 };
    const used = data.day === day ? (data.count || 0) : 0;
    return { used, day };
  }

  async checkBurst(maxBurst: number = 20, windowSec: number = 60): Promise<BurstResult> {
    const now = Math.floor(Date.now() / 1000);
    const data = (await this.state.storage.get<BurstData>('burst')) || { windowStart: now, count: 0 };
    let windowStart = data.windowStart || now;
    let count = data.count || 0;

    if (now - windowStart >= windowSec) {
      windowStart = now;
      count = 0;
    }

    if (count >= maxBurst) {
      const retryAfter = Math.max(1, windowSec - (now - windowStart));
      return { ok: false, retryAfter };
    }

    count += 1;
    await this.state.storage.put<BurstData>('burst', { windowStart, count });
    return { ok: true };
  }

  /**
   * Generic fixed-window counter used by hardening controls (e.g. S03 webhook
   * dispatch limits). Callers pass a unique key; each key owns an independent
   * window. Durable Objects process requests sequentially per instance, so the
   * read/compare/increment/write sequence below is concurrency-safe.
   */
  async reserveWindow(key: string, limit: number, windowSec: number): Promise<WindowResult> {
    const storeKey = `win:${key}`;
    const now = Math.floor(Date.now() / 1000);
    const data = (await this.state.storage.get<WindowData>(storeKey)) || { windowStart: now, count: 0 };
    let windowStart = data.windowStart || now;
    let count = data.count || 0;

    if (now - windowStart >= windowSec) {
      windowStart = now;
      count = 0;
    }

    if (count >= limit) {
      const retryAfter = Math.max(1, windowSec - (now - windowStart));
      return { ok: false, count, limit, retryAfter };
    }

    count += 1;
    await this.state.storage.put<WindowData>(storeKey, { windowStart, count });
    return { ok: true, count, limit };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/reserve' && request.method === 'POST') {
      const body = (await request.json()) as { limit: number; day: string };
      const result = await this.reserve(body.limit, body.day);
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/peek') {
      const day = url.searchParams.get('day') || '';
      const result = await this.peek(day);
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/burst' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { maxBurst?: number; windowSec?: number };
      const result = await this.checkBurst(body.maxBurst ?? 20, body.windowSec ?? 60);
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }
    if (url.pathname === '/window' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { key?: string; limit?: number; windowSec?: number };
      if (typeof body.key !== 'string' || !body.key || body.key.length > 256) {
        return new Response(JSON.stringify({ ok: false, error: 'INVALID_KEY' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const result = await this.reserveWindow(body.key, body.limit ?? 1, body.windowSec ?? 3600);
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('Not Found', { status: 404 });
  }
}

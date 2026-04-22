// @vitest-environment node

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './server';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('social osint relay server', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('relays platform metadata successfully', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ platforms: [{ name: 'AcmeHub', category: 'social' }] }));
    vi.stubGlobal('fetch', fetchMock);

    const app = createApp({ apiOnly: true, upstreamBase: 'https://whatsmyname.ink' });
    const response = await request(app).get('/api/social-osint/platforms');

    expect(response.status).toBe(200);
    expect(response.body.platforms[0].name).toBe('AcmeHub');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://whatsmyname.ink/api/platforms',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects invalid usernames before calling upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const app = createApp({ apiOnly: true });
    const response = await request(app)
      .post('/api/social-osint/search')
      .send({ username: 'bad user name' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_USERNAME');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes through upstream rate limits', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: 'slow down' }, 429));
    vi.stubGlobal('fetch', fetchMock);

    const app = createApp({ apiOnly: true });
    const response = await request(app)
      .post('/api/social-osint/search')
      .send({ username: 'john_doe' });

    expect(response.status).toBe(429);
    expect(response.body.code).toBe('RATE_LIMIT');
    expect(response.body.upstreamStatus).toBe(429);
  });

  it('returns a timeout error when upstream fetch times out', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'));
    vi.stubGlobal('fetch', fetchMock);

    const app = createApp({ apiOnly: true });
    const response = await request(app).get('/api/social-osint/search?id=query-1');

    expect(response.status).toBe(504);
    expect(response.body.code).toBe('UPSTREAM_TIMEOUT');
  });

  it('requires a query id for search polling', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const app = createApp({ apiOnly: true });
    const response = await request(app).get('/api/social-osint/search');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_QUERY_ID');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

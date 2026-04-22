import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_UPSTREAM_BASE = 'https://whatsmyname.ink';
const SOCIAL_OSINT_BASE_PATH = '/api/social-osint';
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{1,50}$/;

type AppOptions = {
  apiOnly?: boolean;
  upstreamBase?: string;
};

type RelayErrorCode =
  | 'INVALID_USERNAME'
  | 'INVALID_QUERY_ID'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'MALFORMED_UPSTREAM_RESPONSE'
  | 'UPSTREAM_ERROR'
  | 'RATE_LIMIT';

function getArgValue(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function isTimeoutError(error: unknown) {
  return error instanceof DOMException && error.name === 'TimeoutError';
}

function jsonError(response: Response, status: number, code: RelayErrorCode, message: string, upstreamStatus: number | null = null) {
  return response.status(status).json({
    code,
    message,
    upstreamStatus,
  });
}

async function readJsonSafely<T>(upstreamResponse: globalThis.Response) {
  const text = await upstreamResponse.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

async function relayUpstreamJson(
  response: Response,
  upstreamBase: string,
  upstreamPath: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const targetUrl = `${upstreamBase}${upstreamPath}`;

  let upstreamResponse: globalThis.Response;

  try {
    upstreamResponse = await fetch(targetUrl, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      return jsonError(response, 504, 'UPSTREAM_TIMEOUT', 'The upstream OSINT service timed out.');
    }

    return jsonError(response, 502, 'UPSTREAM_UNAVAILABLE', 'The upstream OSINT service is currently unavailable.');
  }

  try {
    const payload = await readJsonSafely<unknown>(upstreamResponse);

    if (payload === undefined) {
      return jsonError(response, 502, 'MALFORMED_UPSTREAM_RESPONSE', 'The upstream OSINT service returned invalid JSON.', upstreamResponse.status);
    }

    if (!upstreamResponse.ok) {
      if (upstreamResponse.status === 429) {
        return jsonError(response, 429, 'RATE_LIMIT', 'The upstream OSINT service rate limited the request.', 429);
      }

      return jsonError(
        response,
        upstreamResponse.status,
        'UPSTREAM_ERROR',
        `The upstream OSINT service returned HTTP ${upstreamResponse.status}.`,
        upstreamResponse.status,
      );
    }

    return response.status(upstreamResponse.status).json(payload);
  } catch (error) {
    if (isTimeoutError(error)) {
      return jsonError(response, 504, 'UPSTREAM_TIMEOUT', 'The upstream OSINT service timed out.');
    }

    return jsonError(response, 502, 'UPSTREAM_UNAVAILABLE', 'The upstream OSINT service is currently unavailable.');
  }
}

export function createApp(options: AppOptions = {}) {
  const app = express();
  const upstreamBase = (options.upstreamBase || process.env.SOCIAL_OSINT_UPSTREAM_BASE || DEFAULT_UPSTREAM_BASE).replace(/\/+$/, '');
  const apiOnly = options.apiOnly ?? false;
  const currentFilePath = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFilePath);
  const distDir = path.join(currentDir, 'dist');
  const indexPath = path.join(distDir, 'index.html');

  app.disable('x-powered-by');
  app.use(express.json());

  app.get(`${SOCIAL_OSINT_BASE_PATH}/platforms`, async (_request, response) => {
    return await relayUpstreamJson(response, upstreamBase, '/api/platforms', { method: 'GET' }, 10_000);
  });

  app.post(`${SOCIAL_OSINT_BASE_PATH}/search`, async (request: Request, response: Response) => {
    const username = typeof request.body?.username === 'string' ? request.body.username.trim() : '';

    if (!username || !USERNAME_PATTERN.test(username)) {
      return jsonError(response, 400, 'INVALID_USERNAME', 'Username must be 1-50 characters using letters, numbers, dot, underscore, or hyphen.');
    }

    return await relayUpstreamJson(
      response,
      upstreamBase,
      '/api/search',
      {
        method: 'POST',
        body: JSON.stringify({ username }),
      },
      90_000,
    );
  });

  app.get(`${SOCIAL_OSINT_BASE_PATH}/search`, async (request: Request, response: Response) => {
    const queryId = typeof request.query.id === 'string' ? request.query.id.trim() : '';

    if (!queryId) {
      return jsonError(response, 400, 'INVALID_QUERY_ID', 'Search query id is required.');
    }

    return await relayUpstreamJson(
      response,
      upstreamBase,
      `/api/search?id=${encodeURIComponent(queryId)}`,
      { method: 'GET' },
      20_000,
    );
  });

  if (!apiOnly) {
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));

      app.get('*', (request, response, next) => {
        if (request.path.startsWith(SOCIAL_OSINT_BASE_PATH)) {
          next();
          return;
        }

        response.sendFile(indexPath);
      });
    } else {
      app.get('*', (_request, response) => {
        response.status(503).send('Frontend build not found. Run "npm run build" first.');
      });
    }
  }

  return app;
}

export function startServer() {
  const port = Number(getArgValue('--port') || process.env.PORT || 3000);
  const apiOnly = hasFlag('--api-only');
  const app = createApp({ apiOnly });

  return app.listen(port, () => {
    const mode = apiOnly ? 'API relay' : 'production';
    console.log(`[joescan] ${mode} server listening on http://127.0.0.1:${port}`);
  });
}

const currentModulePath = fileURLToPath(import.meta.url);
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (entryPath && currentModulePath === entryPath) {
  startServer();
}

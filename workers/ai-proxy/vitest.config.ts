import { defineConfig } from 'vitest/config';

// The Worker runs on the Cloudflare Workers runtime, so its tests need the
// Node environment (fetch/Request/Response globals), not the repo-root jsdom
// setup used for React component tests. This config is intentionally separate
// from the root vitest.config.ts, which excludes workers/**.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});

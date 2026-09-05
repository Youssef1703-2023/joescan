import { defineConfig, configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    // Exclude leftover Claude worktree copies - vitest was picking up stale
    // duplicate test files from .claude/worktrees and failing on them.
    // workers/** has its own vitest.config.ts (Node environment for the
    // Cloudflare Worker); it must not run under this jsdom setup.
    exclude: [...configDefaults.exclude, '**/.claude/**', 'workers/**'],
  },
});

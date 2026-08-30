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
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});

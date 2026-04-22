import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { NextFunction, Request, Response } from 'express';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { createApp } from './server';

function socialOsintDevApi(): Plugin {
  return {
    name: 'social-osint-dev-api',
    enforce: 'pre',
    configureServer(server) {
      const app = createApp({ apiOnly: true });
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url ?? '').split('?')[0] ?? '';
        if (pathOnly.startsWith('/api/social-osint')) {
          app(req as Request, res as Response, next as NextFunction);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [socialOsintDevApi(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

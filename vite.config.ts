import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';

function socialOsintDevApi(): Plugin {
  return {
    name: 'social-osint-dev-api',
    enforce: 'pre',
    configureServer(server) {
      // Dynamic import - only runs during dev, not during production build
      import('./server').then(({ createApp }) => {
        const app = createApp({ apiOnly: true });
        server.middlewares.use((req: any, res: any, next: any) => {
          const pathOnly = (req.url ?? '').split('?')[0] ?? '';
          if (pathOnly.startsWith('/api/social-osint')) {
            app(req, res, next);
          } else {
            next();
          }
        });
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

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
    build: {
      chunkSizeWarningLimit: 650,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom')) return 'vendor-react-dom';
              if (id.includes('react')) return 'vendor-react';
              if (id.includes('firebase/auth')) return 'vendor-firebase-auth';
              if (id.includes('firebase/firestore')) return 'vendor-firebase-firestore';
              if (id.includes('firebase')) return 'vendor-firebase-core';
              if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
              if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
              if (id.includes('motion')) return 'vendor-motion';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('libphonenumber')) return 'vendor-phone';
              if (id.includes('@google/genai') || id.includes('openai')) return 'vendor-ai';
            }
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {isLocalPreview, clearLocalPreviewCache} from './lib/previewCache';

// Register service worker at app startup
if (isLocalPreview()) {
  clearLocalPreviewCache().then(needsReload => {
    if (!needsReload) return;
    const key = 'joescan-preview-cache-recovered';
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch {}
    window.location.reload();
  }).catch(error => console.warn('Preview cache cleanup failed:', error));
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


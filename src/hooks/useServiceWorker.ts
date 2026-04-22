import { useState, useEffect, useCallback } from 'react';

export interface SWUpdateStatus {
  /** A new service-worker is waiting to activate */
  updateAvailable: boolean;
  /** Currently checking for updates */
  checking: boolean;
  /** The SW registration object */
  registration: ServiceWorkerRegistration | null;
  /** Trigger a manual check */
  checkForUpdate: () => Promise<void>;
  /** Apply the waiting update and reload */
  applyUpdate: () => void;
  /** Last time we checked (ms since epoch) */
  lastChecked: number | null;
}

export function useServiceWorker(): SWUpdateStatus {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [lastChecked, setLastChecked] = useState<number | null>(null);

  // Register SW on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').then((reg) => {
      setRegistration(reg);

      // If there is already a waiting worker
      if (reg.waiting) {
        setUpdateAvailable(true);
      }

      // Detect when a new SW is installed and waiting
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });
    }).catch((err) => {
      console.warn('SW registration failed:', err);
    });

    // When the new SW takes over, reload the page
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (!registration) return;
    setChecking(true);
    try {
      await registration.update();
      setLastChecked(Date.now());
      // After update(), if a new SW is found, the 'updatefound' event fires
      // Give it a moment to install
      await new Promise((r) => setTimeout(r, 1500));
      if (registration.waiting) {
        setUpdateAvailable(true);
      }
    } catch (err) {
      console.warn('SW update check failed:', err);
    } finally {
      setChecking(false);
    }
  }, [registration]);

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    // The controllerchange event will trigger a reload
  }, [registration]);

  return {
    updateAvailable,
    checking,
    registration,
    checkForUpdate,
    applyUpdate,
    lastChecked,
  };
}

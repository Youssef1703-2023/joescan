/** Preview builds must never reuse an offline production shell. */
export function isLocalPreview(hostname = window.location.hostname): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
}

export async function clearLocalPreviewCache(): Promise<boolean> {
  if (!isLocalPreview()) return false;
  const workerPath = `${window.location.origin}/sw.js`;
  const controlled = 'serviceWorker' in navigator && navigator.serviceWorker.controller?.scriptURL === workerPath;
  const registrations = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
  const removed = await Promise.all(registrations
    .filter(registration => [registration.active, registration.waiting, registration.installing].some(worker => worker?.scriptURL === workerPath))
    .map(registration => registration.unregister()));
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('joescan-')).map(key => caches.delete(key)));
  }
  // Only HTTP/CacheStorage is cleared. Firebase Auth's IndexedDB is untouched.
  return !!controlled && removed.some(Boolean);
}

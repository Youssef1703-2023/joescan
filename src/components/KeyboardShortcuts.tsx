import { useEffect } from 'react';

interface ShortcutMap {
  [key: string]: string; // shortcut key -> tabId
}

const SHORTCUTS: ShortcutMap = {
  'e': 'email',
  'p': 'password',
  'n': 'phone',        // phone Number
  'u': 'username',
  'l': 'url',          // Link
  'm': 'message',
  'i': 'ip',
  'd': 'domain',
  'f': 'fingerprint',
  's': 'device_security', // Security
  'h': 'history',
  'w': 'watchlist',
  'b': 'blog',
  'a': 'academy',
};

interface Props {
  onNavigate: (tabId: string) => void;
  enabled: boolean;
}

/**
 * Global keyboard shortcuts:
 * Ctrl+Shift+<key> → Navigate to tool
 * Ctrl+K → Command Palette (handled separately)
 */
export default function KeyboardShortcuts({ onNavigate, enabled }: Props) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Only handle Ctrl+Shift combinations
      if (!e.ctrlKey || !e.shiftKey) return;
      // Don't trigger in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = e.key.toLowerCase();
      const tabId = SHORTCUTS[key];
      if (tabId) {
        e.preventDefault();
        onNavigate(tabId);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNavigate, enabled]);

  return null; // invisible component
}

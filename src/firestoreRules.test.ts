import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Static tripwire coverage for the S02 ban enforcement in firestore.rules.
// The repo has no Firestore emulator harness, so these assertions lock in the
// structural properties the security fix depends on until emulator tests land.

// Vitest's jsdom environment rewrites import.meta.url to a non-file URL, so
// resolve the rules file against the repo root (vitest's cwd).
const rulesText = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf-8');

function extractMatchBlock(collectionName: string): string | null {
  const start = rulesText.indexOf(`match /${collectionName}/`);
  if (start === -1) return null;
  // The match header is e.g. `match /users/{userId} {` — the interpolation
  // braces inside the path must be skipped so counting starts at the block's
  // own opening brace (the `} {` that ends the header).
  const headerEnd = rulesText.indexOf('} {', start);
  if (headerEnd === -1) return null;
  let depth = 1;
  for (let i = headerEnd + 3; i < rulesText.length; i++) {
    const ch = rulesText[i];
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return rulesText.slice(start, i + 1);
      }
    }
  }
  return null;
}

// Product resources a banned user must be denied (reads, writes, and lists).
const PRODUCT_RESOURCES = [
  'users',
  'usernames',
  'adminConfig',
  'broadcasts',
  'notifications',
  'promoCodes',
  'activityLog',
  'supportTickets',
  'apiKeys',
  'scans',
  'webhooks',
  'teams',
  'watchlist',
  'notifPrefs',
  'referrals',
  'referralSignups',
  'tierRequests',
  'referralClaims',
];

// Server-only collections keep their deny-all stance.
const SERVER_ONLY_RESOURCES = ['mfaSecrets', 'aiUsage', 'pendingOrders', 'rateLimits'];

describe('S02 firestore.rules ban enforcement', () => {
  it('defines an absence-safe isNotBanned predicate', () => {
    expect(rulesText).toContain('function isNotBanned()');
    // A missing bannedUsers/{uid} document must mean "not banned" (exists() is
    // false), not a rules error, otherwise every unbanned user would be denied.
    expect(rulesText).toContain(
      '!exists(/databases/$(database)/documents/bannedUsers/$(request.auth.uid))'
    );
    // Missing/false `active` must not error: Map.get with a default, compared
    // against true, so only an explicit active == true counts as banned.
    expect(rulesText).toContain(".data.get('active', false) != true");
  });

  it('applies isNotBanned to every product resource', () => {
    for (const resource of PRODUCT_RESOURCES) {
      const block = extractMatchBlock(resource);
      expect(block, `match /${resource}/ block should exist`).not.toBeNull();
      expect(block, `match /${resource}/ should gate access with isNotBanned()`).toContain('isNotBanned()');
    }
  });

  it('restricts bannedUsers to own-doc get plus admin-only list/write', () => {
    const block = extractMatchBlock('bannedUsers');
    expect(block).not.toBeNull();
    expect(block).toContain('allow get: if isAdmin() || isOwner(banUid);');
    expect(block).toContain('allow list: if isAdmin();');
    expect(block).toContain('allow write: if isAdmin();');
    // The old rule let every authenticated user read the whole collection.
    expect(block).not.toContain('allow read: if isAuthenticated()');
    // The Worker reads the caller's own ban document with the caller's token;
    // the block must NOT be gated by isNotBanned or the lookup would deadlock.
    expect(block).not.toContain('isNotBanned()');
  });

  it('keeps admins exempt from the ban predicate on protected resources', () => {
    // Admin branches short-circuit before isNotBanned() is evaluated.
    expect(rulesText).toMatch(/allow read: if isAdmin\(\) \|\| \(isNotBanned\(\) && isOwner\(userId\)\)/);
    expect(rulesText).toMatch(/allow list: if isAdmin\(\);\s*\n\s*allow write: if isAdmin\(\);/);
  });

  it('keeps server-only collections closed', () => {
    for (const resource of SERVER_ONLY_RESOURCES) {
      const block = extractMatchBlock(resource);
      expect(block, `match /${resource}/ block should exist`).not.toBeNull();
      expect(block, `match /${resource}/ must stay deny-all`).toContain('allow read, write: if false;');
    }
  });

  it('keeps the pre-auth username lookup public without listing', () => {
    const block = extractMatchBlock('usernames');
    expect(block).toContain('allow get: if true;');
    expect(block).toContain('allow list: if isAdmin();');
  });
});

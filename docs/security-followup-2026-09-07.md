# Security follow-up — 7 September 2026

## Delivered controls

- S04: quota failures and malformed reservations stop protected work; Durable Objects use their supported HTTP interface.
- S05: password generation uses Web Crypto with rejection sampling and a secure shuffle. Randomness failures stop generation.
- S06: public username-to-email lookup is disabled. Login uses email; usernames are display names.
- S07: personal provider keys and assistant conversations remain in memory and reset on reload/sign-out/account switch; legacy local-storage entries are removed.
- S08: Firestore checks a timestamp expiry for Enterprise access; Worker prefers the same canonical timestamp. Existing valid expiry dates were copied without extending access.
- S09: direct client writes to the activity collection are denied. The server derives actor identity and timestamp and restricts event categories. Client-reported events are explicitly labeled; this is not a complete authoritative audit of all administrative mutations.
- S10: recent sign-in and explicit confirmation are required for resumable account deletion. A tombstone blocks further product use; owned application records, monitoring state and Authentication are removed in batches. A minimal status marker remains. External deliveries, downloads and provider backups are outside this operation.
- S11: verified email is required for normal product access, with the existing administrative exception. Firebase enforces a 12-character minimum for new passwords. Existing App Check protections remain enabled; the UI forwards attestation through the Worker to Firebase. This does not guarantee elimination of automated signups.

## Verification

- 82 frontend tests; 122 Worker tests; TypeScript checks and production build passed.
- Firebase rules compiled and six authorization simulation cases passed.
- Live synthetic account: unverified requests denied; active Enterprise team write accepted; expired entitlement denied; quota returned the free limit after expiry; forged administrative activity and foreign-UID deletion rejected; ordinary authenticated event accepted.
- Live self-deletion finished in three batches; owned profile and team returned 404 and Firebase Auth lookup confirmed account removal.
- Temporary App Check testing credential revoked. No paid plan or billing change was activated.

## Operational notes

Keep FIREBASE_ADMIN_CREDENTIALS in the Worker secret store, never in the repository. The dedicated service identity has only the approved application-data and Auth deletion permissions. Rotate/revoke its key when replacing it.

The public interface is deployed by the GitHub Pages workflow to joescan.me; the Worker and Firestore rules are deployed separately.

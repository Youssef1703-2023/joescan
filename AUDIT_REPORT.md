# JoeScan — Comprehensive Audit Report

_Audit conducted against `claude/website-comprehensive-audit-fca334` @ commit a71a741 on 2026-08-22._

---

## 1. Executive Summary

JoeScan is in a **shippable-but-fragile** state: the production build succeeds and the app loads, but the test harness is completely broken, TypeScript is not lint-clean (Cloud Functions), the Blog page ships a **2.97 MB** JS chunk on every visit, Firestore rules have several over-permissive `list` allowances that leak data across tenants, a full Paymob payment integration exists in `functions/` but is never called from the client, and the "Enterprise" 3D Threat Map is a random-number generator with no real data source. Documentation in `README.md` overstates several features.

### Top 5 things to fix now

1. **Firestore rules leak cross-user data** — `notifications`, `apiKeys`, `supportTickets`, `webhooks`, `teams`, and `referrals` all `allow list: if isAuthenticated()` without a per-user filter. Any signed-in user can enumerate everyone else's records. See §7.
2. **Tests are completely broken** — 3 test suites fail to even load because `@testing-library/dom` is missing from `package.json` despite `@testing-library/react` depending on it. `npm test` runs zero assertions. See §2.
3. **Blog chunk is 2.97 MB** (1.06 MB gzipped) because `src/data/dailyNews.json` (2.9 MB) is `import`ed statically in [`Blog.tsx:6`](src/components/Blog.tsx:6). Fetch it at runtime instead. See §8.
4. **Referral counter is exploitable** — `firestore.rules` lines 159–163 let any authenticated user increment any other user's `referralCount` by 1. See §7.
5. **Cloud Functions won't type-check** — `functions/node_modules` is not installed and `functions/src/index.ts` fails `tsc --noEmit` with 5 errors. Whole Paymob integration is also dead code (never called from client). See §2, §4.

---

## 2. Gate Results

Commands run from repo root on 2026-08-22 18:29 EEST.

| Command | Exit | Result |
|:--------|:-----|:-------|
| `npm test` (vitest run) | **1 (FAIL)** | 3 test suites failed to load. 0 tests ran. `Cannot find module '@testing-library/dom'` — required by `node_modules/@testing-library/react/dist/pure.js:46`. Files: [`server.test.ts`](server.test.ts), [`src/components/SocialOsintScanner.test.tsx`](src/components/SocialOsintScanner.test.tsx), [`src/lib/socialOsint.test.ts`](src/lib/socialOsint.test.ts). |
| `npm run lint` (tsc --noEmit) | **2 (FAIL)** | 5 errors, all in [`functions/src/index.ts`](functions/src/index.ts). App code (`src/`, `server.ts`) is clean. |
| `npm run build` (vite build) | **0 (OK)** | Built in 11.84 s. **1 warning:** `Blog-BdSA5kjb.js` chunk is **2.97 MB / 1.06 MB gz** (>650 KB limit). |

### Lint errors verbatim

```
functions/src/index.ts(1,28): error TS2307: Cannot find module 'firebase-functions' or its corresponding type declarations.
functions/src/index.ts(2,24): error TS2307: Cannot find module 'firebase-admin' or its corresponding type declarations.
functions/src/index.ts(58,28): error TS2339: Property 'token' does not exist on type 'unknown'.
functions/src/index.ts(78,31): error TS2339: Property 'id' does not exist on type 'unknown'.
functions/src/index.ts(119,36): error TS2339: Property 'token' does not exist on type 'unknown'.
```

`functions/node_modules/` does not exist — the sub-package was never `npm install`ed. The `unknown` errors are because Firebase Functions v5 changed the callable-handler signature and the code still uses the v3-style `(data, context)` args typed `any`.

---

## 3. Feature Inventory

Line counts from `wc -l`. Status legend: **REAL** = fetches real external data or runs client-side crypto; **LLM** = "OSINT result" is text hallucinated by an LLM; **MOCK** = local random/hardcoded data; **STUB** = empty function body.

| # | Feature | Files (lines) | Status | What it actually does | External deps |
|:--|:--------|:--------------|:-------|:----------------------|:--------------|
| 1 | Dashboard / Command Center | [`Dashboard.tsx`](src/components/Dashboard.tsx) (522) | REAL | Aggregates the user's own Firestore `scans` docs into a posture score, donut chart, timeline | Firestore |
| 2 | Scan History | [`ScanHistory.tsx`](src/components/ScanHistory.tsx) (339) | REAL | Lists Firestore `scans`, filter/search, per-row delete | Firestore |
| 3 | Watchlist | [`Watchlist.tsx`](src/components/Watchlist.tsx) (453) | PARTIAL | Stores asset targets in Firestore; "Sweep All" re-scans by dispatching to existing analyzers. No true "sensor" background job — nothing runs when the tab is closed. | Firestore |
| 4 | Email Audit | [`EmailAnalyzer.tsx`](src/components/EmailAnalyzer.tsx) (1038) + `gemini.ts` `analyzeEmailExposure` | REAL | Hits `api.xposedornot.com/v1/breach-analytics` for actual breach data, then formats via Groq LLM | xposedornot.com + Groq (llama-3.3-70b-versatile) |
| 5 | Password Vault | [`PasswordAnalyzer.tsx`](src/components/PasswordAnalyzer.tsx) (486) | REAL | HIBP k-anonymity: SHA-1 in-browser, sends first 5 hex chars to `api.pwnedpasswords.com/range/*`. README's "keystrokes never transmitted" claim is accurate here. | HaveIBeenPwned range API |
| 6 | Phone Number OSINT | [`PhoneAnalyzer.tsx`](src/components/PhoneAnalyzer.tsx) (354) + `analyzePhoneExposure` | LLM | `libphonenumber-js` parses/validates locally, then Groq LLM produces the "OSINT report" text. **Not real OSINT — LLM narrative.** | libphonenumber-js + Groq |
| 7 | OSINT Username | [`UsernameAnalyzer.tsx`](src/components/UsernameAnalyzer.tsx) (281) + `analyzeUsername` | LLM | Fully LLM narrative. No real cross-platform check. | Groq |
| 8 | Social OSINT | [`SocialOsintScanner.tsx`](src/components/SocialOsintScanner.tsx) (735) + [`socialOsint.ts`](src/lib/socialOsint.ts) (317) | REAL | Proxies through `server.ts` to `whatsmyname.ink` — this one **does** do real cross-platform username discovery. Only works when `server.ts` is actually deployed (see §7). | whatsmyname.ink via express relay |
| 9 | Suspicious Link | [`UrlAnalyzer.tsx`](src/components/UrlAnalyzer.tsx) (799) | REAL | Hits `urlhaus-api.abuse.ch`, `dns.google/resolve`, `ip-api.com` | urlhaus, dns.google, ip-api.com |
| 10 | Message Phishing | [`MessageAnalyzer.tsx`](src/components/MessageAnalyzer.tsx) (207) | LLM | Groq classifies pasted text; extracts URLs; delegates to UrlAnalyzer | Groq |
| 11 | IP Scan | [`IpAnalyzer.tsx`](src/components/IpAnalyzer.tsx) (420) | REAL | Cascading fallback: ipapi.co → ipwho.is → freeipapi.com | 3 IP geo APIs |
| 12 | Domain WHOIS | [`DomainLookup.tsx`](src/components/DomainLookup.tsx) (552) | REAL | RDAP query + `dns.google` for all record types + `ip-api.com` geo | RDAP, dns.google, ip-api.com |
| 13 | Browser Fingerprint | [`BrowserFingerprint.tsx`](src/components/BrowserFingerprint.tsx) (350) | REAL | Canvas/WebGL/font/plugin fingerprint entirely client-side, hits `ip-api.com` for network info | ip-api.com |
| 14 | Device Security | [`DeviceSecurityCheck.tsx`](src/components/DeviceSecurityCheck.tsx) (351) | REAL | `api64.ipify.org` for own IP → `internetdb.shodan.io/<ip>` for CVEs/ports. Real Shodan InternetDB (free tier, no key). | Shodan InternetDB |
| 15 | Live Threat Watchlist | (same as #3) | — | See row 3 |
| 16 | Threat Map (2D) | [`ThreatMap.tsx`](src/components/ThreatMap.tsx) (298) | MOCK | Randomly generated events from a hardcoded 20-city list | none |
| 17 | 3D Threat Globe (Enterprise) | [`ThreatMap3D.tsx`](src/components/ThreatMap3D.tsx) (396) | **MOCK** | `generateThreat()` at [ThreatMap3D.tsx:43-54](src/components/ThreatMap3D.tsx:43) picks `Math.random()` from `CITIES`. Zero real intel. This is gated behind the paid "Enterprise" tier. | none |
| 18 | Cybersecurity Blog | [`Blog.tsx`](src/components/Blog.tsx) (549) + [`blogArticles.ts`](src/data/blogArticles.ts) (913) + [`dailyNews.json`](src/data/dailyNews.json) (2.9 MB) | REAL | Static articles + daily auto-fetched news pipeline. See §9. | GitHub Actions cron |
| 19 | Cyber Assistant chatbot | [`CyberAssistant.tsx`](src/components/CyberAssistant.tsx) (669) | REAL | OpenRouter → `gpt-oss-120b` free model (per commit `401d937`). Prior Groq wiring still present in `gemini.ts`. | OpenRouter |
| 20 | Pricing / Checkout | [`Pricing.tsx`](src/components/Pricing.tsx), [`CheckoutModal.tsx`](src/components/CheckoutModal.tsx) (259) | PARTIAL | Checkout just opens a WhatsApp message telling the team to contact you ([CheckoutModal.tsx:100](src/components/CheckoutModal.tsx:100)). **No online payment.** The Paymob functions in `functions/src/index.ts` are never called from client. | manual/WhatsApp |
| 21 | Admin Dashboard | [`AdminDashboard.tsx`](src/components/AdminDashboard.tsx) (1020) | REAL | Admin-only (`joetech.dev.systems@gmail.com`) view over Firestore | Firestore |
| 22 | MFA (TOTP) | [`MfaGuard.tsx`](src/components/MfaGuard.tsx) (321) | REAL | `otplib` + `qrcode.react`, per-device `localStorage` gate | otplib |
| 23 | SIEM / Webhooks | [`SiemWebhooks.tsx`](src/components/SiemWebhooks.tsx) (236) | PARTIAL | Stores webhook URLs & secrets in Firestore, but **nothing dispatches** to them on the client (a real SIEM push needs a server-side fan-out, which doesn't exist). | Firestore |
| 24 | Team Management | [`TeamManagement.tsx`](src/components/TeamManagement.tsx) (215) | PARTIAL | Firestore `teams` collection, but no seat enforcement or team-scoped data. Tier gates who sees the tab, not what they can do. | Firestore |
| 25 | Referral System | [`ReferralSystem.tsx`](src/components/ReferralSystem.tsx) (483) | REAL — EXPLOITABLE | Codes + counters in Firestore. See §7 for the increment-anyone bug. | Firestore |
| 26 | API Keys Panel | [`ApiKeysPanel.tsx`](src/components/ApiKeysPanel.tsx) (160) | REAL — LEAKY | Stored in Firestore; `list` rule allows any auth user. See §7. | Firestore |
| 27 | Push Notifications | [`PushNotifSettings.tsx`](src/components/PushNotifSettings.tsx) (154) | PARTIAL | Prefs stored in Firestore, but no service-worker `push` subscription/dispatch pipeline. Feature is settings-only. | Firestore |
| 28 | Support Tickets | [`SupportTickets.tsx`](src/components/SupportTickets.tsx) (192) | REAL | Firestore-backed | Firestore |
| 29 | Referral banner / SOC trial | [`SocTrialBanner.tsx`](src/components/SocTrialBanner.tsx) (179) | REAL | Toggles user to `enterprise` tier for 3 days | Firestore |
| 30 | Onboarding tour | [`OnboardingTour.tsx`](src/components/OnboardingTour.tsx) (283) | REAL | First-visit flag in `localStorage` | none |
| 31 | Command palette / shortcuts | [`CommandPalette.tsx`](src/components/CommandPalette.tsx), [`KeyboardShortcuts.tsx`](src/components/KeyboardShortcuts.tsx) | REAL | Ctrl+K nav | none |
| 32 | i18n (7 languages) | [`LanguageContext.tsx`](src/contexts/LanguageContext.tsx) | REAL | en/ar/fr/de/es/tr/ru, RTL for Arabic | none |
| 33 | Cyber Academy (README claim) | — | **MISSING** | Only a `completedLessons` field in the user profile. **No lesson UI, no lesson data.** README lists it as an Enterprise feature. |  |

### README vs. reality gaps

- README: _"3D Threat Map Visualizer"_ (Enterprise perk) → in reality a `Math.random()` demo.
- README: _"SIEM / Webhook Integration"_ → stores config, does not dispatch.
- README: _"Cyber Academy"_ → not implemented.
- README: _"Continuous 24/7"_ watchlist monitoring for enterprise → nothing runs when the tab is closed.
- README: _"Password Vault … Zero-Network Architecture"_ → accurate for HIBP part; the `analyzePasswordExposure` function in [`gemini.ts:88`](src/lib/gemini.ts:88) would send the password to Groq if called, but PasswordAnalyzer does **not** call it, so no leak in practice — but the dead code is misleading and should be removed. `src/lib/PasswordAnalyzerLogic.ts` is a 1-line empty stub.

---

## 4. What's Broken

### 4.1 Blockers

- **Tests non-functional** (all 3 suites): missing `@testing-library/dom` in `package.json`. Fix: `npm i -D @testing-library/dom`. See §2.
- **Cloud Functions won't type-check** and haven't been installed. `functions/node_modules/` doesn't exist. Fix: `cd functions && npm ci`, then update the callable signature to Functions v5 style. See §2.
- **Paymob is dead code.** [`functions/src/index.ts`](functions/src/index.ts) exports `createPaymentToken` and `paymobWebhook`, but `grep -rn 'createPaymentToken' src/` returns zero hits. The client's `CheckoutModal` at [`CheckoutModal.tsx:100`](src/components/CheckoutModal.tsx:100) sends users to WhatsApp instead. Either wire up the calls or delete `functions/`.

### 4.2 Data / correctness

- **Mixed-content risk:** [`DomainLookup.tsx:197`](src/components/DomainLookup.tsx:197), [`UrlAnalyzer.tsx:386`](src/components/UrlAnalyzer.tsx:386), and [`BrowserFingerprint.tsx:138`](src/components/BrowserFingerprint.tsx:138) call `http://ip-api.com/json/...` from HTTPS pages. Browsers will block these silently. Swap for the HTTPS `ipwho.is` or `ipapi.co` variants (already used elsewhere) or the paid HTTPS ip-api endpoint.
- **testConnection() on every load:** [`firebase.ts:17-26`](src/lib/firebase.ts:17) blindly reads a `test/connection` doc from Firestore on every module import. That doc probably doesn't exist → wasted RTT + a warning log on every session. Delete it.
- **`analyzePasswordExposure` sends plaintext to LLM if ever called** — currently unused, but the function at [`gemini.ts:88-127`](src/lib/gemini.ts:88) interpolates the password into the prompt string. It should be deleted, or documented as "hash first."
- **`PasswordAnalyzerLogic.ts` is a stub** (`export function analyzePasswordExposure() { /* We'll define... */ }`) — dead file.

### 4.3 Dead / unreachable code

- Whole `functions/` package (see above).
- [`src/lib/PasswordAnalyzerLogic.ts`](src/lib/PasswordAnalyzerLogic.ts) — 6-line empty stub.
- [`gemini.ts:88`](src/lib/gemini.ts:88) `analyzePasswordExposure` — declared, unused.
- `IntelligenceReport.tsx` (198 lines) — no importers found via App.tsx lazy list.
- `EmailVerificationGuard.tsx` (143 lines) — the commit `eb2c897 fix: remove email verification guard` removed the guard but left the file. Dead.

### 4.4 UI / UX regressions

- **Settings dropdown escape:** [`App.tsx:305-355`](src/App.tsx:305) uses `document.getElementById(...).classList.toggle('hidden')` for the settings dropdown and relies on `onMouseLeave` to close. On mobile there's no mouse-leave, so the panel stays open until reload. Should be state-driven and click-outside-to-close.
- **`useEffect` at [`App.tsx:102`](src/App.tsx:102) has empty deps `[]` but reads `user` and `activeTab` inside** → the closure captures stale values. React 19 dev may warn.

---

## 5. Suggested New Features (ranked)

Impact/effort scale: **Impact** = 1–5 (5 = flagship), **Effort** = S (< 1 day), M (1–3 days), L (> 3 days).

| # | Priority | Feature | Why | Sketch | Impact | Effort |
|:--|:---------|:--------|:----|:-------|:-------|:-------|
| 1 | **P0** | **Wire up Paymob payments (or a Stripe payment link)** | `functions/` is already 90 % there; without it the "Enterprise" tier can't self-serve. | Fix `functions/` gates; add `httpsCallable(functions, 'createPaymentToken')` to CheckoutModal; enable Firebase emulator for local test. | 5 | M |
| 2 | **P0** | **Real Threat Map data source** | The current 3D globe is a random-number generator behind a paid tier — reputational risk. Even 4-hour lag from a free feed (e.g. abuse.ch URLhaus recent, AlienVault OTX pulses) is a huge upgrade. | New `src/lib/threatFeed.ts` fetching URLhaus recent-URLs CSV, mapping to lat/lng via `ip-api.com`. Fall back to the current mock when feed is down. | 5 | M |
| 3 | **P0** | **Server-side Watchlist "sensor"** | README claims 24/7 monitoring — deliver it. | New scheduled Cloud Function `sweepWatchlist` runs hourly, iterates users' watchlist, calls the same analyzers server-side, writes results back to Firestore, fires webhooks. | 5 | L |
| 4 | **P0** | **Fix the Referral exploit + list-scoping in rules** | Security. See §7. | Rewrite `firestore.rules` to scope every `list` to `resource.data.ownerId == request.auth.uid`. Use a Cloud Function transaction for `referralCount` increment. | 5 | S |
| 5 | **P1** | **Push notifications actually push** | `PushNotifSettings.tsx` collects prefs but nothing sends. Big trust win. | Firebase Cloud Messaging: request permission → save token per user → Cloud Function triggers on high-risk scan or watchlist hit. | 4 | M |
| 6 | **P1** | **CSV / JSON bulk export of Scan History** | `ScanHistory.tsx` has an "EXPORT" button that today just downloads the whole PDF. A CSV/JSONL export is 30 lines and unlocks SOC use-cases. | Add `exportScansCsv(scans)` util in `src/lib/`, wire the existing button. | 3 | S |
| 7 | **P1** | **Rate-limit + App-Check on every callable and every OSINT relay** | Groq/OpenRouter keys are `VITE_*` env vars → they ship to the browser. Any user can strip them from the bundle. Move LLM calls behind a Cloud Function with App Check. | New `analyzeCallable` function that proxies to Groq/OpenRouter server-side. | 4 | M |
| 8 | **P1** | **Certificate-transparency lookup** for Domain WHOIS | Uses free `crt.sh` API — surfaces sub-domains and issued certs. Common OSINT ask. | Add a "Certificate History" panel in `DomainLookup.tsx`. | 3 | S |
| 9 | **P1** | **Email header / EML forensics tool** | Paste a raw email header → parse Received chain, SPF/DKIM/DMARC alignment, geolocate hops. LLM-free, deterministic. | New `EmailHeaderAnalyzer.tsx` + `mailparser` or a hand-rolled parser. | 4 | M |
| 10 | **P1** | **File / hash lookup (VirusTotal / MalwareBazaar)** | Users can drag a file → SHA-256 in-browser → free MB API returns any known malware family. Pairs with Message Phishing. | New tab; `crypto.subtle.digest` + `mb-api.abuse.ch/api/v1/`. | 4 | S |
| 11 | **P2** | **Cyber Academy** (delivered, not just a field) | README already promises it. | Markdown-driven lessons under `src/data/lessons/*.md`, progress via existing `completedLessons` array. | 3 | M |
| 12 | **P2** | **Public shareable scan-report pages** | Convert a Firestore scan doc into a `/report/:id` public page with OG image → viral loop. | Firestore rule `allow read: if resource.data.public == true`; new route; existing PDF becomes OG preview. | 3 | M |
| 13 | **P2** | **Chrome/Firefox extension** — right-click a link/email to scan | Distribution multiplier. Same APIs, thin wrapper. | Manifest v3 extension calling the same endpoints. | 3 | L |
| 14 | **P2** | **Dark-web keyword monitor** via IntelligenceX or Dehashed proxy | Enterprise-tier upsell. | Cloud Function only; UI similar to Watchlist. | 3 | L |
| 15 | **P2** | **Passkey (WebAuthn) sign-in** | Firebase supports it. Replaces the DIY TOTP flow with a stronger, friction-free option. | Firebase Auth passkey; keep MFA for legacy. | 3 | M |

---

## 6. Code Quality & Architecture

- **Analyzer duplication.** [`EmailAnalyzer.tsx`](src/components/EmailAnalyzer.tsx) (1038 lines), [`UrlAnalyzer.tsx`](src/components/UrlAnalyzer.tsx) (799), [`SocialOsintScanner.tsx`](src/components/SocialOsintScanner.tsx) (735), [`CyberAssistant.tsx`](src/components/CyberAssistant.tsx) (669), [`ProfileSettings.tsx`](src/components/ProfileSettings.tsx) (658), [`DomainLookup.tsx`](src/components/DomainLookup.tsx) (552), [`Blog.tsx`](src/components/Blog.tsx) (549), and [`Dashboard.tsx`](src/components/Dashboard.tsx) (522) each repeat the same skeleton: input state → `handleScan` with try/catch/loading → `addDoc` to Firestore → `MiniHistory`. Extract a `useAnalyzer<TResult>({ scanFn, type })` hook — you'd shed >1000 lines.
- **`AdminDashboard.tsx`** (1020) is a single monolithic file. Split into `AdminDashboard/{Users,Tickets,Broadcast,ApiKeys,ActivityLog}.tsx`.
- **`gemini.ts`** (583 lines) is misnamed — it hasn't used Gemini in months. Rename to `aiProviders.ts`. `executeUniversalAI` says _"Always use built-in Groq Llama 3"_ but the file imports `@google/genai` which now only supplies the `Type` enum. Remove the dep.
- **No error boundary.** A single throw inside any lazy component bubbles to a white screen. Wrap `Suspense` with a `<ErrorBoundary>` in [`App.tsx:400`](src/App.tsx:400).
- **`useEffect` empty-deps closures** (App.tsx:102, various analyzers) hold stale `user` — see §4.4.
- **No tests for critical paths.** Only three test files exist ([`server.test.ts`](server.test.ts), [`SocialOsintScanner.test.tsx`](src/components/SocialOsintScanner.test.tsx), [`socialOsint.test.ts`](src/lib/socialOsint.test.ts)) — and none of them run. Missing test coverage for: Firebase auth flow, tier gates, ban/maintenance mode, Firestore rule contracts, PDF generation, LLM JSON schema fallbacks.
- **`dangerouslySetInnerHTML` in Blog articles** — check that `blogArticles.ts` HTML strings and `dailyNews.json` content are trusted (they are — auto-generated) and that `DOMPurify` (already bundled — `purify.es-*.js` is in the build) is used consistently.

---

## 7. Security Review

### 7.1 Firestore rules (`firestore.rules`) — cross-tenant leaks

Any signed-in user can enumerate these collections:

| Collection | Line | Rule | Risk |
|:-----------|:-----|:-----|:-----|
| `notifications` | 82 | `allow list: if isAuthenticated()` | Every user's notifications listable. |
| `supportTickets` | 108 | `allow list: if isAdmin() \|\| isAuthenticated()` | Every user's support tickets listable. |
| `apiKeys` | 116 | `allow list: if isAuthenticated()` | **API keys of all users listable.** |
| `webhooks` | 132 | `allow list: if isAuthenticated()` | Every enterprise's webhook config + secret listable. |
| `teams` | 137, 140 | `allow read/list: if isAuthenticated()` | Team memberships listable. |
| `usernames` | 58 | `allow read: if true` | Public — acceptable if intended as a unique-username registry, but confirm. |
| `bannedUsers` | 99 | `allow read: if isAuthenticated()` | Anyone can enumerate who's banned. |
| `referrals` | 157 | `allow read: if isAuthenticated()` | Anyone can see all referral counts. |

**Fix:** Firestore `list` cannot be conditioned on `resource.data`, so you have to combine (a) a rule that requires the query itself to filter by owner, and (b) a Firestore query that always includes `.where('userId', '==', uid)`. Example for `apiKeys`:

```
allow list: if isAuthenticated() && request.query.where.userId == request.auth.uid;
```

Every client-side query has to be updated to include the `where` clause.

### 7.2 Exploitable referral counter

[`firestore.rules:159-163`](firestore.rules:159):

```
allow update: if isAuthenticated() && (
  request.auth.uid == userId ||
  (request.resource.data.diff(resource.data).affectedKeys().hasOnly(['referralCount']) &&
   request.resource.data.referralCount == resource.data.referralCount + 1)
);
```

Any authenticated user can call `updateDoc(doc(db, 'referrals', ANY_UID), { referralCount: previous + 1 })` — the rule only checks the delta is +1, not that the caller is entitled to it. If `referralCount` unlocks tier upgrades, users can farm it. Move the increment into a Cloud Function that validates the referral chain with `admin.firestore().runTransaction()`.

### 7.3 Client-visible secrets

Environment variables prefixed `VITE_` are inlined into the bundle by Vite. `deploy.yml` sets `VITE_GROQ_API_KEY` and `VITE_OPENROUTER_API_KEY` — **both keys ship to every user's browser**. Anyone can `grep` them out of the JS chunks and burn your quota. Proxy AI calls through a Cloud Function; keep the keys server-side.

Also: `firebase-applet-config.json` (Firebase Web API key) is a *public* identifier by design — that's fine — but the reCAPTCHA v3 site key at [`firebase.ts:10`](src/lib/firebase.ts:10) should be moved to `VITE_RECAPTCHA_SITE_KEY` for hygiene.

### 7.4 `server.ts`

- No rate limiting. The `/api/social-osint/search` endpoint proxies to `whatsmyname.ink` with `USERNAME_PATTERN = /^[a-zA-Z0-9._-]{1,50}$/` — good input validation, but a bot can hammer it.
- No CORS restriction — if this ever gets deployed publicly, other origins can piggyback on your rate limit at `whatsmyname.ink`.
- Fixes: add `express-rate-limit`, a strict CORS allowlist, and App Check verification (Firebase Admin SDK can verify the App Check token in `req.headers['X-Firebase-AppCheck']`).

### 7.5 XSS

`purify.es-*.js` is in the build tree, suggesting DOMPurify is loaded — good. Grep for `dangerouslySetInnerHTML` and confirm every use passes through `DOMPurify.sanitize()`. Especially the daily-news articles (attacker-controllable via a compromised RSS feed).

### 7.6 App Check

`initializeAppCheck` runs unconditionally on import at [`firebase.ts:9`](src/lib/firebase.ts:9). That only helps if App Check *enforcement* is turned on in the Firebase console for Firestore and Cloud Functions. Verify: Firebase console → App Check → each service should say "Enforced," not "Unenforced."

---

## 8. Performance & Bundle

Vite chunks after `npm run build`:

| Chunk | Raw | Gzip | Note |
|:------|----:|-----:|:-----|
| `Blog-*.js` | **2 972 KB** | **1 058 KB** | 🔴 Blog imports the 2.9 MB `dailyNews.json` statically. |
| `vendor-pdf-*.js` | 625 KB | 187 KB | `jspdf` + `jspdf-autotable`. Only used for report export. |
| `vendor-charts-*.js` | 417 KB | 118 KB | `recharts` — only Dashboard. |
| `vendor-firebase-firestore-*.js` | 397 KB | 92 KB | Unavoidable. |
| `index-*.js` | 228 KB | 79 KB | App shell. |
| `vendor-ai-*.js` | 165 KB | 45 KB | `@google/genai` + `openai` SDKs. |

### Actions (biggest first)

1. **Fetch `dailyNews.json` at runtime** instead of `import`ing it. Change [`Blog.tsx:6`](src/components/Blog.tsx:6):
   ```ts
   // Was: import dailyNewsData from '../data/dailyNews.json';
   const [dailyNewsData, setDailyNewsData] = useState({articles: [], lastUpdated: null});
   useEffect(() => { fetch('/dailyNews.json').then(r => r.json()).then(setDailyNewsData); }, []);
   ```
   Move `dailyNews.json` to `public/`. Saves 2.9 MB from the first Blog visit; served with `Cache-Control` it also caches independently of the JS.
2. **Lazy-load `jspdf`** — dynamic-import it inside `generateReportPDF` so the 625 KB PDF vendor chunk only loads when a user actually exports.
3. **Delete `@google/genai` from deps.** Only the `Type` enum is used; rebuild those constants inline. Saves \~100 KB pre-gzip.
4. **Delete `html2canvas` + `html-to-image`** — grep for their usages first; `html-to-image` may be substitutable for `html2canvas` (they overlap).
5. **`Blog.tsx` renders 27 static articles + all daily-news content** in the same DOM. Consider virtualized list for the >100-article steady-state.

### PWA / Service Worker

`vite-plugin-pwa` is a devDep and [`useServiceWorker.ts`](src/hooks/useServiceWorker.ts) exists — confirm the plugin is wired in `vite.config.ts` (it isn't imported there — 40 % likely the PWA is dead). If the goal is offline analyzer support, precache the static analyzers but exclude `dailyNews.json`.

---

## 9. CI / Automation Health

### `daily-news.yml`

- Runs at `0 5 * * *` UTC (8 AM Cairo). ✅ Working — commit history shows daily runs since Jan.
- **Concern:** the workflow commits a 2.9 MB file to `main` every day. Git object storage grows unboundedly. Consider (a) squashing the news file to the tip in a separate `news` branch consumed by CI, or (b) moving the news store to Firestore and dropping the commit from the pipeline.
- Uses `npm install --legacy-peer-deps` — a lockfile-drift warning sign. Reproduce and pin.
- No failure notification. If the Google Translate free endpoint changes shape, the job fails silently until someone notices the news went stale.

### `deploy.yml`

- Sets `VITE_GROQ_API_KEY` and `VITE_OPENROUTER_API_KEY`. See §7.3 — those keys are baked into the shipped JS. This is a distribution problem, not a CI problem, but the workflow is where the choice lives.

---

## 10. Appendix — Raw command output tails

### `npm test`

```
 RUN  v3.2.4 D:/joeScan/.claude/worktrees/website-comprehensive-audit-fca334

⎯⎯⎯⎯⎯⎯ Failed Suites 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  server.test.ts [ server.test.ts ]
 FAIL  src/components/SocialOsintScanner.test.tsx [ src/components/SocialOsintScanner.test.tsx ]
 FAIL  src/lib/socialOsint.test.ts [ src/lib/socialOsint.test.ts ]
Error: Cannot find module '@testing-library/dom'
Require stack:
- D:\joeScan\.claude\worktrees\website-comprehensive-audit-fca334\node_modules\@testing-library\react\dist\pure.js
 ❯ Object.<anonymous> node_modules/@testing-library/react/dist/pure.js:46:12

 Test Files  3 failed (3)
      Tests  no tests
   Duration  1.39s
```

### `npm run lint`

```
functions/src/index.ts(1,28): error TS2307: Cannot find module 'firebase-functions' or its corresponding type declarations.
functions/src/index.ts(2,24): error TS2307: Cannot find module 'firebase-admin' or its corresponding type declarations.
functions/src/index.ts(58,28): error TS2339: Property 'token' does not exist on type 'unknown'.
functions/src/index.ts(78,31): error TS2339: Property 'id' does not exist on type 'unknown'.
functions/src/index.ts(119,36): error TS2339: Property 'token' does not exist on type 'unknown'.
```

### `npm run build` (tail)

```
dist/assets/vendor-charts-ocu0k3nw.js              417.14 kB │ gzip:   118.75 kB
dist/assets/vendor-pdf-hhwoouEw.js                 625.33 kB │ gzip:   186.80 kB
dist/assets/Blog-BdSA5kjb.js                     2,972.53 kB │ gzip: 1,058.56 kB

(!) Some chunks are larger than 650 kB after minification.
✓ built in 11.84s
```

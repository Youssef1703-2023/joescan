# JoeScan — Comprehensive Audit Report (agy / gemini-3.7-flash-high)

_Audit conducted on 2026-08-22 across the JoeScan React 19 + TypeScript + Vite repository._

---

## 1. Executive Summary

JoeScan is a feature-packed, visually striking cybersecurity and OSINT web platform built on React 19, TypeScript, Tailwind CSS, and Firebase. While the production build succeeds (`vite build` exit 0), the repository is in a **partially fragile and unmonitored state**: the test harness is entirely non-functional due to a missing peer dependency, TypeScript type checking fails due to Cloud Functions compilation issues, client-side JavaScript bundles leak API keys directly to end users, Firestore security rules contain severe cross-tenant data leaks and allow self-privilege escalation to Enterprise tier, and several marquee features (3D Threat Globe, Social OSINT, Phone Exposure) rely on `Math.random()` or LLM hallucinations rather than genuine telemetry or OSINT feeds. Additionally, the Blog module imports a 2.91 MB static JSON dataset directly into the client bundle, producing a 2.97 MB JavaScript chunk on initial blog navigation.

### Top 5 Things to Fix Immediately

1. **Fix Critical Firestore Security Holes & Tier Self-Escalation** — [`firestore.rules:52`](firestore.rules#L52) allows any authenticated user to update their own `tier` to `enterprise` without restriction. Furthermore, lines [`82`](firestore.rules#L82), [`108`](firestore.rules#L108), [`116`](firestore.rules#L116), [`132`](firestore.rules#L132), and [`140`](firestore.rules#L140) allow any logged-in user to `list` all users' API keys, support tickets, notifications, webhooks, and team records.
2. **Move Exposed AI Secrets to a Backend Proxy** — [`.github/workflows/deploy.yml:35-36`](.github/workflows/deploy.yml#L35-L36) injects `VITE_GROQ_API_KEY` and `VITE_OPENROUTER_API_KEY` into the frontend build. Anyone visiting `joescan.me` can extract these plain keys from the client JS chunks.
3. **Repair Broken Vitest Test Suite** — `npm test` fails immediately across all 3 test suites because `@testing-library/dom` is missing from `devDependencies` in [`package.json:45-62`](package.json#L45-L62), blocking all automated verification.
4. **Decouple 2.91 MB `dailyNews.json` from Blog Bundle** — [`src/components/Blog.tsx:6`](src/components/Blog.tsx#L6) statically imports `src/data/dailyNews.json`, inflating the `Blog-*.js` chunk to **2,972.53 kB** (1,058.56 kB gzip). Moving it to `public/` and loading via runtime `fetch()` will reduce the JS chunk size by >98%.
5. **Fix Cloud Functions TypeScript Build & Resolve Paymob Dead Code** — Root `tsc --noEmit` fails on [`functions/src/index.ts:1-120`](functions/src/index.ts#L1-L120) because functions dependencies are uninstalled at root, and Firebase Functions v5 callable signatures changed. Concurrently, the backend Paymob integration is disconnected from the client, which sends users to WhatsApp instead.

---

## 2. Gate Results

Commands executed on the clean repository workspace:

| Gate | Command | Exit Code | Status | Summary |
|:-----|:--------|:---------:|:------:|:--------|
| **Install** | `npm ci` | `0` | **PASS** | 338 packages installed cleanly from `package-lock.json`. |
| **Lint / Type Check** | `npm run lint` (`tsc --noEmit`) | `1` | **FAIL** | 5 errors found in [`functions/src/index.ts`](functions/src/index.ts). Frontend `src/` and `server.ts` are type-clean. |
| **Unit Tests** | `npm test` (`vitest run`) | `1` | **FAIL** | 3 test suites failed during module resolution before running 0 tests. Missing module `@testing-library/dom`. |
| **Production Build** | `npm run build` (`vite build`) | `0` | **PASS (WARN)** | Built 3,301 modules in 11.63s. Emitted bundle size warning (>650 kB) for `Blog-*.js` (2,972.53 kB). |

### Verbatim Failures

#### `npm run lint` (`tsc --noEmit`)
```text
functions/src/index.ts(1,28): error TS2307: Cannot find module 'firebase-functions' or its corresponding type declarations.
functions/src/index.ts(2,24): error TS2307: Cannot find module 'firebase-admin' or its corresponding type declarations.
functions/src/index.ts(58,28): error TS2339: Property 'token' does not exist on type 'unknown'.
functions/src/index.ts(78,31): error TS2339: Property 'id' does not exist on type 'unknown'.
functions/src/index.ts(119,36): error TS2339: Property 'token' does not exist on type 'unknown'.
```
*Root cause:* `tsconfig.json` at repo root has no `"include"` or `"exclude"` block, causing `tsc` to scan `functions/src/index.ts` where dependencies (`firebase-functions`, `firebase-admin`) reside in `functions/package.json` rather than the root `node_modules`. Additionally, Firebase Functions v5 changed callable signatures where untyped fetch responses require explicit type assertion.

#### `npm test` (`vitest run`)
```text
⎯⎯⎯⎯⎯⎯ Failed Suites 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  server.test.ts [ server.test.ts ]
 FAIL  src/components/SocialOsintScanner.test.tsx [ src/components/SocialOsintScanner.test.tsx ]
 FAIL  src/lib/socialOsint.test.ts [ src/lib/socialOsint.test.ts ]
Error: Cannot find module '@testing-library/dom'
Require stack:
- D:\joeScan\.claude\worktrees\website-comprehensive-audit-fca334\node_modules\@testing-library\react\dist\pure.js
 ❯ Object.<anonymous> node_modules/@testing-library/react/dist/pure.js:46:12

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 Test Files  3 failed (3)
      Tests  no tests
```
*Root cause:* `@testing-library/react` v16 relies on `@testing-library/dom` as a peer dependency. Missing `@testing-library/dom` in `package.json` prevents `src/test/setup.ts` from loading.

---

## 3. Feature Inventory

Status Legend:
- **WORKING / REAL**: Uses real network APIs, browser hardware telemetry, or cryptographic algorithms.
- **PARTIAL**: UI works and persists data, but background processing, dispatching, or integration is incomplete.
- **LLM / MOCK-DATA**: Generates synthetic outputs via LLM narratives or `Math.random()`.
- **STUB**: Empty or non-functional placeholder logic.
- **ORPHAN**: Component code exists in `src/components/` but is never imported or mounted in the application.

| Feature Name | File(s) & Line Counts | Status | Code Reality (What It Actually Does) | External Dependencies & Keys |
|:---|:---|:---:|:---|:---|
| **Command Center (Dashboard)** | [`Dashboard.tsx`](src/components/Dashboard.tsx) (476)<br>[`SocTrialBanner.tsx`](src/components/SocTrialBanner.tsx) (161) | **WORKING / REAL** | Queries user's `scans` collection in Firestore; calculates posture score (0-100), severity breakdown donut chart, and scan timeline. | Firestore (`db`) |
| **Scan History & Detail Modal** | [`ScanHistory.tsx`](src/components/ScanHistory.tsx) (311)<br>[`IntelligenceReport.tsx`](src/components/IntelligenceReport.tsx) (183) | **WORKING / REAL** | Filterable/searchable log of user scans; renders detailed modal breakdown and triggers PDF report generation. | Firestore (`db`), `jspdf`, `jspdf-autotable` |
| **Live Threat Watchlist** | [`Watchlist.tsx`](src/components/Watchlist.tsx) (429) | **PARTIAL** | CRUD management for target assets in Firestore; "Sweep All" dispatches in-tab scans. **No 24/7 background sensor** runs when tab is closed. | Firestore (`db`), client analyzers |
| **Email Audit & Breach Scanner** | [`EmailAnalyzer.tsx`](src/components/EmailAnalyzer.tsx) (994)<br>[`gemini.ts:197-304`](src/lib/gemini.ts#L197-L304) | **WORKING / REAL** | Queries XposedOrNot breach analytics API for actual leaked records; synthesizes remediation plan via Groq LLM. | `api.xposedornot.com`, Groq API (`VITE_GROQ_API_KEY`) |
| **Password Vault Check** | [`PasswordAnalyzer.tsx`](src/components/PasswordAnalyzer.tsx) (451) | **WORKING / REAL** | Client-side SHA-1 hashing; queries HaveIBeenPwned Range API with 5-character prefix (k-anonymity). Keystrokes never sent over network. | `api.pwnedpasswords.com`, Firestore |
| **Phone Number OSINT** | [`PhoneAnalyzer.tsx`](src/components/PhoneAnalyzer.tsx) (334)<br>[`gemini.ts:129-195`](src/lib/gemini.ts#L129-L195)<br>[`socialOsint.ts:227-318`](src/lib/socialOsint.ts#L227-L318) | **PARTIAL / MOCK-DATA** | `libphonenumber-js` validates formatting; spam score is a hash modulo calculation (`Math.abs(hash) % 45`); deep scan prompts Groq LLM to simulate Google search. | `libphonenumber-js`, Groq API (`VITE_GROQ_API_KEY`) |
| **OSINT Username Search** | [`UsernameAnalyzer.tsx`](src/components/UsernameAnalyzer.tsx) (262)<br>[`gemini.ts:341-365`](src/lib/gemini.ts#L341-L365) | **LLM / NARRATIVE** | Sends username to Groq LLM to generate plausible platform matches; does not perform live network checks or profile scrapes. | Groq API (`VITE_GROQ_API_KEY`), Firestore |
| **Social Media OSINT** | [`SocialOsintScanner.tsx`](src/components/SocialOsintScanner.tsx) (686)<br>[`socialOsint.ts:1-225`](src/lib/socialOsint.ts#L1-L225) | **PARTIAL / LLM** | Generates 100+ platform URLs from internal DB, but uses Groq LLM (`searchSocialProfiles`) with simulated timer progress rather than real HTTP scraping or server relay. | Groq API (`VITE_GROQ_API_KEY`), Firestore |
| **Suspicious Link / URL Scanner** | [`UrlAnalyzer.tsx`](src/components/UrlAnalyzer.tsx) (746)<br>[`gemini.ts:314-339`](src/lib/gemini.ts#L314-L339) | **WORKING / REAL** | Checks URL against abuse.ch URLhaus API, queries Google DNS over HTTPS, resolves IP geolocation via `ipwho.is`, optional LLM summary. | `urlhaus-api.abuse.ch`, `dns.google`, `ipwho.is`, Groq API |
| **Message Phishing Detector** | [`MessageAnalyzer.tsx`](src/components/MessageAnalyzer.tsx) (192)<br>[`gemini.ts:367-400`](src/lib/gemini.ts#L367-L400) | **WORKING / REAL** | Regex URL extraction + Groq LLM (`llama-3.3-70b-versatile`) analysis of social engineering triggers, urgency markers, and spoofing. | Groq API (`VITE_GROQ_API_KEY`), Firestore |
| **IP Scanner** | [`IpAnalyzer.tsx`](src/components/IpAnalyzer.tsx) (393) | **WORKING / REAL** | Multi-provider IP geolocation and ASN lookup with fallback (`ipapi.co` -> `ipwho.is` -> `freeipapi.com`); calculates risk score. | `ipapi.co`, `ipwho.is`, `freeipapi.com`, Firestore |
| **Domain WHOIS Lookup** | [`DomainLookup.tsx`](src/components/DomainLookup.tsx) (515) | **WORKING / REAL** | Resolves DNS records (A, AAAA, MX, NS, TXT, CNAME, SOA) via Google DoH, queries RDAP (`rdap.org`), and resolves hosting server geolocation. | `rdap.org`, `dns.google`, `ipwho.is`, Firestore |
| **Browser Fingerprinting** | [`BrowserFingerprint.tsx`](src/components/BrowserFingerprint.tsx) (323) | **WORKING / REAL** | Generates unique hash from Canvas 2D render, WebGL renderer, AudioContext latency, screen specs, fonts, and plugins; gets IP via `ipwho.is`. | `ipwho.is`, Firestore |
| **Device Security Check** | [`DeviceSecurityCheck.tsx`](src/components/DeviceSecurityCheck.tsx) (340) | **WORKING / REAL** | Resolves public IP via `api64.ipify.org` and queries Shodan InternetDB (`internetdb.shodan.io`) for open ports, CPEs, and CVE vulnerabilities. | `api64.ipify.org`, `internetdb.shodan.io` (no key required) |
| **Threat Map (2D)** | [`ThreatMap.tsx`](src/components/ThreatMap.tsx) (272) | **MOCK-DATA** | Canvas map animating attack trajectories generated by `Math.random()` across 20 hardcoded cities. | None |
| **3D Threat Globe (Enterprise)** | [`ThreatMap3D.tsx`](src/components/ThreatMap3D.tsx) (357) | **MOCK-DATA** | Rotating 3D canvas globe generating random attack arcs every 2s via `Math.random()`. Sold as an Enterprise-tier feature. | None |
| **Cybersecurity Blog & News** | [`Blog.tsx`](src/components/Blog.tsx) (518)<br>[`blogArticles.ts`](src/data/blogArticles.ts) (739)<br>[`dailyNews.json`](src/data/dailyNews.json) (2,357) | **WORKING / REAL** | 27 static articles + automated daily RSS scraper output with 6-language auto-translation (EN, AR, FR, DE, ES, TR, RU). | Static JSON / GitHub Actions cron |
| **Cyber Assistant Chatbot** | [`CyberAssistant.tsx`](src/components/CyberAssistant.tsx) (611) | **WORKING / REAL** | Floating chatbot calling OpenRouter (`openai/gpt-oss-120b:free`) with cybersecurity system prompt and Arabic/English language adaptation. | OpenRouter API (`VITE_OPENROUTER_API_KEY`) |
| **Pricing & Checkout** | [`Pricing.tsx`](src/components/Pricing.tsx) (232)<br>[`CheckoutModal.tsx`](src/components/CheckoutModal.tsx) (240) | **PARTIAL** | Validates promo codes in Firestore; payment redirects to WhatsApp (`wa.me/201123343296`). Paymob Cloud Function is not connected. | WhatsApp link, Firestore (`promoCodes`) |
| **Admin Dashboard** | [`AdminDashboard.tsx`](src/components/AdminDashboard.tsx) (974) | **WORKING / REAL** | System control for `joetech.dev.systems@gmail.com`: user management, ban/unban, broadcasts, promo code CRUD, platform maintenance toggle. | Firestore (`users`, `bannedUsers`, `adminConfig`, etc.) |
| **MFA Guard (TOTP)** | [`MfaGuard.tsx`](src/components/MfaGuard.tsx) (299) | **WORKING / REAL** | TOTP setup and verification using `otplib` and `qrcode.react`; stores verification per device in `localStorage`. | `otplib`, `qrcode.react` |
| **SIEM / Webhooks (Enterprise)** | [`SiemWebhooks.tsx`](src/components/SiemWebhooks.tsx) (217) | **PARTIAL** | Stores webhook URLs & secrets in Firestore; test button is a 1.5s simulated timer. **No server or client events dispatch to webhooks.** | Firestore (`webhooks`) |
| **Team Management (Enterprise)** | [`TeamManagement.tsx`](src/components/TeamManagement.tsx) (200) | **PARTIAL** | Stores invited emails in Firestore `teams`. No invitation emails sent, no team data sharing, and no RBAC enforcement across scans. | Firestore (`teams`) |
| **Referral System** | [`ReferralSystem.tsx`](src/components/ReferralSystem.tsx) (456) | **WORKING (EXPLOITABLE)** | Generates referral codes, tracks signups, leaderboard, tier rewards. Setting 10 referrals sets invalid tier `'vip'`. | Firestore (`referrals`), `canvas-confetti` |
| **API Keys Panel** | [`ApiKeysPanel.tsx`](src/components/ApiKeysPanel.tsx) (146) | **ORPHAN** | Component creates and lists API keys in Firestore `apiKeys`. Not imported in `App.tsx` or linked in `Sidebar.tsx`. | Firestore (`apiKeys`) |
| **Support Tickets** | [`SupportTickets.tsx`](src/components/SupportTickets.tsx) (180) | **ORPHAN** | User ticket creation UI. Not imported or mounted in `App.tsx` or `Sidebar.tsx`. | Firestore (`supportTickets`) |
| **Push Notification Settings** | [`PushNotifSettings.tsx`](src/components/PushNotifSettings.tsx) (140) | **PARTIAL** | Saves user preferences to Firestore `notifPrefs`. Lacks FCM background service worker registration and push dispatch. | Firestore (`notifPrefs`) |
| **Profile Settings & Badges** | [`ProfileSettings.tsx`](src/components/ProfileSettings.tsx) (620)<br>[`BadgeSystem.tsx`](src/components/BadgeSystem.tsx) (181) | **WORKING / REAL** | Manages displayName, custom avatars, achievement badges based on scan counts, and triggers SW update check. | Firestore (`users`) |
| **Command Palette & Shortcuts** | [`CommandPalette.tsx`](src/components/CommandPalette.tsx) (188)<br>[`KeyboardShortcuts.tsx`](src/components/KeyboardShortcuts.tsx) (50) | **WORKING / REAL** | Global Ctrl+K navigation modal and single-key shortcuts for rapid tab switching. | None |
| **Onboarding Tour** | [`OnboardingTour.tsx`](src/components/OnboardingTour.tsx) (263) | **WORKING / REAL** | Step-by-step interactive walkthrough for first-time sign-ins, saved to `localStorage`. | None |
| **Internationalization (i18n)** | [`LanguageContext.tsx`](src/contexts/LanguageContext.tsx) (592) | **WORKING / REAL** | Full translations across 7 languages (EN, AR, FR, DE, ES, TR, RU) with automatic RTL styling for Arabic. | None |
| **Cyber Academy** | *N/A (README claim)* | **MISSING / STUB** | README promises an Enterprise Cyber Academy. Only an empty `completedLessons` array exists in the user profile; no lessons or UI exist. | None |

### README vs. Reality Discrepancies

1. **"3D Threat Map Visualizer (Enterprise)"** → README portrays this as an enterprise-grade live cyber threat visualizer. In reality, [`ThreatMap3D.tsx:43-54`](src/components/ThreatMap3D.tsx#L43-L54) executes `Math.random()` on a 20-city static array.
2. **"Continuous 24/7 Watchlist Monitoring"** → README claims continuous round-the-clock sensor monitoring for enterprise assets. In reality, scans only execute when the user manually clicks "Sweep All" in an active browser tab.
3. **"SIEM / Webhook Integration"** → README claims automated security event export to SIEM platforms. In reality, webhooks are only saved as documents in Firestore; no dispatcher triggers on scan events.
4. **"Cyber Academy"** → README lists this under Enterprise capabilities. No lesson UI or lesson content exists in the codebase.
5. **"Zero-Network Password Architecture"** → README claim is **accurate**: [`PasswordAnalyzer.tsx`](src/components/PasswordAnalyzer.tsx) hashes locally and uses HIBP k-anonymity range queries.

---

## 4. What's Broken

### 4.1 Compilation, Build & Test Failures

- **Missing `@testing-library/dom` breaks all Vitest suites** ([`package.json:45-62`](package.json#L45-L62), [`src/test/setup.ts:3`](src/test/setup.ts#L3)): `npm test` fails immediately on module resolution.
- **Root TypeScript check fails on Cloud Functions** ([`functions/src/index.ts:1-2, 58, 78, 119`](functions/src/index.ts#L1-L2)): Root `tsconfig.json` lacks an `exclude: ["functions"]` directive, causing `npm run lint` to fail on missing subpackage dependencies and v5 callable handler signatures.

### 4.2 Runtime Landmines & Data Correctness

- **Unconditional Firestore Connection Check on Load** ([`src/lib/firebase.ts:17-26`](src/lib/firebase.ts#L17-L26)): `testConnection()` executes on module import, issuing an unneeded `getDocFromServer(doc(db, 'test', 'connection'))` request on every page load, generating a redundant network round-trip and console warnings if offline.
- **Stale Closure in App.tsx `useEffect`** ([`src/App.tsx:102`](src/App.tsx#L102)): `useEffect` with empty dependency array `[]` references `user` inside `onAuthStateChanged`, capturing a stale initial `null` reference.
- **Invalid `'vip'` Tier in Referral Claim** ([`src/components/ReferralSystem.tsx:153, 161`](src/components/ReferralSystem.tsx#L153)): Claiming tier 10 sets `tier: 'vip'` on the Firestore user document. Because [`src/lib/firebase.ts:58`](src/lib/firebase.ts#L58) only recognizes `'free' | 'pro' | 'enterprise'`, user navigation gates fail to recognize the tier, causing the user to lose Pro/Enterprise privileges.
- **Outdated Test Mocks in `socialOsint.test.ts`** ([`src/lib/socialOsint.test.ts:21-56`](src/lib/socialOsint.test.ts#L21-L56)): Tests mock an older Express relay API (`/api/social-osint/search`), whereas [`src/lib/socialOsint.ts:6, 176`](src/lib/socialOsint.ts#L6) now calls `searchSocialProfiles` from `gemini.ts`.
- **LLM Prompts Expecting Live Google Search** ([`src/lib/gemini.ts:457-582`](src/lib/gemini.ts#L457-L582)): Prompts for `searchSocialProfiles` and `searchPhoneProfiles` instruct the model: *"USE GOOGLE SEARCH to verify real profiles"*. However, [`executeUniversalAI`](src/lib/gemini.ts#L31-53) routes to Groq `llama-3.3-70b-versatile` without tool calling or search grounding, causing the model to hallucinate profile URLs.

### 4.3 Dead & Unreferenced Code

- **`src/components/Auth.tsx`** (64 lines): Deprecated login component, replaced by `AuthModal.tsx` and `LandingPage.tsx`.
- **`src/components/EmailVerificationGuard.tsx`** (130 lines): Unused guard component.
- **`src/components/NotFound.tsx`** (51 lines): Standalone 404 component not connected to SPA routing.
- **`src/components/ApiKeysPanel.tsx`** (146 lines): Complete API keys management component, orphan in codebase.
- **`src/components/SupportTickets.tsx`** (180 lines): Complete support ticket component, orphan in codebase.
- **`src/lib/PasswordAnalyzerLogic.ts`** (7 lines): Empty stub file (`// We'll define the prompt and call Gemini here`).
- **`src/lib/sanitize.ts`** (75 lines): Input sanitization utility with 8 exported functions, imported by zero components.
- **`src/lib/gemini.ts:15-17`**: `getGeminiClient()` and `GoogleGenAI` import from `@google/genai` are completely unused; all AI execution is hardcoded to Groq OpenAI client.
- **`src/lib/gemini.ts:88-127`**: `analyzePasswordExposure()` declared but never invoked.
- **`functions/src/index.ts:38-214`**: Paymob token creation and webhook handler are dead code (never called from frontend).

### 4.4 UI & UX Flaws

- **Settings Dropdown Touch Bug** ([`src/App.tsx:305-319`](src/App.tsx#L305-L319)): Settings menu relies on `document.getElementById('joescan-settings-dropdown').classList.toggle('hidden')` and closes on `onMouseLeave`. On mobile touchscreens, `onMouseLeave` does not trigger, causing the dropdown to remain permanently open over the viewport.
- **Late Service Worker Registration** ([`src/components/ProfileSettings.tsx:22`](src/components/ProfileSettings.tsx#L22)): `useServiceWorker()` registers `/sw.js` only when the Profile Settings modal mounts, leaving users who never open settings without a service worker.
- **Copy-Paste Activity Log Names**:
  - [`SiemWebhooks.tsx:73`](src/components/SiemWebhooks.tsx#L73) logs webhook creation as `'promo_create'`.
  - [`TeamManagement.tsx:54, 64`](src/components/TeamManagement.tsx#L54) logs team invites as `'promo_create'` and member removals as `'promo_delete'`.

---

## 5. Suggested New Features

Ranked by Impact vs. Effort ($S < 1\text{ day}$, $M = 1\text{--}3\text{ days}$, $L > 3\text{ days}$):

| # | Priority | Feature Name | Why It Fits the Platform | Implementation Sketch | Effort |
|:--|:---:|:---|:---|:---|:---:|
| 1 | **P0** | **Real Live Threat Intelligence Feeds** | The current 3D threat globe generates random attacks via `Math.random()`, posing reputational risk for an Enterprise tier. | Create `src/lib/threatFeeds.ts` polling live feeds (e.g. CISA KEV JSON, Abuse.ch URLhaus recent CSV, AlienVault OTX pulses), map IPs to lat/lng via `ipwho.is`, feed live points to `ThreatMap3D.tsx`. | **M** |
| 2 | **P0** | **Secure Cloud Function AI Proxy (App Check Protected)** | Secret keys (`VITE_GROQ_API_KEY`, `VITE_OPENROUTER_API_KEY`) ship in the client bundle. | Move AI calls from `gemini.ts` into a Firebase HTTPS Callable function (`functions/src/aiProxy.ts`), verify App Check token (`context.app`), keep API keys in Google Cloud Secret Manager. | **M** |
| 3 | **P0** | **Comprehensive Firestore Rules & RBAC Hardening** | Authenticated users can list all API keys, webhooks, tickets, and escalate their own subscription tier. | Rewrite `firestore.rules`: block updates to `tier` on `users/{userId}`, enforce query owner matching on `list` rules, move referral incrementation to a Cloud Function transaction. | **S** |
| 4 | **P0** | **Test Harness & CI Gate Automation** | Automated tests are broken and CI deploys untested code. | Add `@testing-library/dom` to `package.json`, update `socialOsint.test.ts` mocks, add `npm test` and `npm run lint` steps to `.github/workflows/deploy.yml`. | **S** |
| 5 | **P1** | **Runtime Fetch for Daily News (3MB Bundle Reduction)** | `Blog.tsx` imports a 2.91 MB static JSON file, causing huge initial payload and slow mobile loading. | Move `dailyNews.json` to `public/data/dailyNews.json`, replace static import in `Blog.tsx` with `useEffect` + `fetch('/data/dailyNews.json')`. | **S** |
| 6 | **P1** | **Server-Side Watchlist Daemon Sensor** | README advertises 24/7 automated watchlist monitoring. | Scheduled Cloud Function (`functions/src/watchlistCron.ts`) running hourly via Google Cloud Scheduler, iterating active watchlist items, scanning DNS/ports, and writing alerts to Firestore. | **L** |
| 7 | **P1** | **Automated SIEM Webhook Dispatcher** | Webhook settings exist in UI but no security events are ever dispatched. | Firestore Cloud Function trigger on `scans/{scanId}` onCreate; filters by user's active webhooks in `webhooks/{hookId}`, formats payload (Slack, Discord, Splunk HEC), and dispatches HTTP POST with HMAC signature. | **M** |
| 8 | **P1** | **Self-Serve Online Payment (Stripe / Paymob)** | Upgrading currently requires messaging on WhatsApp. | Connect `functions/src/index.ts` to `CheckoutModal.tsx`, embed card checkout iframe or Stripe Checkout session, automatically update user tier upon webhook fulfillment. | **M** |
| 9 | **P1** | **File & Hash Malware Scanner** | Core OSINT/SecOps utility missing from the platform. | New `FileAnalyzer.tsx` tab: compute SHA-256 locally via `crypto.subtle.digest`, query Abuse.ch MalwareBazaar / VirusTotal free API for malware family identification. | **S** |
| 10 | **P1** | **Bulk Export & Shareable Scan Report Links** | SOC analysts need CSV/JSON exports and shareable report links for client audits. | Add CSV/JSON exporter in `ScanHistory.tsx`, create public report route `/report/:scanId` with read-only Firestore permissions when `public: true`. | **S** |
| 11 | **P2** | **Interactive Cyber Academy Module** | README advertises Cyber Academy, and user profile contains unused `completedLessons` field. | Add `src/components/CyberAcademy.tsx` rendering markdown modules from `src/data/lessons/*.json`, updating lesson progress via existing `updateLessonProgress()` in `firebase.ts`. | **M** |
| 12 | **P2** | **Dynamic Lazy Loading for Heavy Vendor Chunks** | `jspdf` (625 kB) and `recharts` (417 kB) add bundle overhead. | Dynamic import `import('jspdf')` inside `src/lib/generatePDF.ts` only when "Export PDF" is clicked, dynamic import `recharts` in `Dashboard.tsx`. | **S** |
| 13 | **P2** | **PWA Service Worker Pre-Caching** | Service worker is registered late and does not precache offline assets properly. | Move `useServiceWorker` to `main.tsx`, configure `vite-plugin-pwa` in `vite.config.ts` with offline fallback for core analyzers. | **S** |

---

## 6. Code Quality & Architecture

### 6.1 Monolithic Files (>500 lines)

Several components combine presentation, network orchestration, state, and business logic into monolithic files:
- [`EmailAnalyzer.tsx`](src/components/EmailAnalyzer.tsx) (994 lines)
- [`AdminDashboard.tsx`](src/components/AdminDashboard.tsx) (974 lines)
- [`UrlAnalyzer.tsx`](src/components/UrlAnalyzer.tsx) (746 lines)
- [`SocialOsintScanner.tsx`](src/components/SocialOsintScanner.tsx) (686 lines)
- [`ProfileSettings.tsx`](src/components/ProfileSettings.tsx) (620 lines)
- [`CyberAssistant.tsx`](src/components/CyberAssistant.tsx) (611 lines)
- [`LanguageContext.tsx`](src/contexts/LanguageContext.tsx) (592 lines)
- [`DomainLookup.tsx`](src/components/DomainLookup.tsx) (515 lines)
- [`Blog.tsx`](src/components/Blog.tsx) (518 lines)
- [`gemini.ts`](src/lib/gemini.ts) (514 lines)

### 6.2 Analyzer Pattern Duplication

Every analyzer (`EmailAnalyzer`, `UrlAnalyzer`, `IpAnalyzer`, `DomainLookup`, `PasswordAnalyzer`, `PhoneAnalyzer`, `UsernameAnalyzer`, `DeviceSecurityCheck`, `BrowserFingerprint`) repeats identical boilerplate:
1. Input state management & regex validation.
2. `isLoading` / `error` state handling.
3. Invoking the respective analyzer function.
4. Calling `addDoc(collection(db, 'scans'), ...)` with `userId`, `target`, `type`, `riskLevel`, `score`, `timestamp`.
5. Rendering the `MiniHistory` component.
6. Invoking `generateReportPDF(...)`.

*Recommendation:* Extract a generic `useSecurityScanner<TInput, TResult>` custom hook to encapsulate the scan lifecycle, saving >1,000 lines of duplicated code.

### 6.3 Missing Error Boundaries

`App.tsx` wraps lazy pages in `Suspense`, but lacks a React `<ErrorBoundary>`. If any component throws during render (e.g. malformed Firestore document or canvas context loss), the entire React tree unmounts to a blank screen.

### 6.4 Library & Naming Hygiene

- **`gemini.ts` Misnomer**: The file imports `@google/genai` but all active functions call Groq (`api.groq.com`) using `OpenAI` client. `@google/genai` is only used for the `Type` enum. Should be renamed to `aiProviders.ts` and `@google/genai` dependency removed.
- **Unused `sanitize.ts`**: A clean sanitization utility exists in `src/lib/sanitize.ts` but none of the input forms or analyzer components import it.

---

## 7. Security Review

### 7.1 Firestore Security Rules Assessment (`firestore.rules`)

| Vulnerability | File & Line | Severity | Description & Exploit Scenario |
|:---|:---|:---:|:---|
| **Tier Self-Privilege Escalation** | [`firestore.rules:48-54`](firestore.rules#L48-L54) | **CRITICAL** | `match /users/{userId}` allows `allow update: if (isOwner(userId) \|\| isAdmin()) && isValidUser();`. `isValidUser()` only checks string lengths of `name` and `email`. Any authenticated user can call `updateDoc(doc(db, 'users', uid), { tier: 'enterprise' })` to grant themselves permanent enterprise access for free. |
| **API Keys Collection Enumeration** | [`firestore.rules:112-117`](firestore.rules#L112-L117) | **CRITICAL** | `match /apiKeys/{keyId}` allows `allow list: if isAuthenticated();`. Any signed-in user can run `getDocs(collection(db, 'apiKeys'))` to extract all users' plaintext API keys. |
| **Webhook Secrets Enumeration** | [`firestore.rules:128-133`](firestore.rules#L128-L133) | **HIGH** | `match /webhooks/{hookId}` allows `allow list: if isAuthenticated();`. Any authenticated user can list all enterprise webhook URLs and HMAC secrets (`whsec_*`). |
| **Support Ticket Data Leak** | [`firestore.rules:104-109`](firestore.rules#L104-L109) | **HIGH** | `match /supportTickets/{ticketId}` allows `allow list: if isAdmin() \|\| isAuthenticated();`. Any signed-in user can read confidential support inquiries submitted by any customer. |
| **Notifications Data Leak** | [`firestore.rules:77-83`](firestore.rules#L77-L83) | **MEDIUM** | `match /notifications/{notifId}` allows `allow list: if isAuthenticated();`. Any user can query and read all system notifications across all accounts. |
| **Team Membership Leak** | [`firestore.rules:136-141`](firestore.rules#L136-L141) | **MEDIUM** | `match /teams/{teamId}` allows `allow read, list: if isAuthenticated();`. Any user can enumerate team structures and invited emails across corporate accounts. |
| **Promo Code Leak** | [`firestore.rules:86-89`](firestore.rules#L86-L89) | **MEDIUM** | `match /promoCodes/{codeId}` allows `allow read: if isAuthenticated();`. Any user can query all active promo codes and 100% discount codes. |
| **Infinite Referral Farming** | [`firestore.rules:159-163`](firestore.rules#L159-L163) | **HIGH** | Rule permits `update` if `request.resource.data.referralCount == resource.data.referralCount + 1`. Any user can write a loop incrementing any UID's `referralCount` infinitely without real signups. |

### 7.2 Client-Side Exposed Secrets

In [`.github/workflows/deploy.yml:35-36`](.github/workflows/deploy.yml#L35-L36):
```yaml
VITE_GROQ_API_KEY: ${{ secrets.VITE_GROQ_API_KEY }}
VITE_OPENROUTER_API_KEY: ${{ secrets.VITE_OPENROUTER_API_KEY }}
```
Vite inlines all `VITE_*` environment variables directly into compiled JavaScript chunks. Because the site is statically hosted on GitHub Pages, the raw API keys are public knowledge. Anyone can extract these keys and deplete API quotas.

### 7.3 App Check Status

[`src/lib/firebase.ts:9-12`](src/lib/firebase.ts#L9-L12) initializes App Check with reCAPTCHA v3 (`6LeEK8gsAAAAAJMULD1_JbPaewS5nWXgYPNKNd0Q`). However:
1. App Check is only effective if **Enforcement** is enabled in the Firebase Console for Firestore and Cloud Functions.
2. The hardcoded reCAPTCHA v3 site key should be placed in `VITE_RECAPTCHA_SITE_KEY`.

### 7.4 Express Relay Security (`server.ts`)

- **Input Validation**: Good — [`server.ts:8, 138`](server.ts#L8) enforces regex `/^[a-zA-Z0-9._-]{1,50}$/`.
- **Missing Rate Limiting**: The `/api/social-osint/search` proxy lacks `express-rate-limit`, making it vulnerable to upstream quota exhaustion.
- **CORS Allowlist**: Lacks strict origin validation if deployed as a standalone public service.

---

## 8. Performance & Bundle Analysis

### 8.1 Production Bundle Breakdown (`vite build`)

| Chunk Asset | Minified Size | Gzip Size | Composition & Notes |
|:---|---:|---:|:---|
| `dist/assets/Blog-*.js` | **2,972.53 kB** | **1,058.56 kB** | 🔴 Inlines `dailyNews.json` (2.91 MB static JSON). Triggers Vite chunk size warning. |
| `dist/assets/vendor-pdf-*.js` | **625.33 kB** | **186.80 kB** | `jspdf` + `jspdf-autotable` + bundled DOMPurify. Loaded only on PDF export. |
| `dist/assets/vendor-charts-*.js` | **417.14 kB** | **118.75 kB** | `recharts` + `d3-*` modules for dashboard visualizations. |
| `dist/assets/vendor-firebase-firestore-*.js` | **397.87 kB** | **92.69 kB** | Core Firestore SDK. |
| `dist/assets/index-*.js` | **228.61 kB** | **79.48 kB** | Application core shell. |
| `dist/assets/vendor-react-dom-*.js` | **184.92 kB** | **57.83 kB** | React 19 DOM runtime. |
| `dist/assets/vendor-ai-*.js` | **165.94 kB** | **45.01 kB** | `@google/genai` + `openai` SDKs. |
| `dist/assets/index.es-*.js` | **159.64 kB** | **53.54 kB** | Additional vendor utilities. |
| `dist/assets/vendor-motion-*.js` | **127.89 kB** | **42.02 kB** | `motion/react` animation library. |
| `dist/assets/vendor-firebase-auth-*.js` | **127.79 kB** | **25.77 kB** | Firebase Authentication SDK. |
| `dist/assets/vendor-firebase-core-*.js` | **124.04 kB** | **35.07 kB** | Firebase App + App Check. |
| `dist/assets/vendor-phone-*.js` | **117.85 kB** | **29.41 kB** | `libphonenumber-js` metadata tables. |
| `dist/assets/vendor-react-*.js` | **103.06 kB** | **29.49 kB** | React 19 core runtime. |
| `dist/assets/index-*.css` | **126.35 kB** | **18.45 kB** | Tailwind CSS compiled stylesheets. |

### 8.2 Optimization Action Plan

1. **Move `dailyNews.json` to Runtime Fetch**:
   - Relocate `src/data/dailyNews.json` to `public/data/dailyNews.json`.
   - Update [`src/components/Blog.tsx`](src/components/Blog.tsx) to fetch JSON over HTTP on mount.
   - **Expected saving: ~2.94 MB JS bundle reduction.**
2. **Dynamic Import for `generatePDF`**:
   - Convert static imports in [`src/lib/generatePDF.ts`](src/lib/generatePDF.ts) to `const { jsPDF } = await import('jspdf');`.
   - **Expected saving: 625 kB deferred until user explicitly exports a report.**
3. **Remove `@google/genai`**:
   - Replace `Type` enum imports in `gemini.ts` with lightweight string literals or constants, removing the unused `@google/genai` dependency.

---

## 9. CI / Automation Health

### 9.1 Daily News Workflow (`.github/workflows/daily-news.yml`)

- **Schedule**: Runs daily at `0 5 * * *` UTC (8:00 AM Cairo time).
- **Execution Flow**: Runs `scripts/fetch-news.mjs` (RSS ingestion) -> `scripts/translate-news.mjs` (Google Translate unofficial endpoint) -> commits `src/data/dailyNews.json` -> builds & deploys to GitHub Pages.
- **Risks & Flaws**:
  1. **Git Repository Bloat**: Commits a ~2.9 MB JSON file every day directly to the repository history, increasing repository clone size by ~1 GB per year.
  2. **Unofficial Translation Endpoint**: [`scripts/translate-news.mjs:53`](scripts/translate-news.mjs#L53) relies on unauthenticated `https://translate.googleapis.com/translate_a/single?client=gtx`. If Google rate-limits the IP or changes this endpoint, the daily workflow fails.
  3. **Uses `--legacy-peer-deps`**: Indicates unresolved peer dependency conflicts.
  4. **No Automated Alerts**: Workflow failure does not send email or webhook notifications.

### 9.2 Deployment Workflow (`.github/workflows/deploy.yml`)

- **Trigger**: Push to `main` branch.
- **Risks & Flaws**:
  1. **No Test or Lint Verification**: The workflow runs `npm install` -> `npm run build` -> `deploy-pages`. It does not execute `npm test` or `npm run lint`. Consequently, broken code easily ships to production without catching regressions.
  2. **Secret Inlining**: Bakes secret API keys into client-facing bundles (see §7.2).

---

## 10. Appendix — Raw Command Output

### 10.1 `npm ci`
```text
Exit code: 0
added 338 packages, and audited 339 packages in 1.45s
```

### 10.2 `npm run lint` (`tsc --noEmit`)
```text
Exit code: 1
> react-example@0.0.0 lint
> tsc --noEmit

functions/src/index.ts(1,28): error TS2307: Cannot find module 'firebase-functions' or its corresponding type declarations.
functions/src/index.ts(2,24): error TS2307: Cannot find module 'firebase-admin' or its corresponding type declarations.
functions/src/index.ts(58,28): error TS2339: Property 'token' does not exist on type 'unknown'.
functions/src/index.ts(78,31): error TS2339: Property 'id' does not exist on type 'unknown'.
functions/src/index.ts(119,36): error TS2339: Property 'token' does not exist on type 'unknown'.
```

### 10.3 `npm test` (`vitest run`)
```text
Exit code: 1
> react-example@0.0.0 test
> vitest run

 RUN  v3.2.4 D:/joeScan/.claude/worktrees/website-comprehensive-audit-fca334

⎯⎯⎯⎯⎯⎯ Failed Suites 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  server.test.ts [ server.test.ts ]
 FAIL  src/components/SocialOsintScanner.test.tsx [ src/components/SocialOsintScanner.test.tsx ]
 FAIL  src/lib/socialOsint.test.ts [ src/lib/socialOsint.test.ts ]
Error: Cannot find module '@testing-library/dom'
Require stack:
- D:\joeScan\.claude\worktrees\website-comprehensive-audit-fca334\node_modules\@testing-library\react\dist\pure.js
 ❯ Object.<anonymous> node_modules/@testing-library/react/dist/pure.js:46:12

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯

 Test Files  3 failed (3)
      Tests  no tests
   Start at  19:47:40
   Duration  1.49s
```

### 10.4 `npm run build` (`vite build`)
```text
Exit code: 0
> react-example@0.0.0 build
> vite build

vite v6.4.2 building for production...
transforming...
✓ 3301 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        5.70 kB │ gzip:     1.92 kB
dist/assets/index-B2ZcLtFw.css                       126.35 kB │ gzip:    18.45 kB
dist/assets/MiniHistory-x87PVdQi.js                    3.60 kB │ gzip:     1.64 kB
dist/assets/BadgeSystem-DZoRl9eE.js                    5.55 kB │ gzip:     2.26 kB
dist/assets/ApiSettingsModal-B3e-x0FB.js               6.24 kB │ gzip:     1.76 kB
dist/assets/MessageAnalyzer-Cun83uCL.js                6.81 kB │ gzip:     2.37 kB
dist/assets/UsernameAnalyzer-UsCP59QT.js               7.73 kB │ gzip:     2.81 kB
dist/assets/TeamManagement-s1mZVel_.js                 8.32 kB │ gzip:     2.64 kB
dist/assets/generatePDF-fF3pfgVK.js                    9.01 kB │ gzip:     3.16 kB
dist/assets/ThreatMap-p2rnBR0M.js                      9.36 kB │ gzip:     3.38 kB
dist/assets/SiemWebhooks-wwyf9X83.js                  10.03 kB │ gzip:     3.34 kB
dist/assets/BrowserFingerprint-CEcbs7Lj.js            10.24 kB │ gzip:     4.02 kB
dist/assets/DeviceSecurityCheck-CCdaylzA.js           10.92 kB │ gzip:     3.87 kB
dist/assets/ThreatMap3D-Dp5x1xM0.js                   12.15 kB │ gzip:     4.22 kB
dist/assets/Watchlist-OZYg_9Hy.js                     12.93 kB │ gzip:     4.24 kB
dist/assets/Pricing-CAh5mbwQ.js                       13.00 kB │ gzip:     4.29 kB
dist/assets/IpAnalyzer-DUSp1cNe.js                    13.34 kB │ gzip:     4.44 kB
dist/assets/PhoneAnalyzer-cHcSA3WP.js                 13.79 kB │ gzip:     4.10 kB
dist/assets/gemini-C5ET0bnQ.js                        13.87 kB │ gzip:     5.92 kB
dist/assets/DomainLookup-rIPaF8sM.js                  14.07 kB │ gzip:     4.73 kB
dist/assets/PasswordAnalyzer-JEIa-a6A.js              15.73 kB │ gzip:     5.75 kB
dist/assets/ScanHistory-CsC4LoUM.js                   18.34 kB │ gzip:     5.90 kB
dist/assets/LandingPage-D3_uwq_p.js                   21.87 kB │ gzip:     6.42 kB
dist/assets/purify.es-B5CD4DQe.js                     22.90 kB │ gzip:     8.84 kB
dist/assets/Dashboard-DfWhfqD4.js                     23.40 kB │ gzip:     7.16 kB
dist/assets/ReferralSystem-DdSYMn-e.js                24.19 kB │ gzip:     8.42 kB
dist/assets/ProfileSettings-C4p5KN8W.js               25.37 kB │ gzip:     6.77 kB
dist/assets/UrlAnalyzer-BKUQW2xO.js                   27.34 kB │ gzip:     9.79 kB
dist/assets/EmailAnalyzer-CTilx6IX.js                 30.43 kB │ gzip:     8.95 kB
dist/assets/SocialOsintScanner-DmSFDndU.js            32.58 kB │ gzip:     8.44 kB
dist/assets/MfaGuard-Dp2FRDbH.js                      38.58 kB │ gzip:    13.52 kB
dist/assets/AdminDashboard-CXitxZE8.js                39.89 kB │ gzip:     9.45 kB
dist/assets/vendor-react-Bq0CC5QI.js                 103.06 kB │ gzip:    29.49 kB
dist/assets/vendor-phone-CPF1vYaM.js                 117.85 kB │ gzip:    29.41 kB
dist/assets/vendor-firebase-core-CAfWZVx8.js         124.04 kB │ gzip:    35.07 kB
dist/assets/vendor-firebase-auth-CUBFpyKr.js         127.79 kB │ gzip:    25.77 kB
dist/assets/vendor-motion-CPGXct2x.js                127.89 kB │ gzip:    42.02 kB
dist/assets/index.es-B-kh36TX.js                     159.64 kB │ gzip:    53.54 kB
dist/assets/vendor-ai-DXKqd4qb.js                    165.94 kB │ gzip:    45.01 kB
dist/assets/vendor-react-dom-BA-vPVx3.js             184.92 kB │ gzip:    57.83 kB
dist/assets/index-m9vZuYJQ.js                        228.61 kB │ gzip:    79.48 kB
dist/assets/vendor-firebase-firestore-Cma2hzpf.js    397.87 kB │ gzip:    92.69 kB
dist/assets/vendor-charts-ocu0k3nw.js                417.14 kB │ gzip:   118.75 kB
dist/assets/vendor-pdf-hhwoouEw.js                   625.33 kB │ gzip:   186.80 kB
dist/assets/Blog-BdSA5kjb.js                       2,972.53 kB │ gzip: 1,058.56 kB

(!) Some chunks are larger than 650 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 11.63s
```

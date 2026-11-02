# Social Media OSINT Scanner - Implementation Plan

> **STATUS UPDATE - 2026-11-02 (verified on `main` @ `66e66881`): CLOSED - this document is history, not a to-do list.**
>
> Every phase below shipped (see *Status by phase*), and the feature it planned has since been
> retired from the app. Before acting on anything in this file, note:
>
> 1. **The Social OSINT page was retired on 2026-09-13** - commit [`ebb8d89`](https://github.com/Youssef1703-2023/joescan/commit/ebb8d8996cbac64c9bec17e311f48fff86cd8a58),
>    "Retire Social Media OSINT page and redirect legacy links". `/social-osint` now redirects to the
>    dashboard (`redirectRetiredPage` in `src/App.tsx`), `social` is not a `TabId` in
>    `src/lib/workspaceRoutes.ts`, and `src/components/SocialOsintScanner.tsx` is imported only by its
>    own test file.
> 2. **The WhatsMyName client flow described under "Confirmed external dependency" is gone.**
>    `src/lib/socialOsint.ts` now searches through the AI proxy (`searchSocialProfiles` /
>    `searchPhoneProfiles` in `src/lib/gemini.ts`). The WhatsMyName relay survives only as the
>    `server.ts` `/api/social-osint/*` endpoints (upstream `https://whatsmyname.ink`), covered by
>    `server.test.ts`; nothing under `src/` calls it.
> 3. **All `E:\joescan\...` paths were removed.** That prefix referred to one local clone, never to
>    the repository. Every path below is repo-relative.
> 4. **The Phase 5 "no test harness" note is obsolete.** Vitest + React Testing Library run in CI:
>    `src/lib/socialOsint.test.ts` (10 cases) and `src/components/SocialOsintScanner.test.tsx` (5 cases).
>
> **CI on `main` is green.** *Security audit* (`npm run lint`, `npm audit`) passed for `5bfc8034` and
> `66e66881`; *Deploy to Cloudflare Pages* (`npm run lint`, `npm test`, `npm run build`) passed for
> `5bfc8034`. `66e66881` only changes `public/data/dailyNews.json`, so the test result still describes
> the current tree.

---

## Goal (as written in April 2026)

Allow a signed-in JoeScan user to enter a username, enumerate a large platform set, review
categorized hits, receive an AI-generated exposure assessment, save the scan to Firestore, and
export a readable PDF report - matching the app's visual system, bilingual behavior, persistence
model, and reliability bar.

**Current reality:** that pipeline is implemented and test-covered, but the entry screen is retired,
so no user can reach it from the app shell today.

---

## Current state snapshot (2026-11-02)

### Where the surfaces stand

| Surface | State on `main` @ `66e66881` |
|---|---|
| Reachable tabs | `dashboard`, `history`, `watchlist`, `email`, `password`, `url`, `message`, `domain`, `blog`, `referral`, `pricing`, plus `team` / `threat_3d` (enterprise or admin) and `admin` (admin) - `STANDARD_SIGNAL_TABS` in `src/components/navigation/signalPages.ts` |
| Social OSINT screen | **Retired** (`ebb8d89`); legacy URL redirects to the dashboard, asserted by `src/App.navigation.test.tsx` |
| 2D Threat Map screen | **Retired** (`c8bf7b6`); `ThreatMap3D` is the surviving variant |
| `src/components/SocialOsintScanner.tsx` | Kept and tested, not rendered by `src/App.tsx` |
| `server.ts` WhatsMyName relay | Kept and tested, not called from `src/` |

### Implemented, with evidence

1. **Search wrapper** - `src/lib/socialOsint.ts`: `searchUsername()` / `searchPhoneNumber()`, the
   username contract (`/^[a-zA-Z0-9._-]{1,64}$/` plus structural rules that reject a leading
   dot or hyphen, a trailing dot, and `..`), `DEFAULT_TIMEOUT_MS = 120000`, `AbortSignal` support,
   and the explicit `RATE_LIMIT` / `TIMEOUT` error contract.
2. **AI analysis** - `analyzeSocialFootprint()`, `searchSocialProfiles()`, `searchPhoneProfiles()`
   in `src/lib/gemini.ts`, behind the authenticated proxy with quota handling
   (`AiQuotaExceededError`).
3. **UI state model** - `src/components/SocialOsintScanner.tsx`:
   `ScanPhase = 'idle' | 'scanning' | 'analyzing' | 'success' | 'empty' | 'error'`, a fixed category
   order (social, professional, gaming, forums, other) with alphabetical sorting inside each
   category, per-category counts, abort on unmount or rescan, `role="status"` +
   `aria-live="polite"` progress, `role="alert"` errors, and a report button that renders only when
   both scan results and AI analysis exist.
4. **Persistence** - `saveScan({ type: 'social_osint', platformsFound, platforms,
   totalPlatformsChecked, riskLevel, securityScore, reportText, actionPlan })`;
   `src/components/ScanHistory.tsx` labels and iconifies `social_osint`, and
   `src/components/Dashboard.tsx` counts it, including the `social` to `social_osint` alias.
5. **PDF export** - `src/lib/generatePDF.ts` adds a "Platforms Found" block: per-category
   `CATEGORY / ACCOUNTS FOUND` tables plus the platform list, on top of the executive summary and
   action plan.
6. **Localization and encoding** - Social OSINT keys exist in all seven languages;
   `src/contexts/LanguageContext.tsx` passes a strict UTF-8 decode (139,091 bytes), so the `?????`
   seen in some terminals is a console rendering artifact, not file corruption.

---

## Status by phase

### Phase 1 - Normalize text and documentation: DONE

- [x] Greenfield plan replaced by this reality-based document.
- [x] `src/contexts/LanguageContext.tsx` audited: valid UTF-8, Arabic code points intact.
- [x] Social OSINT copy exists as translation keys for `en, ar, fr, de, es, tr, ru`.
- [ ] Removal of hardcoded fallback labels - not pursued. Some scanner copy is still inline
      English (for example the AI-failure notice in `SocialOsintScanner.tsx`). Low priority while
      the screen is retired.

### Phase 2 - Harden the API layer: DONE (design changed)

- [x] Input validation before any network or AI call (charset, length cap, structural rules).
- [x] Timeout handling: `TIMEOUT` after `timeoutMs` (default 120 s), unit-tested.
- [x] Cancellation: `AbortController`; the scanner aborts on unmount and on a new scan;
      `AbortError` stays distinct from `RATE_LIMIT` and `TIMEOUT`.
- [x] Rate limit: the `RATE_LIMIT` error contract is preserved and surfaced with dedicated copy.
- [x] Proxy decision - superseded: the client goes through the AI proxy, and a first-party
      WhatsMyName relay exists in `server.ts` (10 s upstream timeout, typed `UPSTREAM_ERROR` /
      `UPSTREAM_TIMEOUT` bodies) with coverage in `server.test.ts`.
- [ ] Polling hardening - superseded: the `POST /api/search` + `GET /api/search?id=` polling flow
      was removed with the WhatsMyName client; no `queryId` polling remains in
      `src/lib/socialOsint.ts`.
- [ ] `GET /api/platforms` metadata - not adopted. Grouping uses the local keyword classifier
      `categorizePlatform()`, and the AI path returns categories itself. Accept as the current
      design; revisit only if grouping accuracy is reported as a problem.

### Phase 3 - Tighten the UI and state model: DONE

- [x] Six explicit UI phases (`ScanPhase`).
- [x] State reset on rescan and abort; progress clears only when the run finishes.
- [x] Stable ordering: fixed category order, alphabetical inside each category, stable count badges.
- [x] Accessibility: `role="status"` / `aria-live="polite"` for progress, `role="alert"` /
      `aria-live="assertive"` for errors, keyboard-submittable form.
- [x] Empty state separated from the failure state (`empty` vs `error`).
- [x] Report button translated and gated on AI completion.
- Covered by `src/components/SocialOsintScanner.test.tsx`: happy path with export, no-hit,
  rate limit, timeout, invalid-username banner copy.

### Phase 4 - Persistence and reporting: DONE

- [x] `social_osint` records appear in history with a label and icon (`src/components/ScanHistory.tsx`).
- [x] The dashboard chart counts the type, including the `social` alias (`src/components/Dashboard.tsx`).
- [x] Extra scan fields persisted: platform names, hit count, total platforms checked. Category
      counts are derived at export time rather than stored.
- [x] PDF carries Social OSINT-specific evidence: "Platforms Found" with per-category tables
      (`src/lib/generatePDF.ts`).

### Phase 5 - Validation coverage: DONE

- [x] Unit tests for the wrapper: `src/lib/socialOsint.test.ts` - category mapping, validation
      boundaries, rate limit, timeout, abort, error propagation.
- [x] Component tests: `src/components/SocialOsintScanner.test.tsx` - happy path with AI and
      export, no-hit path, rate-limit path, timeout path, pinned error copy.
- [x] Navigation smoke test: `src/App.navigation.test.tsx` pins that `/social-osint` redirects and
      the screen is not exposed.
- [x] Test harness: Vitest + Testing Library, executed by `npm test` in the deploy workflow;
      `npm run lint` (`tsc --noEmit`) runs in the security-audit workflow.

### Phase 6 - Manual QA and release checks: BLOCKED BY THE RETIREMENT

The automated gates run in CI (lint, tests, audit, build). The original 12-step checklist cannot run
today: step 2, "the Social OSINT tab appears in navigation", fails by design because the tab was
removed. Re-run it only if the screen is re-launched.

Checklist kept for a potential re-launch:

1. Start the app (`npm run dev`) and confirm the Social OSINT entry exists in navigation.
2. Layout matches the app design system; Arabic RTL renders correctly in the browser.
3. Search a known username; progress updates; grouped results render.
4. The AI panel appears after completion and the report button enables only then.
5. A `social_osint` record is saved for signed-in users and shows in history and dashboard.
6. The PDF download is readable and contains the "Platforms Found" section.
7. A quick rescan resets state; invalid input and network failure show distinct error states.

---

## Acceptance checklist

Verified statically on `main` @ `66e66881`; GitHub Actions is the execution gate.

- [x] Invalid or malformed usernames never reach the network or AI path.
- [x] Timeout, abort, and rate-limit failures are distinct, readable, and unit-tested.
- [x] Progress, empty, success, and error states are explicit and stable.
- [x] Result grouping order is stable across renders.
- [x] Progress and error regions are announced through `aria-live`.
- [x] Scans persist to Firestore with the expected `social_osint` shape.
- [x] History and dashboard surfaces label and count the scan type.
- [x] PDF export carries Social OSINT-specific sections.
- [x] English and Arabic strings exist, and the source file is valid UTF-8.
- [x] `npm run lint` and `npm test` pass in CI on `main`.
- [ ] **Reachable from the app shell** - not met; the screen was retired in `ebb8d89`.
- [ ] **End-to-end manual QA in a browser** - not applicable while the screen is retired.

---

## How this status was verified

- Static audit of a `main` checkout at `66e66881`, cross-checked against GitHub commit, pull
  request, and Actions history.
- CI evidence: *Security audit* green for `5bfc8034` and `66e66881`; *Deploy to Cloudflare Pages*
  (lint, test, build) green for `5bfc8034`.
- The auditing machine has no Node.js, so `npm run lint` / `npm test` were not run locally.

---

## Open items outside this plan (flagged, not fixed here)

1. **README documents screens the app shell no longer renders.** `README.md` has dedicated sections
   for Phone Number OSINT, OSINT Username, IP Scan, Browser Fingerprinting, Device Security, and
   Cyber Academy, and lists Social OSINT in the overview table - but `src/App.tsx` renders only
   `STANDARD_SIGNAL_TABS` (plus `team`, `threat_3d`, `admin`). `IpAnalyzer`, `PhoneAnalyzer`,
   `UsernameAnalyzer`, and `SocialOsintScanner` are imported only by their tests;
   `BrowserFingerprint`, `DeviceSecurityCheck`, and `CyberAcademy` have no importer at all.
   Either README or routing needs to catch up. (The SIEM section is partly accurate: dispatch is
   live through `saveScan` -> `dispatchWebhooks`, but its settings screen `SiemWebhooks.tsx` is
   unreachable.)
2. **Recent fixes target unreachable components.** PRs [#21](https://github.com/Youssef1703-2023/joescan/pull/21)
   and [#22](https://github.com/Youssef1703-2023/joescan/pull/22) (PhoneAnalyzer) and
   [#23](https://github.com/Youssef1703-2023/joescan/pull/23) (IpAnalyzer), merged 2026-11-01 and
   2026-11-02, touch components `src/App.tsx` never renders. Decide explicitly: re-wire the
   routes, or retire those screens the way Social OSINT and the 2D threat map were retired.
3. **The `server.ts` WhatsMyName relay is unused by the client.** Keep it for external or legacy
   callers (it is tested) or remove it now that searches go through the AI proxy.
4. **`support` and `api_keys` are valid `TabId`s with no renderer** in `src/App.tsx`. They are
   excluded from navigation and appear only in `TAB_TO_PATH` plus the SEO noindex allowlist
   (`scripts/build-public-pages.mjs`, `scripts/verify-public-seo.mjs`).

---

## Definition of done - final status

| # | Criterion | Status |
|---|---|---|
| 1 | A user can scan a username from the JoeScan UI | Not met - screen retired (`ebb8d89`); component tests cover the flow |
| 2 | Progress, success, no-result, and error states are clear and stable | Met - `ScanPhase` plus tests |
| 3 | Results are grouped and readable | Met - fixed category order with counts |
| 4 | AI analysis appears reliably after scan completion | Met - `analyzing` phase, gated report button |
| 5 | Firestore saves the scan with the expected structure | Met - `saveScan` payload |
| 6 | The scan type is visible in downstream surfaces | Met - history label/icon, dashboard counter |
| 7 | PDF export includes Social OSINT-specific content | Met - "Platforms Found" plus category tables |
| 8 | English and Arabic both render correctly | Met - keys present, file is valid UTF-8; in-browser check pending a re-launch |
| 9 | TypeScript passes and the core logic is validated | Met - CI lint and tests green on `main` |

---

*Earlier revisions of this plan described a local clone at `E:\joescan` and a WhatsMyName polling
client. Both were corrected on 2026-11-02; see the status header at the top.*

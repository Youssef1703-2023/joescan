# JoeScan — Critical Security Remediation (Spark Plan Architecture)

_Branch `claude/website-comprehensive-audit-fca334` · 2026-08-22_

Remediation of the four CRITICAL findings from the platform audit tailored for the **Firebase Spark (free) plan**.
Zero Cloud Functions or Secret Manager dependencies are required. All security guarantees are preserved via hardened Firestore security rules, deterministic request slots, admin transactions, and a serverless Cloudflare Worker AI proxy.

---

## 1. Status: all four closed

| # | Finding | Status |
|:--|:--------|:-------|
| **C1** | Tier self-escalation — any signed-in user could grant themselves Enterprise | ✅ Closed (Frozen rules + Admin transactions) |
| **C2** | Collection enumeration — any signed-in user could list everyone's API keys, webhooks, tickets, notifications, teams, promo codes | ✅ Closed (Owner-scoped list rules + get/list split) |
| **C3** | AI provider keys shipped inside the browser bundle | ✅ Closed in code (Cloudflare Worker proxy with Firebase ID token verification) — **keys still need rotating** |
| **C4** | Referral counter forgery | ✅ Closed (Deterministic `referralClaims` + permanent markers + Admin approval transaction) |

⚠️ **Not live yet.** The code is ready but deployment is required. See §6 for the updated deploy order and §7 for outstanding key rotation.

---

## 2. Gate results

| Gate | Status | Details |
|:-----|:-------|:--------|
| `npm run lint` (`tsc --noEmit`) | ✅ **0 errors** | Clean root TypeScript validation |
| `npm run build` (`vite build`) | ✅ **0 errors** | Clean frontend production bundle build |
| `workers/ai-proxy/` wrangler dry-run | ✅ **0 errors** | `npx wrangler deploy --dry-run --outdir dist-worker` passed |
| `npm test` | ❌ 3 suites fail | ❌ 3 suites fail — **unchanged, pre-existing missing `@testing-library/dom` dependency** |

The test failure is pre-existing and out of scope.

---

## 3. Architecture: Zero Cloud Functions on Spark Plan

### C1 — Tier self-escalation
- **Security rule enforcement**: `users` create requires `isOwner`, forces `tier` to `'free'`, and forbids entitlement fields. Non-admin `update` forbids modifying `tier`, `subscriptionExpiry`, `tierExpiry`, `socTrialUsed`, `socTrialActivatedAt`, and `upgradedVia`.
- **Deterministic requests**: Client UI writes to `tierRequests/{uid}_{kind}` (`soc_trial`, `referral_reward`, `subscription`) with status `'pending'`.
- **Admin transaction grant**: The admin reviews and approves requests directly in `AdminDashboard` using `runTransaction`.
- **Entitlement arithmetic helper**: New expiry extends existing expiry (`max(now, existingExpiry) + grantedDays`) and never downgrades an existing Enterprise user to Pro.
- **Expiry enforcement**: `getUserTier()` enforces expiration by returning `'free'` when `subscriptionExpiry <= now`.

### C2 — Collection enumeration
- Owner-scoped rules prevent listing documents across other users' data (`apiKeys`, `webhooks`, `supportTickets`, `notifications`, `teams`).
- `promoCodes` uses a `get`/`list` split: single-code `get` is open to authenticated users for checkout validation; `list` is admin-only.

### C3 — AI keys in the browser, Serverless Proxy & Per-User Quota v2
- All shared API keys (`GROQ_API_KEY`, `OPENROUTER_API_KEY`) and fallback keys are removed from client code and build configurations.
- A lightweight Cloudflare Worker in `workers/ai-proxy/` acts as an authenticated proxy (100k requests/day free tier).
- **Authentication**: The Worker validates Firebase ID tokens via Google's public x509 certificates (`RS256`), verifying project issuer, audience (`gen-lang-client-0439091084`), expiration, and subject using the `jose` library.
- **Per-User Daily Quotas (v2)**:
  - `free`: 10 requests / day
  - `pro`: 150 requests / day
  - `enterprise`: 2,000 requests / day (safety cap, not labeled "Unlimited")
  - Day boundary computed in `Africa/Cairo` (`Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' })`), matching Egyptian calendar days.
- **SQLite-backed Durable Objects (`QuotaCounter`)**:
  - One SQLite-backed DO per user ID (`QUOTA_COUNTER.idFromName(uid)`).
  - Single-threaded execution inside the DO guarantees atomic check-and-increment (`reserve`) and non-decrementing balance inspection (`peek`).
  - No service account required: Worker reads user's tier and expiry from Firestore REST API (`users/{uid}`) using the caller's verified Firebase ID token as `Authorization: Bearer`.
- **Strict Server-Side Tier Resolution**:
  - Tier must be exactly `free`, `pro`, or `enterprise`.
  - Paid tiers require `subscriptionExpiry` to parse to a valid future timestamp (supports both ISO `stringValue` and RFC3339 `timestampValue`).
  - Token-verified admin claims (`admin === true` or verified owner email `joetech.dev.systems@gmail.com`) grant the enterprise cap.
- **Provider Guardrails**:
  - Strict model allowlist per provider (Groq: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `openai/gpt-oss-120b`, `mixtral-8x7b-32768`, `gemma2-9b-it`; OpenRouter: `openai/gpt-oss-120b:free`, `openai/gpt-oss-120b`, `meta-llama/llama-3.3-70b-instruct:free`, `meta-llama/llama-3.1-8b-instruct:free`).
  - Server-side ceiling clamping on `max_tokens` (clamped to <= 2048) and `temperature` (0.0 to 2.0).
  - Request body size cap (32 KB), max message count (50), and total character limit (20,000 chars).
- **Charging Rule & Fail-Closed Protection**:
  - Quota is consumed immediately upon successful DO reservation, before forwarding to the provider.
  - Upstream timeouts and ambiguous provider errors are not refunded.
  - Requests rejected locally (bad auth, invalid JSON, disallowed model, payload too large) consume zero quota.
  - Fail-closed: Tier store or DO store failure returns 503 with `Retry-After` (does not proceed to provider).
- **Burst Guard**:
  - Per-UID burst limiter (20 requests / 60 seconds) evaluated before Firestore reads.
- **Status Endpoint & UI Meter**:
  - `GET /quota` provides real-time balance for `AiQuotaMeter.tsx` on the Dashboard.
  - Users with personal keys configured in `localStorage.joe_api_settings` see a dedicated BYO-key badge noting that platform quotas are bypassed.

### C4 — Referral counter forgery
- Counter modifications are frozen on `/referrals/{userId}` for non-admins.
- Signups with a referral code create a deterministic claim `/referralClaims/{newUid}`.
- Admins review and approve referral claims via `runTransaction`: checks for duplicate signup marker in `/referralSignups/{newUid}`, validates referrer, creates permanent signup marker, and increments referrer count.

---

## 4. Residual Risks

1. **Multi-account free tier creation**: A user can register multiple free accounts and receive 10 requests/day on each. The ID-token check verifies an account, not a unique physical human. Future mitigation: enforce Firebase App Check verification in the Worker or Cloudflare Turnstile at signup.
2. **BYO-key quota bypass**: Configured personal keys in Settings call upstream providers directly, bypassing platform quotas entirely by design.
3. **Fail-closed availability tradeoff**: If Firestore or DO storage is temporarily unavailable, AI requests fail closed (HTTP 503) to prevent draining shared provider keys.
4. **Provider-side spend caps**: The proxy bounds request counts and tokens per request, but hard spending limits in the Groq/OpenRouter provider dashboards remain the final backstop.

---

## 5. User-visible behavior changes

| Area | Change | Detail |
|:-----|:-------|:-------|
| **AI Quota Meter** | Balance on Dashboard | Real-time `used / limit` meter on Dashboard showing tier cap and Cairo midnight reset time. |
| **BYO-Key Notice** | Custom API Key Status | Displays "Personal API Key Active — Unlimited" when custom key is configured in Settings. |
| **Quota Reached** | Structured Error Notices | Replaces raw HTTP errors with friendly chat and alert notices detailing reset time and BYO-key option. |
| **SOC Trial** | Request pending approval | User submits trial request to `tierRequests/{uid}_soc_trial`. Banner shows "Pending Review" until admin approval. |
| **Checkout** | Request submitted | Submits subscription request to `tierRequests/{uid}_subscription` before WhatsApp redirect. |
| **Referrals** | Pending claim review | Claiming a tier reward submits a request to `tierRequests/{uid}_referral_reward`. Badge shows "Pending Review". |
| **Admin Dashboard** | Requests & Claims Tab | Unified interface to review, approve, and reject `tierRequests` and `referralClaims` with complete audit logging. |

---

## 6. Deploy order (Spark Plan)

1. **Deploy Firestore Rules and Indexes**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

2. **Deploy Cloudflare Worker (with SQLite Durable Objects)**:
   ```bash
   cd workers/ai-proxy
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put OPENROUTER_API_KEY   # OPTIONAL
   npx wrangler deploy
   ```
   Note the deployed worker URL (e.g. `https://joescan-ai-proxy.<subdomain>.workers.dev`).

3. **Configure GitHub Actions Variable**:
   Set `VITE_AI_PROXY_URL` in repository **Settings → Secrets and variables → Actions → Variables**.

4. **Deploy Frontend**:
   Push/merge to `main` branch to trigger GitHub Pages build and deployment.

5. **Rotate Exposed Secrets**:
   Revoke existing Groq and OpenRouter keys in provider consoles and remove `VITE_GROQ_API_KEY` / `VITE_OPENROUTER_API_KEY` from repository secrets.

---

## 7. Files changed

| Area | Files |
|:-----|:------|
| **Rules & Indexes** | `firestore.rules`, `firestore.indexes.json`, `firebase.json` |
| **Cloudflare Worker** | `workers/ai-proxy/package.json`, `workers/ai-proxy/wrangler.toml`, `workers/ai-proxy/tsconfig.json`, `workers/ai-proxy/src/index.ts`, `workers/ai-proxy/src/quota.ts` |
| **Entitlement & Client** | `src/lib/firebase.ts`, `src/components/AdminDashboard.tsx`, `src/components/SocTrialBanner.tsx`, `src/components/ReferralSystem.tsx`, `src/components/CheckoutModal.tsx`, `src/components/AuthModal.tsx`, `src/components/Pricing.tsx` |
| **AI Integration & Meter** | `src/lib/gemini.ts`, `src/components/CyberAssistant.tsx`, `src/components/AiQuotaMeter.tsx`, `src/components/Dashboard.tsx` |
| **Build & Deployment** | `tsconfig.json`, `.github/workflows/deploy.yml`, `.env.example`, `functions/src/index.ts` (archived reference header), `SECURITY_FIX_REPORT.md` |



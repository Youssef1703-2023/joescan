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

### C3 — AI keys in the browser & Serverless Proxy
- All shared API keys (`GROQ_API_KEY`, `OPENROUTER_API_KEY`) and fallback keys are removed from client code and build configurations.
- A lightweight Cloudflare Worker in `workers/ai-proxy/` acts as an authenticated proxy (100k requests/day free tier).
- **Authentication**: The Worker validates Firebase ID tokens via Google's public x509 certificates (`RS256`), verifying project issuer, audience (`gen-lang-client-0439091084`), expiration, and subject using the `jose` library.
- **Limits**: 32 KB request body limit, message count/character caps, and upstream request timeouts.
- **User-provided keys**: Custom keys in `localStorage.joe_api_settings` continue to call providers directly from the browser.

### C4 — Referral counter forgery
- Counter modifications are frozen on `/referrals/{userId}` for non-admins.
- Signups with a referral code create a deterministic claim `/referralClaims/{newUid}`.
- Admins review and approve referral claims via `runTransaction`: checks for duplicate signup marker in `/referralSignups/{newUid}`, validates referrer, creates permanent signup marker, and increments referrer count.

---

## 4. User-visible behavior changes

| Area | Change | Detail |
|:-----|:-------|:-------|
| **SOC Trial** | Request pending approval | User submits trial request to `tierRequests/{uid}_soc_trial`. Banner shows "Pending Review" until admin approval. |
| **Checkout** | Request submitted | Submits subscription request to `tierRequests/{uid}_subscription` before WhatsApp redirect. |
| **Referrals** | Pending claim review | Claiming a tier reward submits a request to `tierRequests/{uid}_referral_reward`. Badge shows "Pending Review". |
| **Admin Dashboard** | Requests & Claims Tab | Unified interface to review, approve, and reject `tierRequests` and `referralClaims` with complete audit logging. |

---

## 5. Deploy order (Spark Plan)

1. **Deploy Firestore Rules and Indexes**:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```

2. **Deploy Cloudflare Worker**:
   ```bash
   cd workers/ai-proxy
   npx wrangler secret put GROQ_API_KEY
   npx wrangler secret put OPENROUTER_API_KEY   # OPTIONAL — Groq now serves the chatbot too
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

## 6. Files changed

| Area | Files |
|:-----|:------|
| **Rules & Indexes** | `firestore.rules`, `firestore.indexes.json`, `firebase.json` |
| **Cloudflare Worker** | `workers/ai-proxy/package.json`, `workers/ai-proxy/wrangler.toml`, `workers/ai-proxy/tsconfig.json`, `workers/ai-proxy/src/index.ts` |
| **Entitlement & Client** | `src/lib/firebase.ts`, `src/components/AdminDashboard.tsx`, `src/components/SocTrialBanner.tsx`, `src/components/ReferralSystem.tsx`, `src/components/CheckoutModal.tsx`, `src/components/AuthModal.tsx`, `src/components/Pricing.tsx` |
| **AI Integration** | `src/lib/gemini.ts`, `src/components/CyberAssistant.tsx` |
| **Build & Deployment** | `tsconfig.json`, `.github/workflows/deploy.yml`, `.env.example`, `functions/src/index.ts` (archived reference header) |


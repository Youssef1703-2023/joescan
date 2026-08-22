# JoeScan — Critical Security Remediation

_Branch `claude/website-comprehensive-audit-fca334` · 2026-08-22_

Remediation of the four CRITICAL findings from the platform audit. Every claim below was verified
against the code by re-running the gates and reading the diff — not taken from the implementer's
self-report.

---

## 1. Status: all four closed

| # | Finding | Status |
|:--|:--------|:-------|
| **C1** | Tier self-escalation — any signed-in user could grant themselves Enterprise | ✅ Closed |
| **C2** | Collection enumeration — any signed-in user could list everyone's API keys, webhooks, tickets, notifications, teams, promo codes | ✅ Closed |
| **C3** | AI provider keys shipped inside the browser bundle | ✅ Closed in code — **keys still need rotating** |
| **C4** | Referral counter forgery | ✅ Closed |

⚠️ **Not live yet.** The code is correct but nothing is deployed. See §6 for the required deploy
order, and §7 for the key rotation that is still outstanding.

---

## 2. Gate results (re-run by the reviewer, not trusted from the report)

| Gate | Before | After |
|:-----|:-------|:------|
| `npm run lint` (`tsc --noEmit`) | ❌ 5 errors | ✅ **0** |
| `npm run build` (`vite build`) | ✅ 0 | ✅ **0** |
| `npx tsc --noEmit` in `functions/` | ❌ never built | ✅ **0** |
| `npm test` | ❌ 3 suites fail | ❌ 3 suites fail — **unchanged, out of scope** |

The remaining test failure is the pre-existing missing `@testing-library/dom` dependency. It was
deliberately left alone: the brief scoped this work to C1–C4 only.

---

## 3. What was actually wrong, and what fixed it

### C1 — Tier self-escalation

There were **eight** separate ways a browser could hand itself a paid tier:

1. `allow create` on `/users/{userId}` had **no `isOwner` check at all** — any signed-in user could
   create a profile document at *any* uid path with `tier: 'enterprise'`.
2. `allow update` was guarded only by `isValidUser()`, which validated `email`/`name` string length
   and nothing else — so `updateDoc(doc(db,'users',uid), {tier:'enterprise'})` simply worked.
3. `upgradeUserTier()` in `src/lib/firebase.ts` wrote `tier` straight from the browser.
4. `SocTrialBanner` called it for the 3-day trial.
5. `Pricing` called it after a WhatsApp handoff — a handoff where **no payment ever occurs**.
6. `CheckoutModal` auto-upgraded whenever a promo code's discount was ≥ 100%.
7. `ReferralSystem` wrote `tier` directly, and set the **invalid** value `'vip'` at 10 referrals.
   Since `SubscriptionTier` is only `'free' | 'pro' | 'enterprise'`, the platform's most loyal users
   silently *lost* their privileges.
8. **Expiry was never enforced.** `getUserTier()` returned the stored tier without ever looking at
   `subscriptionExpiry`, so a "3-day trial" was in practice permanent Enterprise.

**Fixed by:**
- `allow create` now requires `isOwner(userId)`, binds `uid`, forces `tier` to be absent or
  `'free'`, and rejects any entitlement field outright.
- A new `entitlementFieldsUnchanged()` rule helper freezes `tier`, `subscriptionExpiry`,
  `tierExpiry`, `socTrialUsed`, `socTrialActivatedAt` and `upgradedVia` against all non-admin writes.
  `completedLessons` was deliberately left writable so lesson progress keeps working.
- `upgradeUserTier()` was **removed** from the client entirely.
- Five new Cloud Function callables own every privileged write, each with `enforceAppCheck: true`
  and an authentication guard: `startSocTrial`, `claimReferralReward`,
  `submitSubscriptionRequest`, `adminGrantTier`, `redeemReferralCode`.
- `getUserTier()` now returns `'free'` once `subscriptionExpiry` has passed.
- The `'vip'` bug is gone — the 10-referral reward grants real `'enterprise'` for 3650 days.

### C2 — Collection enumeration

`allow read` in Firestore covers **both** `get` (one document by id) and `list` (a query across the
collection). Six collections were readable by any authenticated user, so
`getDocs(collection(db,'apiKeys'))` returned **every user's API keys**. Same for webhook URLs and
their HMAC secrets, support tickets, notifications, team rosters, and every discount code.

**Fixed by** owner-scoping each `list` rule (`resource.data.userId == request.auth.uid`, or
`ownerId` where that is the field). All five existing client queries were already filtered by owner,
so nothing broke.

`promoCodes` got a **`get`/`list` split** instead: a direct lookup of a code the user already typed
is not enumeration, so `get` stays open and checkout keeps working, while `list` became admin-only.

### The chained exploit that made C1 and C2 worse together

`promoCodes` being listable was not just a data leak — it was step one of a working free-upgrade
chain:

1. List every promo code.
2. Find one with `discount >= 100`.
3. Enter it in checkout — the client granted the paid tier on the spot.

Both halves are now closed: the listing is admin-only, **and** checkout no longer grants anything.

### C3 — AI keys in the browser

Vite inlines every `VITE_*` variable into the compiled JavaScript. The site is static on GitHub
Pages, so both AI keys were simply public. Removing the two workflow lines alone would **not** have
fixed it — the source had four more paths:

- `src/lib/gemini.ts` read `VITE_GEMINI_API_KEY` and `VITE_GROQ_API_KEY`
- `src/components/CyberAssistant.tsx` read `VITE_OPENROUTER_API_KEY`
- `vite.config.ts` inlined `process.env.GEMINI_API_KEY` via a `define` block

**Fixed by:** two new proxy callables (`aiProxy` → Groq, `chatProxy` → OpenRouter) that hold their
keys in Secret Manager, bound per-function via `runWith({ secrets: [...] })`, behind App Check and
an authentication guard, with a Firestore-backed per-user rate limit. Every shared-key browser
fallback and the `define` block were deleted. The `@google/genai` import went away with them — the
only thing still needed from it was a `Type` enum, now inlined.

A user's **own** key in `localStorage.joe_api_settings` still works and still calls the provider
directly. That key belongs to them, not to the platform.

### C4 — Referral counter forgery

Three separate holes:

1. The rule accepted any update where the new `referralCount` was exactly the old one plus 1 — it
   never checked *who* was calling. Anyone could increment anyone's counter in a loop.
2. `allow create, delete` let the owner **delete and recreate** their own referral document. Since
   the client create shape included `referralCount` and `claimedTiers`, an attacker could
   reappear with `referralCount: 10, claimedTiers: []` and claim every reward.
3. Signup deduplication lived in `localStorage` (`joescan-referred-*`) — clear it, or open an
   incognito window, and the same referral credits again.

**Fixed by:** dropping the `+1` clause; making `create` require `referralCount == 0` and an empty
`claimedTiers`; restricting `delete` to admin; freezing `referralCount`/`claimedTiers`/`userId`
against client updates; and denying client writes to `referralSignups` entirely. A new
`redeemReferralCode` callable does the resolve, self-referral check, duplicate check, marker write
and increment inside **one Firestore transaction**. The `localStorage` check is gone — server state
is the only source of truth now.

`code` was deliberately left unfrozen so the custom-referral-code UI keeps working.

`email` was also dropped from the referral document. The leaderboard needs a broad read, and that
broad read was exposing every referrer's email address.

---

## 4. User-visible behavior changes

| Change | Detail |
|:-------|:-------|
| **Checkout no longer grants access** | It now files a pending request and says "Request Submitted" instead of "Upgrade Successful". Payment was always a manual WhatsApp handoff, so the old instant grant was effectively a free-upgrade button. |
| **A new admin approval step exists** | `AdminDashboard` gained a Subscription Requests panel and a tier-grant action backed by `adminGrantTier`, with an audit trail in `activityLog`. This had to be *built* — the audit plan originally assumed the button already existed. It did not. |
| **Trials and paid tiers now actually expire** | Previously an expired subscription kept full access forever. |
| **The 10-referral reward works** | It used to write the invalid tier `'vip'`, which silently downgraded the user. |
| **An invalid referral code no longer blocks signup** | It now reports "the referral code could not be applied" and lets the account through, instead of refusing to create it. |

---

## 5. Reviewer corrections applied on top of the implementation

Two things the implementer got wrong or left rough:

1. **A silent failure was introduced.** Referral redemption moved to after account creation, and any
   failure was swallowed into `console.warn`. A user who mistyped their referral code would never
   have been told. Both call sites now surface a message — without going back to blocking the
   signup, which was the old, worse behavior.
2. **`upgradeUserTier` was left as an exported no-op.** A function that exists, is exported, and
   silently does nothing is a trap for whoever calls it next. Removed, with a comment pointing at the
   callables that replaced it.

**One inaccuracy in the implementer's own report:** it described its rate limiter as in-memory and
per-instance, and listed that as a residual risk. The code actually uses a Firestore transaction on
`rateLimits/{uid}`, which is global across instances. The code was better than the report claimed —
which is exactly why the report was not taken at face value.

---

## 6. Deploy order — this is not optional

The GitHub workflow deploys only the static site. It deploys **neither** the rules **nor** the
functions, so this release cannot be atomic. Run it in this order:

```bash
firebase functions:secrets:set GROQ_API_KEY
firebase functions:secrets:set OPENROUTER_API_KEY
firebase deploy --only functions
firebase deploy --only firestore:rules
```

…and only then merge to `main` to let the Pages workflow publish the frontend.

**Do not deploy the frontend first** — the new client calls callables that would not exist yet.
**Do not deploy the rules first either** — clients still running the old bundle would lose trial
activation, referral claiming and referral credit. A short maintenance window is the clean way to do
this.

Also confirm in the Firebase console that **App Check enforcement is ON** for Firestore and Cloud
Functions. `initializeAppCheck()` in the client protects nothing by itself; `enforceAppCheck: true`
on the callables is the actual gate, and it only bites once enforcement is enabled.

---

## 7. Still outstanding

**Rotate the keys.** The current Groq and OpenRouter keys have been public inside the deployed
bundle for as long as it has been live. Treat them as compromised: revoke them in the provider
consoles, issue new ones into Firebase secrets, and delete `VITE_GROQ_API_KEY` and
`VITE_OPENROUTER_API_KEY` from the repository's GitHub Actions secrets.

**Premium quotas are still UI-only.** Any authenticated user can create API keys, webhooks and team
invitations regardless of tier — the limits live in JSX, and the Firestore rules only check
ownership, not entitlement. This was deliberately out of scope here, but it is a real entitlement
bypass and should be the next piece of work.

**One low-severity note.** `redeemReferralCode` resolves the referral code *outside* its transaction.
If a referrer changed their code in the instant between the lookup and the transaction, credit could
land on a stale referrer. The window is tiny and the impact is a miscounted referral.

---

## 8. Files changed

| Area | Files |
|:-----|:------|
| **Rules** | `firestore.rules` |
| **Backend** | `functions/src/index.ts` (7 new callables; the existing Paymob handlers were left on their original v1 signature and not touched) |
| **Tier & entitlement** | `src/lib/firebase.ts`, `src/components/SocTrialBanner.tsx`, `src/components/Pricing.tsx`, `src/components/CheckoutModal.tsx`, `src/components/AdminDashboard.tsx` |
| **Referrals** | `src/components/ReferralSystem.tsx`, `src/components/AuthModal.tsx` |
| **AI proxying** | `src/lib/gemini.ts`, `src/components/CyberAssistant.tsx` |
| **Build & CI** | `tsconfig.json`, `vite.config.ts`, `.github/workflows/deploy.yml`, `.env.example` |

---

## 9. How this was produced

| Stage | Who |
|:------|:----|
| Audit | Claude, plus a parallel audit by `agy` on `gemini-3.7-flash-high` |
| Plan v1 | Claude |
| Adversarial plan review | **Codex** — found 9 blocking issues; all 9 verified true against the code |
| Plan v2 | Claude, incorporating every Codex finding plus the chained promo-code exploit |
| Implementation | **agy** on `gemini-3.7-flash-high`, effort high |
| Verification & corrections | Claude — gates re-run from scratch, full diff read, two fixes applied |

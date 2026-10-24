# abuse.ch URLhaus Auth-Key Configuration

## Why this key is needed
The `abuse.ch` URLhaus API (`https://urlhaus-api.abuse.ch/v1/host/` and `https://urlhaus-api.abuse.ch/v1/url/`) requires an `Auth-Key` request header. Unauthenticated requests return `{"error":"Unauthorized"}` (HTTP 401), causing JoeScan's URLhaus threat-intelligence layer (used in the **URL Analyzer**, **Message Phishing Analyzer**, and **IP Analyzer**) to fall back to `unavailable`.

## 1. Obtain a free abuse.ch Auth-Key
1. Sign in or create a free community account at the abuse.ch Authentication Portal:
   - <https://auth.abuse.ch/>
2. Navigate to your profile / API keys section and generate an **Auth-Key** for URLhaus / ThreatFox APIs.
3. Copy the generated key string.

## 2. Configure for Local Development (`.env`)
Add `VITE_URLHAUS_AUTH_KEY` to your local `.env` (or `.env.local`) file at the project root:

```dotenv
VITE_URLHAUS_AUTH_KEY=your_abuse_ch_auth_key_here
```

Restart the Vite dev server (`npm run dev`) so `import.meta.env.VITE_URLHAUS_AUTH_KEY` is picked up. When unset, JoeScan gracefully degrades and marks URLhaus lookups as `unavailable` without false-positive or false-negative verdicts.

## 3. Configure for Production (Cloudflare Pages)
Because `VITE_*` variables are embedded at build time by Vite:
1. Open the **Cloudflare Dashboard** and go to **Workers & Pages** → select your **JoeScan Pages project**.
2. Go to **Settings** → **Environment variables**.
3. Under **Production** (and **Preview** if desired), click **Add variable**:
   - **Variable name:** `VITE_URLHAUS_AUTH_KEY`
   - **Value:** *(paste your abuse.ch Auth-Key)*
4. Save and trigger a new deployment so the production bundle is built with `VITE_URLHAUS_AUTH_KEY` populated.

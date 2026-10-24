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

## 3. Configure for Production (GitHub Actions build)

> Do NOT use the Cloudflare Dashboard environment-variables screen for this key.
> joescan's production bundle is built in GitHub Actions
> (`.github/workflows/deploy-cloudflare.yml` runs `npm run build`, then uploads
> the prebuilt `dist/` with Wrangler), so only variables present in the Actions
> build environment are embedded by Vite. A Dashboard variable never reaches
> the bundle.

1. In the repo, go to **Settings → Secrets and variables → Actions** and add a
   repository secret:
   - **Name:** `VITE_URLHAUS_AUTH_KEY`
   - **Value:** *(your abuse.ch Auth-Key — never commit it to the repo)*
2. In `.github/workflows/deploy-cloudflare.yml`, the `Build` step's `env` block
   must pass the secret through:
   ```yaml
   - name: Build
     run: npm run build
     env:
       NODE_ENV: production
       VITE_URLHAUS_AUTH_KEY: ${{ secrets.VITE_URLHAUS_AUTH_KEY }}
   ```
3. Merge and let the Deploy workflow run, so the production bundle is built
   with `VITE_URLHAUS_AUTH_KEY` populated. When the secret is absent, JoeScan
   gracefully degrades and marks URLhaus lookups as `unavailable` without
   false-positive or false-negative verdicts.

# Public search readiness — 7 September 2026

## Published design

- `/tools/` is a public directory with sixteen tool guides. Each guide has unique English copy covering purpose, usage, limitations and data handling.
- Guides are static HTML, identical for visitors and crawlers, and work without JavaScript or authentication. No scans or account reads happen on these pages.
- The homepage links to every guide. Each guide links to related guides, About, Privacy and the tool's sign-in flow. The intended tool route remains in the URL through sign-in.
- Unique titles, descriptions, canonical URLs, social metadata and WebPage/BreadcrumbList structured data are generated during the build. No invented reviews, ratings or guaranteed outcomes.
- `sitemap.xml` lists only twenty public URLs: home, directory, sixteen guides, About and Privacy. No account pages, identifiers, query strings or user results.
- Existing workspace routes and 404 responses include noindex in their initial HTML. Crawling is allowed so Google can read that directive. Authentication and Firebase rules remain the actual privacy boundary.
- The old article prerender helper no longer redirects readers automatically. It is not part of this production build; authenticated blog/academy views are not listed in the public sitemap.

## Verification

`node scripts/verify-public-seo.mjs` checks public metadata, structured data, local links, the sitemap allowlist and private-route noindex. It runs in the production deployment workflow.

Browser checks cover desktop, 390px mobile, FAQ interaction, directory links and a JavaScript-disabled tool guide. Account data is never included in the build input.

## Google Search Console handoff

The existing Google verification meta tag is preserved. Its presence alone does not prove that the connected Google account owns the Search Console property.

The connected credential could not list Search Console sites: HTTP 403, insufficientPermissions. The interactive browser-control tool failed to initialize. Therefore property access, sitemap submission, URL Inspection and indexing status are not claimed complete.

With the verified owner account:

1. Open the existing `joescan.me` domain property or `https://joescan.me/` URL-prefix property in Search Console. Do not create a duplicate if one already exists.
2. Submit `https://joescan.me/sitemap.xml` under Sitemaps.
3. Use URL Inspection and its live test for `/tools/`, `/tools/email-audit/` and `/tools/password-vault/`; confirm fetched HTML, canonical and indexability.
4. Request indexing for representative public pages. Review Page indexing and sitemap processing after Google has crawled them. No submission guarantees inclusion or a ranking.
5. Verify that account routes such as `/history/` and `/admin/` are excluded by noindex. Do not submit user-result URLs.

Reference: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

# Social Media OSINT Scanner - Full Implementation Plan

## Document purpose

This plan describes how to finish, harden, and validate the Social Media OSINT Scanner inside the JoeScan app at `E:\joescan`.

It is intentionally based on the current codebase state, not a greenfield assumption. As of April 17, 2026, the feature foundation already exists in the app:

- Navigation entry already exists in `E:\joescan\src\App.tsx`
- Translation keys already exist in `E:\joescan\src\contexts\LanguageContext.tsx`
- API wrapper already exists in `E:\joescan\src\lib\socialOsint.ts`
- AI analysis function already exists in `E:\joescan\src\lib\gemini.ts`
- Main UI already exists in `E:\joescan\src\components\SocialOsintScanner.tsx`

Because of that, this plan focuses on production readiness, cleanup, and verification rather than first-pass scaffolding.

---

## Goal

Allow a signed-in JoeScan user to enter a username, scan a large platform set through the WhatsMyName API, review categorized hits, receive an AI-generated exposure assessment, save the scan to Firestore, and export a readable PDF report.

The final experience should feel native to JoeScan:

- Same visual system
- Same bilingual behavior
- Same persistence model as the other analyzers
- Same report/export expectations
- Same reliability bar as the rest of the product

---

## Confirmed external dependency

The current code targets the WhatsMyName API at `https://whatsmyname.ink`.

Verified current documentation:

- API docs: [WhatsMyName API Documentation](https://whatsmyname.ink/api-docs)
- Platform coverage page: [WhatsMyName Platforms](https://whatsmyname.ink/platforms)

What the docs currently confirm:

- `POST /api/search` starts a username search
- `GET /api/search?id={queryId}` polls for status and results
- `GET /api/platforms` returns platform metadata
- Free tier is rate limited

This matches the assumptions already present in `E:\joescan\src\lib\socialOsint.ts`.

---

## Current state snapshot

### Already implemented

1. App shell integration
   - `social` tab is registered in `E:\joescan\src\App.tsx`
   - `SocialOsintScanner` is imported and rendered

2. Localization wiring
   - Social OSINT copy keys are present in `E:\joescan\src\contexts\LanguageContext.tsx`

3. API integration
   - `searchUsername()` exists in `E:\joescan\src\lib\socialOsint.ts`
   - Platform categorization logic exists
   - Polling flow exists

4. AI analysis
   - `analyzeSocialFootprint()` exists in `E:\joescan\src\lib\gemini.ts`

5. UI flow
   - Username input, scan action, progress bar, grouped results, AI panel, and PDF download are already implemented in `E:\joescan\src\components\SocialOsintScanner.tsx`

6. Persistence
   - Firestore save logic for `type: 'social_osint'` already exists

7. Type safety
   - `npx tsc --noEmit` currently passes successfully

### Gaps still worth addressing

1. The existing markdown plan is stale and assumes the feature does not exist yet.
2. The user-facing translations and markdown file show encoding corruption in some environments.
3. API handling is functional but not yet resilient enough for production traffic.
4. PDF export works, but it is still generic rather than Social OSINT specific.
5. There are no dedicated tests for the new flow.
6. There is no documented acceptance checklist tied to this module.

---

## Scope

### In scope

- Username-based social OSINT scanning
- Progress feedback during remote enumeration
- Categorized result display
- AI exposure and risk assessment
- Firestore persistence
- PDF export
- EN and AR support
- Error handling and resilience improvements
- Validation and QA

### Out of scope for this phase

- Batch username scanning
- Historical diffing between two Social OSINT scans
- Forced refresh or cache bypass controls
- Background jobs or scheduled rescans
- CSV or JSON exports
- Platform-level screenshots or previews

---

## Implementation strategy

The work should proceed as a hardening pass in six phases:

1. Normalize text and documentation
2. Harden the API layer
3. Tighten the UI and state model
4. Improve persistence and downstream reporting
5. Add validation coverage
6. Run manual QA and release checks

---

## Phase 1 - Normalize text and documentation

### Objective

Remove confusion caused by stale instructions and encoding issues.

### Files

- `E:\joescan\implementation_plan.md`
- `E:\joescan\src\contexts\LanguageContext.tsx`
- `E:\joescan\src\lib\generatePDF.ts`
- Any user-facing strings in `E:\joescan\src\components\SocialOsintScanner.tsx`

### Tasks

1. Replace the old greenfield plan with this reality-based plan.
2. Audit the Social OSINT translation strings and confirm the source file is saved with proper UTF-8 encoding.
3. Verify Arabic strings render correctly in the browser, not only in the editor.
4. Remove fallback strings where translated keys already exist, unless the fallback protects runtime safety.
5. Normalize labels such as "Download Report" to use shared translation keys where possible.

### Deliverable

A clean document set and correctly rendered Social OSINT copy in English and Arabic.

---

## Phase 2 - Harden the API layer

### Objective

Make the WhatsMyName integration resilient to rate limits, timeouts, partial failures, and browser quirks.

### Primary file

- `E:\joescan\src\lib\socialOsint.ts`

### Tasks

1. Add input validation before network calls.
   - Trim whitespace
   - Reject empty usernames
   - Consider a simple username length cap to prevent abuse and malformed requests

2. Strengthen polling behavior.
   - Guard against non-JSON responses
   - Guard against missing `queryId`
   - Handle incomplete payloads safely
   - Stop polling on terminal failures

3. Improve rate-limit handling.
   - Preserve the existing `RATE_LIMIT` error contract
   - Add optional exponential backoff for repeated transient failures
   - Differentiate `429`, timeout, network, and malformed response errors

4. Add cancellation support.
   - Use `AbortController` so a component unmount or a new scan can cancel the in-flight request chain

5. Decide whether to keep direct browser calls or move to a proxy.
   - If browser CORS remains stable, keep direct calls
   - If CORS becomes unreliable, introduce a small backend relay instead of depending on a public proxy service

6. Consider using the platform metadata endpoint.
   - `GET /api/platforms` can be used to improve category mapping instead of relying only on keyword heuristics
   - If adopted, cache the metadata client-side and map categories from source data first, then fall back to local keywords

### Acceptance criteria

- Empty or invalid input never triggers a remote scan
- Network failures surface readable errors
- Rate limits produce a specific user-facing message
- Polling never hangs indefinitely
- Starting a new scan does not leave the old one running in the background

---

## Phase 3 - Tighten the UI and state model

### Objective

Make the feature feel polished, predictable, and consistent with other JoeScan analyzers.

### Primary file

- `E:\joescan\src\components\SocialOsintScanner.tsx`

### Tasks

1. Formalize UI states.
   - Idle
   - Scanning
   - AI analyzing
   - Success with hits
   - Success with no hits
   - Error

2. Review state reset behavior.
   - Clear previous scan results when a new scan begins
   - Clear previous AI output before rescanning
   - Ensure progress disappears only when scanning is truly finished

3. Improve progress messaging.
   - Keep current checked versus total display
   - Consider exposing the remote status string if it is useful and user-safe
   - Prevent percentage jitter if total changes unexpectedly

4. Tighten result rendering.
   - Sort categories in a stable order: social, professional, gaming, forums, other
   - Sort items alphabetically within each category
   - Show a stable count badge per category

5. Improve accessibility.
   - Add `aria-live` to progress and error regions
   - Ensure keyboard users can submit and tab through result cards
   - Confirm color contrast for risk badges in both themes

6. Improve empty-state clarity.
   - Distinguish "no accounts found" from "scan failed"
   - Show the scanned username in the empty state if useful

7. Review favicon loading.
   - Keep graceful fallback when a favicon fails
   - Avoid UI breakage if `new URL(hit.url)` throws on malformed URLs

8. Review report button behavior.
   - Use translated text
   - Disable or hide the button until AI analysis is ready

### Acceptance criteria

- No stale data leaks between scans
- Result ordering is stable across renders
- The feature is usable with keyboard-only interaction
- The UI clearly separates scanning, analyzing, success, and error states

---

## Phase 4 - Improve persistence and reporting

### Objective

Make saved Social OSINT scans useful in history, dashboard summaries, and exported reports.

### Primary files

- `E:\joescan\src\components\SocialOsintScanner.tsx`
- `E:\joescan\src\components\ScanHistory.tsx`
- `E:\joescan\src\components\Dashboard.tsx`
- `E:\joescan\src\lib\generatePDF.ts`

### Tasks

1. Validate Firestore payload shape.
   - Confirm `social_osint` records show up correctly wherever scan types are summarized
   - Confirm history filters do not silently exclude the new type

2. Decide whether additional fields should be stored.
   - Category counts
   - Top platforms
   - Total platforms checked
   - Raw hit URLs or only platform names

3. Upgrade PDF output for Social OSINT.
   - Add a "Platforms Found" section
   - Include grouped platform lists
   - Include category counts
   - Keep the existing executive summary and action plan

4. Confirm dashboard compatibility.
   - If dashboard charts group scan types, verify `social_osint` is counted
   - If dashboard labels are user-facing, add a readable label for this module

### Acceptance criteria

- A saved Social OSINT scan appears in history
- The new scan type does not break existing summaries
- The PDF contains Social OSINT-specific evidence, not only generic text

---

## Phase 5 - Add validation coverage

### Objective

Protect the new module against regressions.

### Suggested coverage areas

1. Unit tests for `socialOsint.ts`
   - Category mapping
   - Response parsing
   - Error propagation
   - Timeout handling

2. Component tests for `SocialOsintScanner.tsx`
   - Happy path with hits
   - No-hit path
   - Rate-limit error path
   - AI analysis rendering
   - PDF button visibility rules

3. Optional smoke tests for integration points
   - App navigation reaches the component
   - Firestore save path is called with the expected shape

### Notes

- The repository does not currently show a test harness in the inspected files, so adding tests may require introducing a test runner such as Vitest and React Testing Library.
- If test setup is deferred, capture that explicitly as a documented risk rather than leaving the gap implicit.

### Acceptance criteria

- Core parsing logic is covered by automated tests
- At minimum, the error and happy paths are protected

---

## Phase 6 - Manual QA and release checks

### Objective

Prove the feature works end-to-end in the real app.

### Commands

```bash
npm run dev
npx tsc --noEmit
```

### Manual QA checklist

1. Start the app and open `http://localhost:3000`
2. Verify the `Social OSINT` tab appears in navigation
3. Open the module and confirm the layout matches the app design system
4. Search a known username
5. Confirm the progress bar updates during scanning
6. Confirm grouped platform results render
7. Confirm the AI panel appears after scan completion
8. Confirm a Firestore scan record is created for signed-in users
9. Download the PDF and confirm the report is readable
10. Switch to Arabic and verify RTL alignment and readable Arabic strings
11. Repeat a scan quickly to test reset behavior
12. Trigger an invalid input or network failure and verify the error state

### Release gate

Do not consider the module complete until:

- TypeScript passes
- Manual QA passes
- Firestore persistence is confirmed
- PDF export is confirmed
- Arabic rendering is confirmed in-browser

---

## Execution order

Use this order to minimize rework:

1. Documentation and encoding cleanup
2. API hardening in `socialOsint.ts`
3. UI state cleanup in `SocialOsintScanner.tsx`
4. Persistence and history/dashboard verification
5. PDF enhancement
6. Automated validation
7. Manual QA

---

## Risk register

### Risk 1 - External API rate limiting

Impact:
- Users may hit free-tier limits during demos or repeated scans

Mitigation:
- Preserve explicit `RATE_LIMIT` handling
- Consider local caching or queued retries
- Document expected free-tier behavior in the UI if needed

### Risk 2 - CORS instability

Impact:
- Browser-only integration may fail unpredictably

Mitigation:
- Prefer a first-party relay endpoint over a third-party public CORS proxy if direct browser access proves unstable

### Risk 3 - Weak category accuracy

Impact:
- Some hits may be grouped incorrectly

Mitigation:
- Use platform metadata from the provider if available
- Keep keyword fallback only as a secondary classifier

### Risk 4 - Arabic rendering issues

Impact:
- Social OSINT strings may display incorrectly despite compiling

Mitigation:
- Save sources as UTF-8
- Verify in the running browser, not only in the terminal

### Risk 5 - Generic PDF output

Impact:
- Exported reports may undersell the value of the scan

Mitigation:
- Add Social OSINT-specific sections before shipping

---

## Definition of done

The Social Media OSINT Scanner is done when all of the following are true:

1. A user can scan a username successfully from the JoeScan UI.
2. Progress, success, no-result, and error states are all clear and stable.
3. Results are grouped and readable.
4. AI analysis appears reliably after scan completion.
5. Firestore saves the scan with the expected structure.
6. The new scan type is visible in downstream product surfaces where appropriate.
7. PDF export includes Social OSINT-specific content.
8. English and Arabic both render correctly.
9. TypeScript passes and the core logic is validated.

---

## Recommended next action

If implementation work continues from here, the highest-value next step is:

1. Harden `E:\joescan\src\lib\socialOsint.ts`
2. Polish `E:\joescan\src\components\SocialOsintScanner.tsx`
3. Upgrade `E:\joescan\src\lib\generatePDF.ts` for Social OSINT-specific reporting

That sequence gives the best balance of user-visible quality and release safety.

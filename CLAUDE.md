# CLAUDE.md — NexusRank

NexusRank is a Chrome Extension (Manifest V3) by WebsNexus that runs SEO, AEO and GEO analysis on the page that is open in the current tab. All analysis happens locally. The full product spec is in `docs/SPEC.md`, and the build plan is in `docs/PLAN.md`. Read both before you start any phase.

## Non-negotiable rules
1. **No network calls with page data.** Never send page content, URLs or reports anywhere. The only fetches allowed are same-origin `robots.txt` and the sitemap from the content-script context.
2. **No remote code or fonts.** Bundle everything, including Bootstrap, Lucide and jsPDF. Use system font stacks only. Don't load anything from a CDN.
3. **Least privilege.** Start with `activeTab`, `scripting` and `storage`. Don't use `<all_urls>`, `tabs` or `host_permissions` unless a phase explicitly justifies it in `docs/PERMISSIONS.md`.
4. **No fake data.** Don't hardcode sample results, add placeholder scores or leave buttons that do nothing. If something can't be measured, use the status `not_tested` and give the reason.
5. **Honest claims.** Never claim to know Google rankings, AI-engine citations, backlinks, search volume or Core Web Vitals. Performance numbers are "lightweight indicators", not Lighthouse results.
6. **Recommended ≠ required.** In the schema inspector, label properties as `recommended` unless a spec truly mandates them.

## Architecture contract (most important)
```
Page (content script) ──extract──▶ PageSnapshot (plain JSON, serializable)
                                         │
                       analyzers (pure functions, no DOM, no chrome.*)
                                         ▼
                                    CheckResult[]
                                         │
                                 scoring engine (config-driven)
                                         ▼
                                     AuditReport ──▶ storage / UI / exports
```
- `src/content/extractor.ts` is the **only** code that touches the live page DOM. It returns a `PageSnapshot` (see `src/types/snapshot.ts`).
- Analyzers in `src/analyzers/**` are **pure** functions of the form `(snapshot) => CheckResult[]`. They don't use `document`, `window` or `chrome`, so they can run in Node/Vitest.
- Every `CheckResult` has: `id`, `category` (`technical` | `onpage` | `aeo` | `geo`), `severity` (`critical` | `high` | `medium` | `low` | `info`), `status` (`passed` | `warning` | `failed` | `not_applicable` | `not_tested`), `weight`, `evidence` (real extracted values), `explanation` and `recommendation`.
- Scoring weights and thresholds (for example, title length 30–60) live in `src/scoring/config.ts`. Never put magic numbers in analyzers.
- Checks with the status `not_applicable` or `not_tested` are excluded from both the numerator and the denominator.
- The dashboard is an extension page (`dashboard.html`). It receives the target `tabId` through a URL param or a message and never analyzes itself.

## Folder layout
```
src/
  background/      service worker: orchestrates injection, messaging
  content/         extractor.ts (DOM → PageSnapshot)
  analyzers/       seo/ aeo/ geo/ schema/ content/ links/  (pure)
  scoring/         config.ts, engine.ts
  reports/         pdf.ts csv.ts json.ts
  storage/         history.ts (chrome.storage.local wrapper)
  popup/           React popup
  dashboard/       React dashboard + sections
  components/ hooks/ utils/ types/
tests/
  fixtures/        static HTML pages
  unit/            vitest
  e2e/             playwright
docs/              SPEC.md PLAN.md PERMISSIONS.md LIMITATIONS.md DEVELOPER.md
```

## Commands
- `npm run dev`: Vite watch build into `dist/`
- `npm run build`: production build into `dist/`
- `npm run typecheck`: `tsc --noEmit`
- `npm run lint`
- `npm test`: Vitest
- `npm run test:e2e`: Playwright (loads `dist/` as an unpacked extension)

## Working rules
- Work **one phase at a time** from `docs/PLAN.md`. At the end of every phase, run `typecheck`, `lint`, `test` and `build`, and fix every failure before you stop.
- After each phase, update the phase checklist in `docs/PLAN.md` and write a short summary of what changed and what still needs doing.
- Write tests at the same time as each analyzer. Don't save them for the end.
- Use TypeScript `strict` mode. Don't use `any` without a comment that explains why.
- Keep dependencies minimal. Ask before you add anything outside the stack in the spec.
- When a requirement is ambiguous, pick the more honest and privacy-preserving option and note it in `docs/LIMITATIONS.md`.

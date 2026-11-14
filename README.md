# NexusRank

SEO, AEO and GEO analysis of the page you have open, by WebsNexus. A Chrome extension (Manifest V3) that runs **entirely in your browser**: no paid APIs, no AI APIs, no backend, no remote code or fonts, and no page data leaves your machine.

It scores four areas from real, measurable page signals:

| Area                            | Share of overall score |
| ------------------------------- | ---------------------- |
| Technical SEO                   | 35%                    |
| On-page SEO                     | 25%                    |
| AEO (answer engine readiness)   | 20%                    |
| GEO (generative engine signals) | 20%                    |

Every check has an ID, category, severity, status (passed / warning / failed / not applicable / not tested), weight, the actual evidence found, an explanation and a recommendation. Checks that don't apply or couldn't be measured are excluded from the score instead of being penalized. The weights, thresholds and severity multipliers are configurable in `src/scoring/config.ts`.

> NexusRank reports on-page indicators. It does **not** measure search rankings, AI-engine citations, backlinks, keyword volume or Core Web Vitals. See [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Features

- **Popup:** analyze the current page, see the overall and four category scores, the top issues, re-analyze, and open the dashboard.
- **Dashboard:** Overview (with a transparent score breakdown), Technical SEO, On-page (SERP snippet and metadata preview), AEO Intelligence, GEO Intelligence, Schema Inspector (JSON-LD, Microdata, RDFa; recommended vs. missing properties; syntax errors; raw viewer), Content Structure (heading tree), Links, History (trend chart), Compare (two saved audits side by side) and Reports.
- **Filters and evidence:** filter checks by status, severity and category; expand any check to see the evidence behind it.
- **Exports:** PDF (multi-page, with the limitations disclaimer), CSV (one row per check) and JSON (the full report). Files are created in the browser.
- **Local history:** reports only (never page HTML) in `chrome.storage.local`, with a configurable cap (default 50).

## Install (development build)

```bash
npm install
npm run build
```

Then in Chrome open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `dist/` folder. Open a normal web page, click the NexusRank icon and choose **Analyze page**.

Pages Chrome does not allow extensions to read (`chrome://`, the Web Store, `file://`, PDFs) show a friendly "can't analyze this page" message.

## Develop and test

| Command              | What it does                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev`        | Watch build into `dist/`                                                                                        |
| `npm run build`      | Production build into `dist/`                                                                                   |
| `npm run typecheck`  | `tsc --noEmit` (strict)                                                                                         |
| `npm run lint`       | ESLint                                                                                                          |
| `npm test`           | Unit tests (Vitest + happy-dom)                                                                                 |
| `npm run test:e2e`   | Playwright against the real extension in Chromium (set `CHROME_PATH`, or run `npx playwright install chromium`) |
| `npm run audit:dist` | Privacy and permissions audit of `dist/`                                                                        |
| `npm run package`    | Build, audit and write `release/nexusrank-<version>.zip` for the Chrome Web Store                               |

The full gate is `npm run typecheck && npm run lint && npm test && npm run build`.

## How it works

```
Page ──content script (src/content)──▶ PageSnapshot (plain JSON)
        analyzers (src/analyzers, pure) ──▶ CheckResult[]
        scoring engine (src/scoring) ──▶ AuditReport ──▶ storage / dashboard / exports
```

Only `src/content/` touches the page DOM. Analyzers are pure functions of a snapshot, so they run in Node and are tested against HTML fixtures in `tests/fixtures`. See [docs/DEVELOPER.md](docs/DEVELOPER.md) (architecture and how to add a check), [docs/PERMISSIONS.md](docs/PERMISSIONS.md) and [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Privacy

NexusRank asks for `activeTab`, `scripting` and `storage` only: no access to all websites, no browsing history, no ads, no analytics. The only network requests are same-origin `robots.txt` and sitemap fetches for the page you analyze. Details in [docs/PERMISSIONS.md](docs/PERMISSIONS.md).

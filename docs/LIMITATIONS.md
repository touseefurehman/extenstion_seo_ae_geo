# Known limitations

NexusRank runs entirely in your browser and reads the page you have open. That makes it private, but it also limits what it can honestly say.

## What NexusRank does not measure

- **Search rankings.** It never claims to know where a page ranks on Google or any other engine.
- **AI-engine citations or visibility.** AEO and GEO results are on-page signals (questions, answer structure, entities, authorship, structured data). They do not show whether ChatGPT, Gemini, Claude, Perplexity or any other system uses or cites the page, and detecting a question or schema never means an answer engine will select it.
- **Backlinks and keyword search volume.** No backlink or keyword data source is used.
- **Core Web Vitals / Lighthouse.** Performance items (DOM size, HTML size, script and stylesheet counts, lazy-loading, resource weight) are lightweight indicators only.

## What a browser extension cannot see

- The extractor reads the **rendered DOM**, not the HTTP response. The status code, response headers (for example `X-Robots-Tag`) and the original server HTML are not accessible, so checks that depend on them are not performed.
- Hidden elements (CSS `display:none`, collapsed content) are still extracted; visibility is not evaluated.
- iframes and shadow DOM are not analyzed in v1.
- Single-page apps are analyzed as they appear at the moment of the click. Re-analyze to pick up later changes.
- Pages extensions cannot read are refused with a clear message: `chrome://` and other browser pages, the Chrome Web Store, `file://` URLs and PDFs.
- `activeTab` access is granted only by clicking the extension icon on that tab. The dashboard therefore shows saved reports and cannot re-analyze a tab by itself; use the popup to re-analyze. Chrome also reveals a tab's URL to the popup only while that access is granted.
- Resource sizes from the Performance API are withheld by the browser for cross-origin resources without `Timing-Allow-Origin`. They are reported as inaccessible (`null`), never as 0, and checks that depend on them become `not_tested` when too little is measurable.
- Image natural size is 0 for images that have not loaded (for example lazy-loaded below the fold); `complete` says whether the value is meaningful.

## robots.txt and sitemap

- Both are fetched same-origin from the page. If the site's CSP, a login wall, a redirect to another origin, a timeout or a network error blocks the request, the result is `inaccessible` (and the check is `not_tested`), never `not_found`.
- A 200 response that serves HTML is treated as `not_found` (soft 404). Cross-origin and `.gz` sitemaps are not fetched, and a relative `Sitemap:` line (invalid per the spec) is reported as such. Only the declared or default `/sitemap.xml` location is checked.

## Heuristics and guidelines

- Thresholds (title 30-60 characters, description 70-160, DOM size, paragraph length, direct-answer 40-60 words, and so on) and all weights are editable guidelines in `src/scoring/config.ts`, not search-engine rules.
- A `noindex`/`nofollow` meta tag is a warning, not a failure, because it is often intentional.
- Image lazy-loading is judged on every image after the first (the first is assumed to be above the fold); real fold position is not measured.
- Question/answer proximity treats the first paragraph under a question heading (or the next paragraph after a question paragraph) as the answer. Whether it actually answers the question is not judged.
- Readability uses the Flesch Reading Ease formula and is applied to English pages only (other languages are `not_tested`). It uses a rough syllable counter and the (possibly shortened) paragraph text in the snapshot.
- Author, date, byline, brand and claim detection are heuristics (meta tags, `rel=author`, `itemprop`, `time` elements, class names, wording patterns). GEO results are marked `detected` or `inferred`; expertise indicators do not verify credentials.
- hreflang validation checks code syntax, absolute URLs and a self-reference; reciprocal links on the other language pages cannot be verified from one page.
- Schema "recommended" property lists reflect common search-engine guidance, are not exhaustive, and are never presented as schema.org requirements. RDFa support covers `typeof`/`property` items (no full prefix/vocab resolution); Microdata `itemref` is not followed.

## Data size and storage

- Extraction is capped to keep snapshots small (for example 500 paragraphs, 3000 links, 1000 images). Real counts stay in `totals` and capped fields are listed in `truncated`; analyses and the UI say when a result is based on partial data.
- Saved reports keep a further size-reduced copy of the extracted data (for example 200 paragraphs, 500 links, 200 images) and never the page HTML.
- History lives in `chrome.storage.local` (about 10 MB without `unlimitedStorage`, which is not requested). NexusRank keeps a soft 8 MB budget and a configurable report cap (default 50), evicting the oldest reports first.
- The PDF export uses the built-in PDF fonts (Latin-1). Characters outside Latin-1 (for example CJK text in a page title) are replaced with `?` in the PDF; CSV and JSON keep the original text.

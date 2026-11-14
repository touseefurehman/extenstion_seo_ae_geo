# Known limitations

- Pages that extensions cannot read are refused with a clear message: `chrome://` and other browser pages, the Chrome Web Store, `file://` URLs and PDFs.
- Single-page apps are analyzed as they appear at the moment of the click. Re-analyze to pick up later changes.
- iframes and shadow DOM are not analyzed in v1.
- `activeTab` is granted only when the user clicks the extension icon, so automated tests cannot trigger a full analyze flow through the popup; the content script and background logic are tested separately.
- Chrome returns a tab's URL only while `activeTab` is granted, so the popup shows "no readable address" if opened outside the toolbar click.
- The extractor reads the **rendered DOM**, not the HTTP response. The page's status code, response headers (for example `X-Robots-Tag`) and the original server HTML are not accessible, so checks that depend on them are `not_tested`.
- Hidden elements (CSS `display:none`, collapsed content) are still extracted; visibility is not evaluated.
- Extraction is capped to keep snapshots small (for example 500 paragraphs, 3000 links, 1000 images). Real counts are kept in `totals` and the capped fields are listed in `truncated`; analyzers and the UI must say so when a result is based on partial data.
- `robots.txt` and the sitemap are fetched same-origin from the page. If the site's CSP, a login wall or a network error blocks the request, the result is `inaccessible`, never `not_found`. A 200 response that serves HTML is treated as `not_found` (soft 404). Cross-origin and `.gz` sitemaps are not fetched, and a relative `Sitemap:` line (invalid per the spec) is reported as such.
- Resource sizes from the Performance API are reported as inaccessible (null) when the browser withholds them (cross-origin without `Timing-Allow-Origin`); they are never reported as 0.
- Image natural size is 0 for images that have not loaded (for example lazy-loaded below the fold); `complete` tells you whether the value is meaningful.
- RDFa support covers `typeof`/`property` items (not full RDFa prefix/vocab resolution). Microdata `itemref` is not followed.
- Author, date and byline detection are heuristics (meta tags, `rel=author`, `itemprop`, `time` elements, `author`/`byline` class names).

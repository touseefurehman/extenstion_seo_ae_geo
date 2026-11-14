# Permissions

NexusRank requests the minimum needed to analyze the page you choose.

| Permission  | Why it is needed                                                                                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `activeTab` | Temporary access to the tab you are analyzing, granted when you click the extension icon. It lets NexusRank inject its content script and read that tab's address. Access ends when you navigate away or close the tab. |
| `scripting` | Injects `content.js` into that tab with `chrome.scripting.executeScript`.                                                                                                                                               |
| `storage`   | Saves your audit history locally with `chrome.storage.local`. Nothing is synced or uploaded.                                                                                                                            |

## Not requested (and why)

- **`<all_urls>` / `host_permissions`**: not needed. `activeTab` covers the page you click on, and `robots.txt` and the sitemap are fetched by the content script from the page's own origin.
- **`tabs`**: not needed. The popup learns the active tab's URL through `activeTab`.
- **`downloads`**: exports are created as Blob URLs and saved with a normal `<a download>` link.
- **`unlimitedStorage`**: not needed. History is capped (default 50 reports, about 8 MB budget) and stores reports only, never page HTML.
- **`webRequest`, `cookies`, `history`, `bookmarks`, `identity`**, remote code, remote fonts and CDN assets: none are used.

## Network behaviour

- The only requests NexusRank makes are same-origin `GET`s for `/robots.txt` and the declared or default `/sitemap.xml` of the page being analyzed, sent from the page context without credentials. No page content, URL or report is sent anywhere.
- Extension pages use a strict CSP (`script-src 'self'`), and all scripts, styles and icons are bundled.
- `npm run audit:dist` checks the built package: exactly these three permissions, no `host_permissions`, no remote URLs, no remote fonts or scripts. The end-to-end suite also records every network request in a full session and fails if any leaves the analyzed origin.

## Data stored

Audit reports (scores, check results, a trimmed copy of the extracted page signals) in `chrome.storage.local`. You can delete one report or the whole history in the dashboard's History section; uninstalling the extension removes everything.

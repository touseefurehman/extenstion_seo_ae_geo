# Permissions

| Permission  | Why it is needed                                                                      |
| ----------- | ------------------------------------------------------------------------------------- |
| `activeTab` | Temporary access to the tab the user is analyzing, granted by clicking the extension. |
| `scripting` | Injects `content.js` into that tab with `chrome.scripting.executeScript`.             |
| `storage`   | Saves audit history locally with `chrome.storage.local` (used from Phase 9).          |

Not requested: `<all_urls>`, `host_permissions`, `tabs`, `downloads`, `unlimitedStorage`.

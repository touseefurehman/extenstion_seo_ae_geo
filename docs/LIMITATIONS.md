# Known limitations

- Pages that extensions cannot read are refused with a clear message: `chrome://` and other browser pages, the Chrome Web Store, `file://` URLs and PDFs.
- Single-page apps are analyzed as they appear at the moment of the click. Re-analyze to pick up later changes.
- iframes and shadow DOM are not analyzed in v1.
- `activeTab` is granted only when the user clicks the extension icon, so automated tests cannot trigger a full analyze flow through the popup; the content script and background logic are tested separately.
- Chrome returns a tab's URL only while `activeTab` is granted, so the popup shows "no readable address" if opened outside the toolbar click.

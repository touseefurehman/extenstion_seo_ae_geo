# Test fixtures

Each `<name>.html` has a `<name>.expected.json`:

- `url` – the address the page is loaded under.
- `network` – optional mock responses for `/robots.txt` and `/sitemap.xml` (anything missing answers 404).
- `snapshot` – dotted path → expected value in the extracted `PageSnapshot` (checked now, in Phase 2/3).
- `snapshotNotNull`, `snapshotIncludes` – extra snapshot assertions.
- `checks` – check ID → expected status for the Phase 4+ analyzers. For now the tests only verify that
  the IDs and statuses are well-formed; Phase 4 runs the real analyzers against them.

`very-large.html` is generated (`npm run fixtures:large`; also done automatically before `npm test`) and is git-ignored.

Planned status rules the `checks` rely on: title 30-60 chars and description 70-160 chars pass (otherwise
warning); a missing title/description fails and its length check is not applicable; exactly one H1 passes,
none fails, several warn; skipped heading levels or empty headings warn; images missing `alt` warn up to 25%
and fail above that; robots.txt/sitemap: found passes, not found warns, inaccessible is not tested.

import type { PageSnapshot } from '../types/snapshot';
import { SERP_LIMITS, breadcrumbUrl, truncate } from '../utils/serp';

export function SerpPreview({ page }: { page: PageSnapshot }) {
  const title = page.head.title;
  const desc = page.head.metas.find((m) => m.name === 'description')?.content?.trim() || null;
  const t = title ? truncate(title, SERP_LIMITS.titleChars) : null;
  const d = desc ? truncate(desc, SERP_LIMITS.descriptionChars) : null;
  return (
    <figure className="nr-card nr-serp" aria-label="Search result snippet preview">
      <div className="nr-serp-url">
        {breadcrumbUrl(page.head.canonicals[0]?.resolved ?? page.url)}
      </div>
      <div className="nr-serp-title">
        {t ? (
          t.text
        ) : (
          <span className="nr-muted">(no title — a search engine would generate one)</span>
        )}
      </div>
      <div className="nr-serp-desc">
        {d ? (
          d.text
        ) : (
          <span className="nr-muted">
            (no meta description — a search engine would pick text from the page)
          </span>
        )}
      </div>
      <figcaption className="nr-muted small mt-2">
        Approximate preview using character limits ({SERP_LIMITS.titleChars}/
        {SERP_LIMITS.descriptionChars}). Real results vary by device and query.
        {t?.truncated && ' The title would be truncated.'}
        {d?.truncated && ' The description would be truncated.'}
      </figcaption>
    </figure>
  );
}

export function MetadataPreview({ page }: { page: PageSnapshot }) {
  const meta = (n: string) => page.head.metas.find((m) => m.name === n)?.content ?? null;
  const rows: [string, string | null][] = [
    [
      'Title',
      page.head.title === null ? null : `${page.head.title} (${page.head.title.length} chars)`,
    ],
    [
      'Description',
      meta('description') === null
        ? null
        : `${meta('description')} (${meta('description')?.length} chars)`,
    ],
    ['Canonical', page.head.canonicals[0]?.resolved ?? null],
    ['Robots', meta('robots')],
    ['Viewport', meta('viewport')],
    ['Language', page.head.lang],
    ['Charset', page.head.charset],
    [
      'hreflang alternates',
      page.head.hreflang.length ? page.head.hreflang.map((h) => h.lang).join(', ') : null,
    ],
    ...Object.entries(page.head.og).map(([k, v]): [string, string | null] => [k, v]),
    ...Object.entries(page.head.twitter).map(([k, v]): [string, string | null] => [k, v]),
  ];
  return (
    <table className="nr-evidence nr-meta-table">
      <caption className="visually-hidden">Page metadata</caption>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{v ?? <span className="nr-muted">not set</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

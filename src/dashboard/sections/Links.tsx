import { useMemo, useState } from 'react';
import type { AuditReport } from '../../types/report';
import { Panel, Section, Stat } from './common';

type Filter = 'all' | 'internal' | 'external' | 'nofollow' | 'samepage' | 'invalid' | 'empty';
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['internal', 'Internal'],
  ['external', 'External'],
  ['nofollow', 'nofollow / sponsored / ugc'],
  ['samepage', 'Same-page'],
  ['invalid', 'Invalid'],
  ['empty', 'Empty anchor'],
];
const PAGE = 100;

export function Links({ report }: { report: AuditReport }) {
  const { links, totals } = report.page;
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const stats = useMemo(() => {
    const http = links.filter((l) => l.kind === 'http');
    const rel = (t: string) => links.filter((l) => l.rel.includes(t)).length;
    return {
      internal: http.filter((l) => l.internal === true).length,
      external: http.filter((l) => l.internal === false).length,
      nofollow: rel('nofollow'),
      sponsored: rel('sponsored'),
      ugc: rel('ugc'),
      samePage: links.filter((l) => l.samePageHash).length,
      invalid: links.filter((l) => l.invalidScheme).length,
      empty: links.filter((l) => l.text === '' && !l.hasImage && !l.ariaLabel).length,
    };
  }, [links]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return links.filter((l) => {
      const ok =
        filter === 'all' ||
        (filter === 'internal' && l.kind === 'http' && l.internal === true) ||
        (filter === 'external' && l.kind === 'http' && l.internal === false) ||
        (filter === 'nofollow' &&
          l.rel.some((r) => ['nofollow', 'sponsored', 'ugc'].includes(r))) ||
        (filter === 'samepage' && l.samePageHash) ||
        (filter === 'invalid' && l.invalidScheme) ||
        (filter === 'empty' && l.text === '' && !l.hasImage && !l.ariaLabel);
      return ok && (q === '' || `${l.href} ${l.text}`.toLowerCase().includes(q));
    });
  }, [links, filter, query]);

  return (
    <Section title="Links" subtitle="Internal and external link summary for the analyzed page.">
      <div className="nr-grid-stats mb-3">
        <Stat label="Internal links" value={stats.internal} />
        <Stat label="External links" value={stats.external} />
        <Stat
          label="nofollow / sponsored / ugc"
          value={`${stats.nofollow} / ${stats.sponsored} / ${stats.ugc}`}
        />
        <Stat label="Same-page anchors" value={stats.samePage} />
        <Stat label="Invalid destinations" value={stats.invalid} />
        <Stat label="Empty anchors" value={stats.empty} />
      </div>
      {totals.links > links.length && (
        <p className="nr-muted small">
          The report stores the first {links.length} of {totals.links} links; the figures above
          cover those.
        </p>
      )}
      <Panel title={`Link list (${rows.length})`}>
        <div className="nr-filters">
          <div className="nr-filter-group" role="group" aria-label="Link filter">
            {FILTERS.map(([f, label]) => (
              <button
                key={f}
                type="button"
                className={`nr-chip${filter === f ? ' active' : ''}`}
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f);
                  setLimit(PAGE);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="form-control form-control-sm nr-input"
            placeholder="Search links…"
            aria-label="Search links"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
          />
        </div>
        {rows.length === 0 ? (
          <div className="nr-muted">No links match.</div>
        ) : (
          <div className="nr-table-wrap">
            <table className="nr-table nr-table-sm">
              <thead>
                <tr>
                  <th>Anchor text</th>
                  <th>Destination</th>
                  <th>Type</th>
                  <th>rel</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((l, i) => (
                  <tr key={i}>
                    <td>
                      {l.text || (
                        <span className="nr-muted">{l.hasImage ? '(image)' : '(empty)'}</span>
                      )}
                    </td>
                    <td className="nr-url">{l.href || '(empty)'}</td>
                    <td>{l.kind === 'http' ? (l.internal ? 'internal' : 'external') : l.kind}</td>
                    <td>{l.rel.join(' ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > limit && (
          <button
            type="button"
            className="nr-btn-secondary btn-sm mt-2"
            onClick={() => setLimit(limit + PAGE)}
          >
            Show more ({rows.length - limit} remaining)
          </button>
        )}
      </Panel>
    </Section>
  );
}

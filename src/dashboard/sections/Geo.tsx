import { CheckList } from '../../components/CheckList';
import { brandNames } from '../../analyzers/geo/geo';
import type { AuditReport } from '../../types/report';
import { THRESHOLDS } from '../../scoring/config';
import { Empty, Panel, Section } from './common';

const ENTITY_TYPES = [
  'Organization',
  'LocalBusiness',
  'Person',
  'Product',
  'Service',
  'Corporation',
  'Article',
  'WebSite',
];

export function Geo({ report }: { report: AuditReport }) {
  const page = report.page;
  const checks = report.checks.filter((c) => c.category === 'geo');
  const entities = report.schema.entities.filter((e) =>
    e.types.some((t) => ENTITY_TYPES.includes(t)),
  );
  const brands = brandNames(page);
  const counts = new Map<string, number>();
  for (const h of page.headings.filter((x) =>
    THRESHOLDS.geo.sectionHeadingLevels.includes(x.level),
  )) {
    for (const w of new Set(h.text.toLowerCase().match(/[\p{L}][\p{L}'-]{2,}/gu) ?? [])) {
      if (!THRESHOLDS.geo.stopwords.includes(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  const terms = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const sameAs = report.schema.entities.flatMap((e) =>
    e.properties.filter((p) => p.name === 'sameAs').map((p) => p.preview),
  );

  return (
    <Section
      title="GEO Intelligence"
      subtitle="Generative Engine Optimization: entity, identity and trust signals present on the page. NexusRank does not measure whether any AI system uses or cites the page."
    >
      <div className="row g-3">
        <div className="col-lg-6">
          <Panel title={`Entities in structured data (${entities.length})`}>
            {entities.length === 0 ? (
              <Empty>
                No Organization, Person, Product, Service or Article entities were found.
              </Empty>
            ) : (
              <ul className="nr-list">
                {entities.slice(0, 12).map((e) => {
                  const name = e.properties.find(
                    (p) => p.name === 'name' || p.name === 'headline',
                  )?.preview;
                  return (
                    <li key={e.index}>
                      <span className="nr-tag">{e.syntax}</span>{' '}
                      <strong>{e.types.join(', ')}</strong>
                      {name ? ` — ${name}` : ''}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="nr-muted small mt-2">
              sameAs values: {sameAs.length ? sameAs.join('; ') : 'none found'}
            </div>
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title="Business identity">
            <dl className="nr-dl">
              <dt>Brand names</dt>
              <dd>
                {brands.length
                  ? brands.map((b) => `${b.name} (${b.source})`).join(', ')
                  : 'none found'}
              </dd>
              <dt>Phone</dt>
              <dd>{page.signals.telLinks.join(', ') || 'none'}</dd>
              <dt>Email</dt>
              <dd>{page.signals.mailtoLinks.join(', ') || 'none'}</dd>
              <dt>Address</dt>
              <dd>{page.signals.addresses.join(' | ') || 'none'}</dd>
            </dl>
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title="Authorship and dates">
            <dl className="nr-dl">
              <dt>Authors</dt>
              <dd>
                {page.signals.authors.length
                  ? page.signals.authors.map((a) => `${a.text} (${a.source})`).join('; ')
                  : 'none detected'}
              </dd>
              <dt>Dates</dt>
              <dd>
                {page.signals.dates.length
                  ? page.signals.dates.map((d) => `${d.value} (${d.kind})`).join('; ')
                  : 'none detected'}
              </dd>
            </dl>
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel
            title="Topical signals"
            note="Terms repeated across H2-H4 headings. This is a rough indicator of focus, not topical authority."
          >
            {terms.length === 0 ? (
              <Empty>Not enough headings to show topical terms.</Empty>
            ) : (
              <div className="nr-tags">
                {terms.map(([w, n]) => (
                  <span key={w} className="nr-tag">
                    {w} ×{n}
                  </span>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
      <h3 className="h6 mt-2">All GEO checks</h3>
      <p className="nr-muted small">
        “Detected” means found directly on the page; “Inferred” means a heuristic based on page
        signals.
      </p>
      <CheckList checks={checks} />
    </Section>
  );
}

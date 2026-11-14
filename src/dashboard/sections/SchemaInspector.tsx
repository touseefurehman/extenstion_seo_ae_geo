import { useState } from 'react';
import { JsonViewer } from '../../components/JsonViewer';
import type { InspectedEntity } from '../../analyzers/schema/inspect';
import type { AuditReport } from '../../types/report';
import { Empty, Panel, Section } from './common';

export function SchemaInspector({ report }: { report: AuditReport }) {
  const { schema, page } = report;
  const [tab, setTab] = useState<'entities' | 'raw'>('entities');
  const [selected, setSelected] = useState<number>(0);
  const entity: InspectedEntity | undefined = schema.entities[selected];
  const invalid = schema.blocks.filter((b) => !b.valid);

  return (
    <Section
      title="Schema Inspector"
      subtitle="JSON-LD, Microdata and RDFa found on the page. Properties are labelled “recommended”, never “required”: schema.org mandates none."
    >
      <div className="nr-grid-stats mb-3">
        <div className="nr-card nr-stat">
          <div className="nr-stat-value">{schema.counts.jsonld}</div>
          <div className="nr-stat-label">JSON-LD blocks</div>
        </div>
        <div className="nr-card nr-stat">
          <div className="nr-stat-value">{schema.counts.microdata}</div>
          <div className="nr-stat-label">Microdata items</div>
        </div>
        <div className="nr-card nr-stat">
          <div className="nr-stat-value">{schema.counts.rdfa}</div>
          <div className="nr-stat-label">RDFa items</div>
        </div>
        <div className="nr-card nr-stat">
          <div className="nr-stat-value">{schema.counts.invalidBlocks}</div>
          <div className="nr-stat-label">Invalid JSON-LD blocks</div>
        </div>
      </div>

      {invalid.map((b) => (
        <div key={b.index} className="nr-card nr-card-error mb-2" role="alert">
          <strong>JSON-LD block {b.index + 1} has a syntax error.</strong>
          <div className="nr-muted">{b.error}</div>
        </div>
      ))}

      <div className="nr-tabs" role="tablist">
        {(['entities', 'raw'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`nr-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'entities' ? 'Entities' : 'Raw structured data'}
          </button>
        ))}
      </div>

      {tab === 'entities' ? (
        schema.entities.length === 0 ? (
          <Empty>No structured data entities were found on this page.</Empty>
        ) : (
          <div className="row g-3">
            <div className="col-lg-4">
              <ul className="nr-entity-list" aria-label="Entities">
                {schema.entities.map((e) => (
                  <li key={e.index} style={{ paddingLeft: e.depth * 14 }}>
                    <button
                      type="button"
                      className={`nr-entity${selected === e.index ? ' active' : ''}`}
                      aria-current={selected === e.index}
                      onClick={() => setSelected(e.index)}
                    >
                      {e.types.join(', ')} <span className="nr-muted small">{e.syntax}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-lg-8">
              {entity && (
                <Panel
                  title={`${entity.types.join(', ')} (${entity.syntax}, block ${entity.blockIndex + 1})`}
                >
                  <table className="nr-table nr-table-sm">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Value</th>
                        <th>Kind</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entity.properties.map((p) => (
                        <tr key={p.name}>
                          <td>
                            <code>{p.name}</code>
                          </td>
                          <td>
                            {p.preview || <span className="nr-muted">(object)</span>}
                            {p.nested ? ' ↳' : ''}
                          </td>
                          <td>{p.level}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {entity.matchedType ? (
                    <div className="mt-2">
                      <div className="small fw-semibold">
                        Missing recommended properties ({entity.matchedType})
                      </div>
                      {entity.missingRecommended.length === 0 ? (
                        <div className="nr-muted small">
                          None. All recommended properties are present.
                        </div>
                      ) : (
                        <div className="nr-tags">
                          {entity.missingRecommended.map((m) => (
                            <span key={m} className="nr-tag">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="nr-muted small mt-1">
                        These are recommendations (for example for rich results), not schema.org
                        requirements.
                      </div>
                    </div>
                  ) : (
                    <div className="nr-muted small mt-2">
                      No property guidance is available for this type.
                    </div>
                  )}
                </Panel>
              )}
            </div>
          </div>
        )
      ) : (
        <div>
          {page.structuredData.jsonld.length === 0 &&
            page.structuredData.microdata.length === 0 &&
            page.structuredData.rdfa.length === 0 && (
              <Empty>No structured data on this page.</Empty>
            )}
          {page.structuredData.jsonld.map((b) => {
            const raw = schema.rawJsonLd.find((r) => r.index === b.index);
            return (
              <Panel
                key={b.index}
                title={`JSON-LD block ${b.index + 1} — ${b.error === null ? 'valid' : 'invalid'}`}
              >
                {b.error !== null ? (
                  <>
                    <div className="nr-muted mb-2">{b.error}</div>
                    <pre className="nr-pre">{raw?.raw || '(empty block)'}</pre>
                  </>
                ) : (
                  <JsonViewer value={b.parsed} />
                )}
              </Panel>
            );
          })}
          {page.structuredData.microdata.length > 0 && (
            <Panel title="Microdata">
              <JsonViewer value={page.structuredData.microdata} />
            </Panel>
          )}
          {page.structuredData.rdfa.length > 0 && (
            <Panel title="RDFa">
              <JsonViewer value={page.structuredData.rdfa} />
            </Panel>
          )}
        </div>
      )}
    </Section>
  );
}

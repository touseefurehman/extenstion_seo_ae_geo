import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '../../components/Badges';
import type { History, HistoryEntry } from '../../storage/history';
import type { AuditReport } from '../../types/report';
import { diffReports } from '../../utils/compare';
import { CATEGORY_LABELS } from '../../utils/labels';
import { Empty, Panel, Section } from './common';

const label = (e: HistoryEntry) =>
  `${new Date(e.createdAt).toLocaleString()} — ${e.title ?? e.url} (${e.overall ?? 'n/a'})`;

function Delta({ d }: { d: number | null }) {
  if (d === null) return <span className="nr-muted">—</span>;
  return (
    <span className={d > 0 ? 'nr-delta-up' : d < 0 ? 'nr-delta-down' : 'nr-muted'}>
      {d > 0 ? `+${d}` : d}
    </span>
  );
}

export function Compare({ entries, history }: { entries: HistoryEntry[]; history: History }) {
  const [idA, setIdA] = useState<string>(entries[1]?.id ?? entries[0]?.id ?? '');
  const [idB, setIdB] = useState<string>(entries[0]?.id ?? '');
  const [pair, setPair] = useState<{ a: AuditReport; b: AuditReport } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyChanges, setOnlyChanges] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!idA || !idB) return;
      try {
        const [a, b] = await Promise.all([history.get(idA), history.get(idB)]);
        if (cancelled) return;
        if (!a || !b) {
          setPair(null);
          setError('One of the selected reports could not be found.');
        } else {
          setPair({ a, b });
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load reports.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idA, idB, history]);

  const diff = useMemo(() => (pair ? diffReports(pair.a, pair.b) : null), [pair]);

  if (entries.length < 2) {
    return (
      <Section title="Compare" subtitle="Compare two saved audits side by side.">
        <Empty>
          Analyze at least two pages (for example your page and a competitor&rsquo;s) to compare
          them. Each page is analyzed separately and the collected data is compared locally.
        </Empty>
      </Section>
    );
  }

  return (
    <Section
      title="Compare"
      subtitle="Two separately analyzed pages, compared from the data NexusRank collected. No competitor data is fetched."
    >
      <div className="row g-3 mb-3">
        {[
          ['Report A', idA, setIdA],
          ['Report B', idB, setIdB],
        ].map(([name, value, set]) => (
          <div key={name as string} className="col-md-6">
            <label className="form-label small" htmlFor={`cmp-${name}`}>
              {name as string}
            </label>
            <select
              id={`cmp-${name}`}
              className="form-select form-select-sm nr-input"
              value={value as string}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
            >
              {entries.map((e) => (
                <option key={e.id} value={e.id}>
                  {label(e)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {error && (
        <div className="nr-card nr-card-error mb-3" role="alert">
          {error}
        </div>
      )}
      {diff && pair && (
        <>
          <Panel title="Scores">
            <table className="nr-table">
              <thead>
                <tr>
                  <th></th>
                  <th>A</th>
                  <th>B</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Overall</strong>
                  </td>
                  <td>{diff.overall.a ?? 'n/a'}</td>
                  <td>{diff.overall.b ?? 'n/a'}</td>
                  <td>
                    <Delta d={diff.overall.delta} />
                  </td>
                </tr>
                {diff.categories.map((c) => (
                  <tr key={c.category}>
                    <td>{CATEGORY_LABELS[c.category]}</td>
                    <td>{c.a ?? 'n/a'}</td>
                    <td>{c.b ?? 'n/a'}</td>
                    <td>
                      <Delta d={c.delta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Key metadata">
            <table className="nr-table nr-table-sm">
              <thead>
                <tr>
                  <th></th>
                  <th>A</th>
                  <th>B</th>
                </tr>
              </thead>
              <tbody>
                {diff.meta.map((m) => (
                  <tr key={m.label} className={m.same ? '' : 'nr-row-diff'}>
                    <td>{m.label}</td>
                    <td className="nr-wrap">{m.a}</td>
                    <td className="nr-wrap">{m.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Checks">
            <label className="d-flex gap-2 align-items-center mb-2">
              <input
                type="checkbox"
                checked={onlyChanges}
                onChange={(e) => setOnlyChanges(e.target.checked)}
              />{' '}
              Show only differences
            </label>
            <table className="nr-table nr-table-sm">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Category</th>
                  <th>A</th>
                  <th>B</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {diff.checks
                  .filter((c) => !onlyChanges || c.changed)
                  .map((c) => (
                    <tr key={c.id} className={c.changed ? 'nr-row-diff' : ''}>
                      <td>{c.title}</td>
                      <td>{CATEGORY_LABELS[c.category]}</td>
                      <td>{c.a ? <StatusBadge status={c.a} /> : '—'}</td>
                      <td>{c.b ? <StatusBadge status={c.b} /> : '—'}</td>
                      <td>
                        {c.direction === 'improved'
                          ? 'B better'
                          : c.direction === 'regressed'
                            ? 'A better'
                            : c.changed
                              ? 'differs'
                              : 'same'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </Section>
  );
}

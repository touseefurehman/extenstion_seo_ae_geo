import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { TrendChart } from '../../components/Charts';
import type { HistoryEntry, HistorySettings } from '../../storage/history';
import { LIMITS } from '../../storage/history';
import { Empty, Panel, Section } from './common';

interface Props {
  entries: HistoryEntry[];
  settings: HistorySettings | null;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onClear: () => Promise<void>;
  onCap: (cap: number) => Promise<void>;
}

export function HistorySection({
  entries,
  settings,
  selectedId,
  onOpen,
  onDelete,
  onClear,
  onCap,
}: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [capInput, setCapInput] = useState<string | null>(null);
  const selected = entries.find((e) => e.id === selectedId);
  const sameUrl = entries.filter((e) => e.url === selected?.url).reverse();
  const bytes = entries.reduce((n, e) => n + e.bytes, 0);

  return (
    <Section
      title="History"
      subtitle="Audits are stored only in this browser (chrome.storage.local)."
    >
      <div className="row g-3 mb-3">
        <div className="col-lg-7">
          <Panel title="Score trend for the selected page">
            {selected ? (
              <TrendChart
                title={`Overall score over time for ${selected.url}`}
                points={sameUrl.map((e) => ({
                  label: new Date(e.createdAt).toLocaleString(),
                  value: e.overall,
                }))}
              />
            ) : (
              <Empty>Select a report to see its trend.</Empty>
            )}
          </Panel>
        </div>
        <div className="col-lg-5">
          <Panel title="Storage">
            <dl className="nr-dl">
              <dt>Saved reports</dt>
              <dd>{entries.length}</dd>
              <dt>Approx. size</dt>
              <dd>{(bytes / 1024).toFixed(0)} KB</dd>
            </dl>
            <label className="form-label small mb-1" htmlFor="nr-cap">
              Keep at most this many reports
            </label>
            <div className="d-flex gap-2">
              <input
                id="nr-cap"
                type="number"
                min={LIMITS.minCap}
                max={LIMITS.maxCap}
                className="form-control form-control-sm nr-input"
                value={capInput ?? settings?.historyCap ?? ''}
                onChange={(e) => setCapInput(e.target.value)}
              />
              <button
                type="button"
                className="nr-btn-secondary btn-sm"
                disabled={capInput === null || capInput === '' || Number.isNaN(Number(capInput))}
                onClick={async () => {
                  await onCap(Number(capInput));
                  setCapInput(null);
                }}
              >
                Save
              </button>
            </div>
            <div className="nr-muted small mt-1">
              Older reports are removed first when the limit or the storage budget is reached.
            </div>
          </Panel>
        </div>
      </div>

      <Panel title={`Saved reports (${entries.length})`}>
        {entries.length === 0 ? (
          <Empty>No reports yet. Open the popup on a page and click Analyze.</Empty>
        ) : (
          <div className="nr-table-wrap">
            <table className="nr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Page</th>
                  <th>Overall</th>
                  <th>Tech</th>
                  <th>On-page</th>
                  <th>AEO</th>
                  <th>GEO</th>
                  <th>
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className={e.id === selectedId ? 'nr-row-active' : ''}>
                    <td>{new Date(e.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="fw-semibold">{e.title ?? '(no title)'}</div>
                      <div className="nr-url nr-muted">{e.url}</div>
                    </td>
                    <td>{e.overall ?? 'n/a'}</td>
                    <td>{e.categories.technical ?? 'n/a'}</td>
                    <td>{e.categories.onpage ?? 'n/a'}</td>
                    <td>{e.categories.aeo ?? 'n/a'}</td>
                    <td>{e.categories.geo ?? 'n/a'}</td>
                    <td className="text-nowrap">
                      <button
                        type="button"
                        className="nr-btn-secondary btn-sm me-1"
                        onClick={() => onOpen(e.id)}
                        disabled={e.id === selectedId}
                      >
                        {e.id === selectedId ? 'Open' : 'View'}
                      </button>
                      <button
                        type="button"
                        className="nr-btn-secondary btn-sm"
                        aria-label={`Delete report for ${e.url}`}
                        onClick={() => onDelete(e.id)}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {entries.length > 0 && (
          <div className="mt-2">
            {confirmClear ? (
              <span className="d-inline-flex gap-2 align-items-center">
                <span>Delete all {entries.length} reports?</span>
                <button
                  type="button"
                  className="nr-btn-danger btn-sm"
                  onClick={async () => {
                    await onClear();
                    setConfirmClear(false);
                  }}
                >
                  Yes, delete all
                </button>
                <button
                  type="button"
                  className="nr-btn-secondary btn-sm"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="nr-btn-secondary btn-sm"
                onClick={() => setConfirmClear(true)}
              >
                Clear all history
              </button>
            )}
          </div>
        )}
      </Panel>
    </Section>
  );
}

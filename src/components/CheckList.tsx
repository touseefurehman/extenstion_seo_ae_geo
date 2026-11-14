import { ChevronDown, ChevronRight, FilterX } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Category, CheckResult, Severity, Status } from '../types/check';
import { titleOf } from '../utils/issues';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  STATUSES,
  STATUS_LABELS,
} from '../utils/labels';
import { EvidenceKindBadge, SeverityBadge, StatusBadge } from './Badges';

interface Props {
  checks: CheckResult[];
  /** Show the category filter (only useful when several categories are listed). */
  showCategoryFilter?: boolean;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function Chips<T extends string>({
  label,
  options,
  labels,
  selected,
  onToggle,
  counts,
}: {
  label: string;
  options: T[];
  labels: Record<T, string>;
  selected: Set<T>;
  onToggle: (v: T) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="nr-filter-group" role="group" aria-label={label}>
      <span className="nr-filter-label">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          className={`nr-chip${selected.has(o) ? ' active' : ''}`}
          aria-pressed={selected.has(o)}
          onClick={() => onToggle(o)}
        >
          {labels[o]} <span className="nr-chip-count">{counts[o] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

/** Check list with status/severity/category filters, text search and expandable evidence. */
export function CheckList({ checks, showCategoryFilter = false }: Props) {
  const [status, setStatus] = useState<Set<Status>>(new Set());
  const [severity, setSeverity] = useState<Set<Severity>>(new Set());
  const [category, setCategory] = useState<Set<Category>>(new Set());
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return checks.filter(
      (c) =>
        (status.size === 0 || status.has(c.status)) &&
        (severity.size === 0 || severity.has(c.severity)) &&
        (category.size === 0 || category.has(c.category)) &&
        (q === '' || `${titleOf(c)} ${c.id} ${c.explanation}`.toLowerCase().includes(q)),
    );
  }, [checks, status, severity, category, query]);

  const count = (key: 'status' | 'severity' | 'category') => {
    const out: Record<string, number> = {};
    for (const c of checks) out[c[key]] = (out[c[key]] ?? 0) + 1;
    return out;
  };
  const filtersActive = status.size + severity.size + category.size > 0 || query !== '';
  const clear = () => {
    setStatus(new Set());
    setSeverity(new Set());
    setCategory(new Set());
    setQuery('');
  };

  return (
    <div className="nr-checklist">
      <div className="nr-filters">
        <Chips
          label="Status"
          options={STATUSES}
          labels={STATUS_LABELS}
          selected={status}
          onToggle={(v) => setStatus(toggle(status, v))}
          counts={count('status')}
        />
        <Chips
          label="Severity"
          options={SEVERITIES}
          labels={SEVERITY_LABELS}
          selected={severity}
          onToggle={(v) => setSeverity(toggle(severity, v))}
          counts={count('severity')}
        />
        {showCategoryFilter && (
          <Chips
            label="Category"
            options={CATEGORIES}
            labels={CATEGORY_LABELS}
            selected={category}
            onToggle={(v) => setCategory(toggle(category, v))}
            counts={count('category')}
          />
        )}
        <div className="nr-filter-row">
          <input
            type="search"
            className="form-control form-control-sm nr-input"
            placeholder="Search checks…"
            aria-label="Search checks"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="nr-btn-secondary btn-sm"
            onClick={() => setOpen(new Set(filtered.map((c) => c.id)))}
          >
            Expand all
          </button>
          <button
            type="button"
            className="nr-btn-secondary btn-sm"
            onClick={() => setOpen(new Set())}
          >
            Collapse all
          </button>
          <button
            type="button"
            className="nr-btn-secondary btn-sm d-flex align-items-center gap-1"
            onClick={clear}
            disabled={!filtersActive}
          >
            <FilterX size={14} aria-hidden /> Clear filters
          </button>
        </div>
      </div>

      <div className="nr-muted small mb-2" aria-live="polite">
        Showing {filtered.length} of {checks.length} checks
      </div>

      {filtered.length === 0 ? (
        <div className="nr-card nr-empty">No checks match the current filters.</div>
      ) : (
        <ul className="nr-check-items">
          {filtered.map((c) => {
            const isOpen = open.has(c.id);
            return (
              <li key={c.id} className={`nr-check nr-check-${c.status}`}>
                <button
                  type="button"
                  className="nr-check-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(toggle(open, c.id))}
                >
                  {isOpen ? (
                    <ChevronDown size={16} aria-hidden />
                  ) : (
                    <ChevronRight size={16} aria-hidden />
                  )}
                  <span className="nr-check-title">{titleOf(c)}</span>
                  <span className="nr-check-badges">
                    <EvidenceKindBadge kind={c.evidenceKind} />
                    <SeverityBadge severity={c.severity} />
                    <StatusBadge status={c.status} />
                  </span>
                </button>
                {isOpen && (
                  <div className="nr-check-body">
                    <p className="mb-2">{c.explanation}</p>
                    {c.notTestedReason && (
                      <p className="mb-2">
                        <strong>Why it could not be tested:</strong> {c.notTestedReason}
                      </p>
                    )}
                    {c.evidence.length > 0 ? (
                      <table className="nr-evidence">
                        <caption className="visually-hidden">Evidence for {titleOf(c)}</caption>
                        <tbody>
                          {c.evidence.map((e, i) => (
                            <tr key={i}>
                              <th scope="row">{e.label}</th>
                              <td>{e.value === null ? '—' : String(e.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="nr-muted small mb-2">No evidence values for this result.</div>
                    )}
                    {c.status !== 'passed' && c.status !== 'not_applicable' && (
                      <p className="mb-1">
                        <strong>Recommendation:</strong> {c.recommendation}
                      </p>
                    )}
                    <div className="nr-muted small">
                      <code>{c.id}</code> · weight {c.weight}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

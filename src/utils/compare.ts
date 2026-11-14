import type { Category, Status } from '../types/check';
import type { AuditReport } from '../types/report';
import { CATEGORIES } from './labels';

export type Direction = 'improved' | 'regressed' | 'same' | 'unscored';

export interface ScoreDiff {
  label: string;
  a: number | null;
  b: number | null;
  /** b - a; null when either side has no score. */
  delta: number | null;
}

export interface CheckDiff {
  id: string;
  title: string;
  category: Category;
  a: Status | null;
  b: Status | null;
  changed: boolean;
  direction: Direction;
}

export interface MetaDiff {
  label: string;
  a: string;
  b: string;
  same: boolean;
}

export interface ReportDiff {
  overall: ScoreDiff;
  categories: (ScoreDiff & { category: Category })[];
  checks: CheckDiff[];
  meta: MetaDiff[];
}

const RANK: Record<Status, number | null> = {
  passed: 3,
  warning: 2,
  failed: 1,
  not_applicable: null,
  not_tested: null,
};

const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);

function direction(a: Status | null, b: Status | null): Direction {
  const ra = a === null ? null : RANK[a];
  const rb = b === null ? null : RANK[b];
  if (ra === null || rb === null) return a === b ? 'same' : 'unscored';
  if (ra === rb) return 'same';
  return rb > ra ? 'improved' : 'regressed';
}

const text = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === '' ? '(none)' : String(v);

function firstMeta(r: AuditReport, name: string): string | null {
  return r.page.head.metas.find((m) => m.name === name)?.content ?? null;
}

/** Side-by-side comparison of two saved reports. Pure: uses only data already in the reports. */
export function diffReports(a: AuditReport, b: AuditReport): ReportDiff {
  const ids = new Map<string, { title: string; category: Category }>();
  for (const c of [...a.checks, ...b.checks])
    ids.set(c.id, { title: c.title, category: c.category });
  const statusIn = (r: AuditReport, id: string): Status | null =>
    r.checks.find((c) => c.id === id)?.status ?? null;

  const checks: CheckDiff[] = [...ids.entries()].map(([id, info]) => {
    const sa = statusIn(a, id);
    const sb = statusIn(b, id);
    return { id, ...info, a: sa, b: sb, changed: sa !== sb, direction: direction(sa, sb) };
  });

  const h1 = (r: AuditReport) => r.page.headings.find((h) => h.level === 1)?.text ?? null;
  const canonical = (r: AuditReport) => r.page.head.canonicals[0]?.resolved ?? null;
  const rows: [string, string, string][] = [
    ['URL', a.url, b.url],
    ['Title', text(a.page.head.title), text(b.page.head.title)],
    ['Title length', text(a.page.head.title?.length ?? 0), text(b.page.head.title?.length ?? 0)],
    ['Meta description', text(firstMeta(a, 'description')), text(firstMeta(b, 'description'))],
    ['Canonical', text(canonical(a)), text(canonical(b))],
    ['Language', text(a.page.head.lang), text(b.page.head.lang)],
    ['H1', text(h1(a)), text(h1(b))],
    ['Headings', text(a.page.totals.headings), text(b.page.totals.headings)],
    ['Words in body', text(a.page.bodyWordCount), text(b.page.bodyWordCount)],
    ['Images', text(a.page.totals.images), text(b.page.totals.images)],
    ['Links', text(a.page.totals.links), text(b.page.totals.links)],
    ['Schema entities', text(a.schema.counts.entities), text(b.schema.counts.entities)],
    ['Scripts', text(a.page.totals.scripts), text(b.page.totals.scripts)],
    ['DOM elements', text(a.page.domNodeCount), text(b.page.domNodeCount)],
  ];

  return {
    overall: { label: 'Overall', a: a.overall, b: b.overall, delta: delta(a.overall, b.overall) },
    categories: CATEGORIES.map((category) => ({
      category,
      label: category,
      a: a.categories[category].score,
      b: b.categories[category].score,
      delta: delta(a.categories[category].score, b.categories[category].score),
    })),
    checks,
    meta: rows.map(([label, x, y]) => ({ label, a: x, b: y, same: x === y })),
  };
}

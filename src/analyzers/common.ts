import { CHECKS } from '../scoring/config';
import type { CheckResult, Evidence, Status } from '../types/check';

export interface CheckDetails {
  evidence?: Evidence[];
  explanation: string;
  recommendation: string;
  /** Required for `not_tested`. */
  notTestedReason?: string;
  evidenceKind?: 'detected' | 'inferred';
}

/** Builds a CheckResult; category, severity and weight come from scoring/config.ts. */
export function check(id: string, status: Status, d: CheckDetails): CheckResult {
  const meta = CHECKS[id];
  if (!meta) throw new Error(`Unknown check id: ${id}`);
  if (status === 'not_tested' && !d.notTestedReason) {
    throw new Error(`${id}: not_tested requires a reason`);
  }
  const result: CheckResult = {
    id,
    category: meta.category,
    severity: meta.severity,
    status,
    weight: meta.weight,
    evidence: d.evidence ?? [],
    explanation: d.explanation,
    recommendation: d.recommendation,
  };
  if (d.notTestedReason) result.notTestedReason = d.notTestedReason;
  if (d.evidenceKind) result.evidenceKind = d.evidenceKind;
  return result;
}

export const ev = (label: string, value: Evidence['value']): Evidence => ({ label, value });

export const OK = 'No action needed.';

export function notApplicable(id: string, why: string): CheckResult {
  return check(id, 'not_applicable', {
    explanation: `Not applicable: ${why}`,
    recommendation: OK,
  });
}

export function notTested(id: string, reason: string): CheckResult {
  return check(id, 'not_tested', {
    explanation: `Could not be tested: ${reason}`,
    recommendation: 'Re-analyze the page, or check this item manually.',
    notTestedReason: reason,
  });
}

/** passed up to `warn`, warning up to `fail`, failed above. */
export function band(value: number, limits: { warn: number; fail: number }): Status {
  if (value <= limits.warn) return 'passed';
  return value <= limits.fail ? 'warning' : 'failed';
}

/** Evidence note when a snapshot list was capped, so partial analysis is visible. */
export function partialNote(total: number, analyzed: number): Evidence[] {
  return total > analyzed
    ? [ev('Note', `Only the first ${analyzed} of ${total} items were analyzed (snapshot cap).`)]
    : [];
}

export function samePageUrl(a: string, b: string): boolean {
  const norm = (u: string): string | null => {
    try {
      const x = new URL(u);
      x.hash = '';
      const path = x.pathname.length > 1 ? x.pathname.replace(/\/+$/, '') : x.pathname;
      return `${x.protocol}//${x.host.toLowerCase()}${path}${x.search}`;
    } catch {
      return null;
    }
  };
  const na = norm(a);
  return na !== null && na === norm(b);
}

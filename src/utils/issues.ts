import { CHECKS } from '../scoring/config';
import type { CheckResult, Severity } from '../types/check';

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

/** Failed checks first, then warnings; within a status, by severity then weight. */
export function topIssues(checks: CheckResult[], n: number): CheckResult[] {
  const rank = (c: CheckResult) => (c.status === 'failed' ? 2 : c.status === 'warning' ? 1 : 0);
  return checks
    .filter((c) => c.status === 'failed' || c.status === 'warning')
    .sort(
      (a, b) =>
        rank(b) - rank(a) ||
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        b.weight - a.weight ||
        a.id.localeCompare(b.id),
    )
    .slice(0, n);
}

export const titleOf = (c: CheckResult): string => c.title || CHECKS[c.id]?.title || c.id;

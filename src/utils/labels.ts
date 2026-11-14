import type { Category, Severity, Status } from '../types/check';

export const CATEGORY_LABELS: Record<Category, string> = {
  technical: 'Technical SEO',
  onpage: 'On-page SEO',
  aeo: 'AEO',
  geo: 'GEO',
};
export const CATEGORIES: Category[] = ['technical', 'onpage', 'aeo', 'geo'];

export const STATUS_LABELS: Record<Status, string> = {
  passed: 'Passed',
  warning: 'Warning',
  failed: 'Failed',
  not_applicable: 'Not applicable',
  not_tested: 'Not tested',
};
export const STATUSES: Status[] = ['passed', 'warning', 'failed', 'not_applicable', 'not_tested'];

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};
export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export type ScoreTone = 'good' | 'ok' | 'bad' | 'none';
export function scoreTone(score: number | null): ScoreTone {
  if (score === null) return 'none';
  if (score >= 80) return 'good';
  if (score >= 50) return 'ok';
  return 'bad';
}

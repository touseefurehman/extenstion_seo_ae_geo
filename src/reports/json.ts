import type { AuditReport } from '../types/report';

/** The full AuditReport, pretty-printed. */
export function toJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

/** nexusrank-example-com-20260102-1530.ext */
export function reportFileName(report: AuditReport, ext: 'json' | 'csv' | 'pdf'): string {
  let host = 'page';
  try {
    host =
      new URL(report.url).hostname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'page';
  } catch {
    /* keep default */
  }
  const d = new Date(report.createdAt);
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = Number.isNaN(d.getTime())
    ? 'report'
    : `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  return `nexusrank-${host}-${stamp}.${ext}`;
}

import type { AuditReport } from '../types/report';

export const CSV_COLUMNS = [
  'URL',
  'Analyzed at',
  'Check ID',
  'Check',
  'Category',
  'Severity',
  'Status',
  'Weight',
  'Evidence kind',
  'Explanation',
  'Recommendation',
  'Evidence',
  'Not tested reason',
] as const;

/**
 * RFC 4180 escaping, plus neutralisation of spreadsheet formula injection: a field that begins
 * with = + - @ tab or CR is prefixed with an apostrophe so Excel/Sheets treat it as text.
 */
export function csvField(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per check, CRLF line endings. */
export function toCsv(report: AuditReport): string {
  const rows: (string | number | null)[][] = [[...CSV_COLUMNS]];
  for (const c of report.checks) {
    rows.push([
      report.url,
      report.createdAt,
      c.id,
      c.title,
      c.category,
      c.severity,
      c.status,
      c.weight,
      c.evidenceKind ?? '',
      c.explanation,
      c.recommendation,
      c.evidence.map((e) => `${e.label}: ${e.value === null ? '' : String(e.value)}`).join(' | '),
      c.notTestedReason ?? '',
    ]);
  }
  return rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

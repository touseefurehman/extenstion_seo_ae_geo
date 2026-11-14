import { CATEGORIES, CATEGORY_LABELS, STATUS_LABELS } from '../utils/labels';
import { topIssues } from '../utils/issues';
import type { AuditReport } from '../types/report';

export const PDF_DISCLAIMER =
  'About this report: NexusRank analyzes the rendered page locally in your browser and reports measurable on-page signals. These are indicators, not search rankings. NexusRank does not measure Google rankings, AI-engine citations or visibility, backlinks, keyword search volume or Core Web Vitals, and its performance figures are not Lighthouse results. It cannot read HTTP headers or status codes, and iframes, shadow DOM and content that appears after analysis are not covered. Scores depend on configurable guideline thresholds.';

const REPLACEMENTS: [RegExp, string][] = [
  [/[→⇒]/g, '->'],
  [/…/g, '...'],
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
  [/[–—]/g, '-'],
  [/×/g, 'x'],
  [/≤/g, '<='],
  [/≥/g, '>='],
  [/[·•]/g, '-'],
  [/›/g, '>'],
  [/\u00a0/g, ' '],
  [/÷/g, '/'],
];

/** The built-in PDF fonts only cover Latin-1, so other characters are replaced. */
export function pdfSafe(s: string): string {
  let out = s;
  for (const [re, to] of REPLACEMENTS) out = out.replace(re, to);
  // eslint-disable-next-line no-control-regex -- intentionally strips characters outside Latin-1
  return out.replace(/[^\u0009\u000a -~¡-ÿ]/g, '?');
}

const MARGIN = 40;

/** Builds a multi-page PDF. jsPDF is loaded on demand so it stays out of the main bundle. */
export async function buildPdf(report: AuditReport): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const textW = W - MARGIN * 2;
  let y = MARGIN;

  const ensure = (needed: number) => {
    if (y + needed > H - MARGIN - 16) {
      doc.addPage();
      y = MARGIN;
    }
  };
  const write = (
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: [number, number, number];
      indent?: number;
      gap?: number;
    } = {},
  ) => {
    const size = opts.size ?? 10;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? [30, 41, 59]));
    const indent = opts.indent ?? 0;
    const lines = doc.splitTextToSize(pdfSafe(text), textW - indent) as string[];
    const lh = size * 1.3;
    for (const line of lines) {
      ensure(lh);
      doc.text(line, MARGIN + indent, y + size);
      y += lh;
    }
    y += opts.gap ?? 2;
  };

  write('NexusRank Audit Report', { size: 20, bold: true, gap: 6 });
  write(report.title ?? '(no page title)', { size: 12, bold: true });
  write(report.url, { size: 9, color: [71, 85, 105] });
  write(`Analyzed ${new Date(report.createdAt).toLocaleString()} | by WebsNexus`, {
    size: 9,
    color: [71, 85, 105],
    gap: 10,
  });

  write(`Overall score: ${report.overall ?? 'n/a'} / 100`, { size: 14, bold: true, gap: 4 });
  for (const c of CATEGORIES) {
    const cs = report.categories[c];
    write(
      `${CATEGORY_LABELS[c]}: ${cs.score ?? 'n/a'}${cs.score === null ? ' (no applicable checks)' : ' / 100'}  -  ${cs.applicableChecks} scored checks`,
      { indent: 10 },
    );
  }
  const s = report.summary;
  write(
    `Critical issues: ${s.criticalIssues} | Warnings: ${s.warnings} | Passed: ${s.passed} | Not applicable: ${s.byStatus.not_applicable} | Not tested: ${s.byStatus.not_tested}`,
    { gap: 8 },
  );

  write(PDF_DISCLAIMER, { size: 8.5, color: [71, 85, 105], gap: 10 });

  write('Top recommendations', { size: 13, bold: true, gap: 4 });
  const top = topIssues(report.checks, 8);
  if (top.length === 0) write('No warnings or failed checks.', { indent: 10 });
  top.forEach((c, i) => {
    write(`${i + 1}. ${c.title} [${STATUS_LABELS[c.status]}, ${c.severity}]`, {
      bold: true,
      indent: 10,
      gap: 0,
    });
    write(c.recommendation, { indent: 22, gap: 4 });
  });

  for (const cat of CATEGORIES) {
    const list = report.checks.filter((c) => c.category === cat);
    if (list.length === 0) continue;
    ensure(60);
    y += 8;
    write(`${CATEGORY_LABELS[cat]} (${list.length} checks)`, { size: 13, bold: true, gap: 4 });
    for (const c of list) {
      ensure(40);
      write(`${c.title} - ${STATUS_LABELS[c.status]} (${c.severity}, weight ${c.weight})`, {
        bold: true,
        gap: 0,
      });
      write(c.explanation, { indent: 10, gap: 0 });
      if (c.notTestedReason)
        write(`Not tested: ${c.notTestedReason}`, { indent: 10, gap: 0, color: [100, 60, 160] });
      for (const e of c.evidence.slice(0, 6)) {
        write(`${e.label}: ${e.value === null ? '' : String(e.value).slice(0, 200)}`, {
          size: 8.5,
          indent: 10,
          gap: 0,
          color: [71, 85, 105],
        });
      }
      if (c.status === 'warning' || c.status === 'failed')
        write(`Recommendation: ${c.recommendation}`, { indent: 10, gap: 0 });
      y += 6;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      pdfSafe('NexusRank by WebsNexus | local analysis, not search rankings'),
      MARGIN,
      H - 22,
    );
    doc.text(`Page ${p} of ${pages}`, W - MARGIN, H - 22, { align: 'right' });
  }
  return doc.output('blob');
}

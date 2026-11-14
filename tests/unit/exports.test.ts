import { describe, expect, it } from 'vitest';
import { csvField, CSV_COLUMNS, toCsv } from '../../src/reports/csv';
import { reportFileName, toJson } from '../../src/reports/json';
import { buildPdf, pdfSafe, PDF_DISCLAIMER } from '../../src/reports/pdf';
import { fixtureReport } from './helpers';

/** Minimal RFC 4180 parser used to verify the CSV round-trips. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else field += ch;
  }
  return rows;
}

describe('csvField', () => {
  it.each([
    ['plain', 'plain'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['line1\nline2', '"line1\nline2"'],
    ['cr\r\nlf', '"cr\r\nlf"'],
    ['=SUM(A1)', "'=SUM(A1)"],
    ['+1', "'+1"],
    ['-2', "'-2"],
    ['@cmd', "'@cmd"],
    ['\tTAB', "'\tTAB"],
    ['="x,y"', `"'=""x,y"""`],
  ])('%j -> %j', (input, expected) => expect(csvField(input)).toBe(expected));
  it('handles null, undefined and numbers', () => {
    expect([csvField(null), csvField(undefined), csvField(0), csvField(7.5)]).toEqual([
      '',
      '',
      '0',
      '7.5',
    ]);
  });
});

describe('toCsv', () => {
  it('has a header and exactly one correctly shaped row per check', async () => {
    const report = await fixtureReport('well-optimized');
    const rows = parseCsv(toCsv(report));
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows).toHaveLength(report.checks.length + 1);
    for (const r of rows) expect(r).toHaveLength(CSV_COLUMNS.length);
    const byId = new Map(rows.slice(1).map((r) => [r[2]!, r]));
    const title = report.checks.find((c) => c.id === 'seo.title.length')!;
    const row = byId.get('seo.title.length')!;
    expect(row[3]).toBe(title.title);
    expect(row[6]).toBe(title.status);
    expect(row[7]).toBe(String(title.weight));
    expect(row[11]).toContain('Length (characters): 47');
  });

  it('survives awkward content (commas, quotes, newlines, formulas) in evidence', async () => {
    const report = await fixtureReport('empty');
    report.checks[0]!.explanation = 'He said "stop", then\nleft';
    report.checks[0]!.recommendation = '=HYPERLINK("http://e.test")';
    const rows = parseCsv(toCsv(report));
    expect(rows[1]![9]).toBe('He said "stop", then\nleft');
    expect(rows[1]![10]).toBe('\'=HYPERLINK("http://e.test")');
    expect(rows).toHaveLength(report.checks.length + 1);
  });

  it('includes the reason for not_tested checks', async () => {
    const report = await fixtureReport('empty');
    const hidden = {
      ...report,
      checks: report.checks.map((c) =>
        c.id === 'tech.robotstxt'
          ? { ...c, status: 'not_tested' as const, notTestedReason: 'HTTP 403' }
          : c,
      ),
    };
    const row = parseCsv(toCsv(hidden)).find((r) => r[2] === 'tech.robotstxt')!;
    expect(row[12]).toBe('HTTP 403');
  });
});

describe('toJson / file names', () => {
  it('exports the complete AuditReport and round-trips', async () => {
    const report = await fixtureReport('article');
    expect(JSON.parse(toJson(report))).toEqual(report);
  });
  it('builds readable file names', async () => {
    const report = await fixtureReport('article', { createdAt: new Date(2026, 2, 5, 9, 7) });
    expect(reportFileName(report, 'pdf')).toBe('nexusrank-example-com-20260305-0907.pdf');
    expect(reportFileName({ ...report, url: 'not a url', createdAt: 'bad' }, 'csv')).toBe(
      'nexusrank-page-report.csv',
    );
  });
});

describe('PDF', () => {
  it('pdfSafe maps typographic characters and strips what Latin-1 cannot show', () => {
    expect(pdfSafe('A → B … “q” – 3×2 ≤ 5 · ok')).toBe('A -> B ... "q" - 3x2 <= 5 - ok');
    expect(pdfSafe('日本語 café')).toBe('??? café');
  });

  it('builds a valid multi-page PDF containing scores, checks and the limitations disclaimer', async () => {
    const report = await fixtureReport('well-optimized');
    const blob = await buildPdf(report);
    expect(blob.type).toBe('application/pdf');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const raw = new TextDecoder('latin1').decode(bytes);
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(raw.trimEnd().endsWith('%%EOF')).toBe(true);
    const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
    expect(raw).toContain('NexusRank Audit Report');
    expect(raw).toContain('Overall score');
    expect(raw).toContain('Core Web Vitals'); // disclaimer text
    expect(raw).toMatch(/Page 1 of \d+/);
    expect(PDF_DISCLAIMER).toMatch(/not search rankings|indicators, not search rankings/);
  });
});

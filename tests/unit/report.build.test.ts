import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/reports/build';
import { slimSnapshot } from '../../src/reports/slim';
import { extractSnapshot } from '../../src/content/extractor';
import { loadExpected, loadFixtureDocument, mockFetch } from './helpers';

async function report(name: string) {
  const exp = loadExpected(name);
  const snap = await extractSnapshot(loadFixtureDocument(name, exp.url), {
    fetch: mockFetch(exp.network),
  });
  return {
    snap,
    report: buildReport(snap, { id: 'r1', now: () => new Date('2026-01-01T00:00:00Z') }),
  };
}

describe('buildReport', () => {
  it('assembles scores, summary, schema and metadata from real fixtures', async () => {
    const { report: r } = await report('well-optimized');
    expect(r).toMatchObject({
      id: 'r1',
      version: 1,
      url: 'https://example.com/guides/home-coffee-brewing',
      createdAt: '2026-01-01T00:00:00.000Z',
      configVersion: '1',
    });
    expect(r.overall).toBeGreaterThan(70);
    expect(r.summary.total).toBe(r.checks.length);
    expect(r.categories.technical.score).toBe(r.breakdown.categories.technical.score);
    expect(r.schema.counts.jsonld).toBe(1);
  });

  it('ranks fixtures sensibly: optimized > bare > empty', async () => {
    const good = (await report('well-optimized')).report;
    const bare = (await report('missing-metadata')).report;
    const empty = (await report('empty')).report;
    expect(good.overall!).toBeGreaterThan(bare.overall!);
    expect(bare.overall!).toBeGreaterThanOrEqual(empty.overall!);
    expect(empty.summary.criticalIssues).toBeGreaterThan(0);
  });

  it('every scored category uses only real checks (no placeholder scores)', async () => {
    const { report: r } = await report('article');
    for (const cat of Object.values(r.breakdown.categories)) {
      expect(cat.contributions.every((x) => r.checks.some((ck) => ck.id === x.id))).toBe(true);
    }
  });

  it('is JSON-serializable and stays small for the very large fixture', async () => {
    const { report: r } = await report('very-large');
    const json = JSON.stringify(r);
    expect(JSON.parse(json)).toEqual(r);
    expect(json.length).toBeLessThan(1_500_000);
    expect(r.page.truncated).toContain('report.links');
    expect(r.page.totals.links).toBe(3200);
  });
});

describe('slimSnapshot', () => {
  it('clips texts and lists, never stores raw JSON-LD twice, and records what it cut', async () => {
    const { snap } = await report('very-large');
    const slim = slimSnapshot(snap);
    expect(slim.paragraphs.length).toBe(200);
    expect(slim.links.length).toBe(500);
    expect(slim.paragraphs.every((p) => p.text.length <= 300)).toBe(true);
    expect(slim.structuredData.jsonld.every((b) => b.raw === '')).toBe(true);
    expect(slim.truncated).toEqual(expect.arrayContaining(['report.paragraphs', 'report.links']));
    expect(snap.paragraphs.length).toBe(500); // input untouched
  });
});

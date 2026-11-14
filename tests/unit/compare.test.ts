import { describe, expect, it } from 'vitest';
import { diffReports } from '../../src/utils/compare';
import { breadcrumbUrl, truncate } from '../../src/utils/serp';
import { topIssues } from '../../src/utils/issues';
import { fixtureReport } from './helpers';

describe('diffReports', () => {
  it('compares scores, key metadata and per-check results of two real reports', async () => {
    const good = await fixtureReport('well-optimized');
    const bare = await fixtureReport('missing-metadata');
    const d = diffReports(bare, good);
    expect(d.overall).toMatchObject({
      a: bare.overall,
      b: good.overall,
      delta: good.overall! - bare.overall!,
    });
    expect(d.overall.delta!).toBeGreaterThan(0);
    expect(d.categories.map((c) => c.category)).toEqual(['technical', 'onpage', 'aeo', 'geo']);
    const title = d.checks.find((c) => c.id === 'seo.title.present')!;
    expect(title).toMatchObject({ a: 'failed', b: 'passed', changed: true, direction: 'improved' });
    expect(d.checks.find((c) => c.id === 'seo.h1.single')).toMatchObject({
      changed: false,
      direction: 'same',
    });
    const meta = Object.fromEntries(d.meta.map((m) => [m.label, m]));
    expect(meta['Title']).toMatchObject({
      a: '(none)',
      b: 'Complete Guide to Home Coffee Brewing | BrewLab',
      same: false,
    });
    expect(meta['Language']).toMatchObject({ a: '(none)', b: 'en' });
  });

  it('reversing the comparison reverses direction and deltas', async () => {
    const a = await fixtureReport('well-optimized');
    const b = await fixtureReport('empty');
    const ab = diffReports(a, b);
    const ba = diffReports(b, a);
    expect(ab.overall.delta).toBe(-ba.overall.delta!);
    expect(ab.checks.find((c) => c.id === 'seo.title.present')!.direction).toBe('regressed');
    expect(ba.checks.find((c) => c.id === 'seo.title.present')!.direction).toBe('improved');
  });

  it('identical reports have no changes; null scores give null deltas', async () => {
    const a = await fixtureReport('article');
    const d = diffReports(a, a);
    expect(d.checks.every((c) => !c.changed)).toBe(true);
    expect(d.overall.delta).toBe(0);
    const nullScore = { ...a, overall: null };
    expect(diffReports(nullScore, a).overall.delta).toBeNull();
  });

  it('treats not_applicable/not_tested changes as unscored, not as improvements', async () => {
    const a = await fixtureReport('empty');
    const b = structuredClone(a);
    b.checks.find((c) => c.id === 'seo.title.length')!.status = 'warning';
    expect(diffReports(a, b).checks.find((c) => c.id === 'seo.title.length')).toMatchObject({
      changed: true,
      direction: 'unscored',
    });
  });
});

describe('SERP helpers and issue ranking', () => {
  it('truncates with an ellipsis only when needed', () => {
    expect(truncate('short', 10)).toEqual({ text: 'short', truncated: false });
    expect(truncate('x'.repeat(70), 60)).toEqual({ text: `${'x'.repeat(59)}…`, truncated: true });
  });
  it('formats a breadcrumb URL', () => {
    expect(breadcrumbUrl('https://example.com/guides/home-coffee')).toBe(
      'example.com › guides › home-coffee',
    );
    expect(breadcrumbUrl('nonsense')).toBe('nonsense');
  });
  it('ranks failed before warning and critical before low', async () => {
    const r = await fixtureReport('empty');
    const top = topIssues(r.checks, 5);
    expect(top[0]!.status).toBe('failed');
    const statuses = top.map((c) => c.status);
    expect(statuses).toEqual(
      [...statuses].sort((a, b) => (a === 'failed' ? -1 : 1) - (b === 'failed' ? -1 : 1)),
    );
    expect(topIssues(r.checks, 3)).toHaveLength(3);
  });
});

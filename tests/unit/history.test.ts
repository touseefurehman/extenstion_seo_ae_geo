import { describe, expect, it } from 'vitest';
import { buildReport } from '../../src/reports/build';
import {
  createHistory,
  DEFAULTS,
  INDEX_KEY,
  migrateIndex,
  REPORT_PREFIX,
} from '../../src/storage/history';
import { blank } from './snapshotFactory';
import { fakeArea } from './helpers';

let n = 0;
const report = (url = 'https://example.com/', over: { title?: string } = {}) => {
  const snap = blank({
    url,
    title: over.title ?? 'T',
    head: { ...blank().head, title: over.title ?? 'T', titleCount: 1 },
  });
  return buildReport(snap, { id: `r${++n}`, now: () => new Date(2026, 0, 1, 0, 0, n) });
};

describe('history', () => {
  it('saves, lists newest first, and loads full reports by id', async () => {
    const { area } = fakeArea();
    const h = createHistory(area);
    const a = report('https://a.test/');
    const b = report('https://b.test/');
    await h.save(a);
    await h.save(b);
    const list = await h.list();
    expect(list.map((e) => e.id)).toEqual([b.id, a.id]);
    expect(list[0]).toMatchObject({ url: 'https://b.test/', overall: b.overall });
    expect(list[0]!.categories).toEqual({
      technical: b.categories.technical.score,
      onpage: b.categories.onpage.score,
      aeo: b.categories.aeo.score,
      geo: b.categories.geo.score,
    });
    expect((await h.get(a.id))?.checks.length).toBe(a.checks.length);
    expect(await h.get('missing')).toBeNull();
  });

  it('saving the same id replaces it instead of duplicating', async () => {
    const h = createHistory(fakeArea().area);
    const a = report();
    await h.save(a);
    await h.save(a);
    expect(await h.list()).toHaveLength(1);
  });

  it('enforces the configurable history cap (default 50) and removes evicted reports', async () => {
    expect(DEFAULTS.historyCap).toBe(50);
    const { area, data } = fakeArea();
    const h = createHistory(area);
    await h.setHistoryCap(3);
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = report(`https://x.test/${i}`);
      ids.push(r.id);
      await h.save(r);
    }
    const list = await h.list();
    expect(list.map((e) => e.id)).toEqual([ids[4], ids[3], ids[2]]);
    expect(data.has(REPORT_PREFIX + ids[0])).toBe(false);
    expect(data.has(REPORT_PREFIX + ids[4])).toBe(true);
  });

  it('lowering the cap trims immediately; the cap is clamped to a sane range', async () => {
    const h = createHistory(fakeArea().area);
    for (let i = 0; i < 4; i++) await h.save(report());
    expect(await h.setHistoryCap(2)).toBe(2);
    expect(await h.list()).toHaveLength(2);
    expect(await h.setHistoryCap(0)).toBe(1);
    expect(await h.setHistoryCap(100000)).toBe(500);
    expect((await h.getSettings()).historyCap).toBe(500);
  });

  it('deletes one report and clears everything', async () => {
    const { area, data } = fakeArea();
    const h = createHistory(area);
    const a = report();
    const b = report();
    await h.save(a);
    await h.save(b);
    await h.remove(a.id);
    expect((await h.list()).map((e) => e.id)).toEqual([b.id]);
    expect(data.has(REPORT_PREFIX + a.id)).toBe(false);
    await h.clear();
    expect(await h.list()).toEqual([]);
    expect([...data.keys()].filter((k) => k.startsWith(REPORT_PREFIX))).toEqual([]);
    expect((await h.getSettings()).historyCap).toBe(50); // settings survive clear
  });

  it('recovers from browser quota errors by evicting the oldest reports', async () => {
    const one = JSON.stringify(report()).length;
    const { area } = fakeArea({ quotaBytes: Math.round(one * 2.5) });
    const h = createHistory(area);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const r = report();
      ids.push(r.id);
      const res = await h.save(r);
      expect(res.saved).toBe(r.id);
    }
    const list = await h.list();
    expect(list[0]!.id).toBe(ids[3]);
    expect(list.length).toBeLessThanOrEqual(2);
  });

  it('respects the byte budget but always keeps the newest report', async () => {
    const a = report();
    // tiny budget through direct index edit
    const { area } = fakeArea();
    await area.set({
      [INDEX_KEY]: { version: 1, settings: { historyCap: 50, maxBytes: 100_000 }, entries: [] },
    });
    const h2 = createHistory(area);
    await h2.save(a);
    await h2.save(report());
    const list = await h2.list();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.reduce((n, e) => n + e.bytes, 0) <= 100_000 || list.length === 1).toBe(true);
  });

  it('never stores page HTML or raw network bodies beyond the slim snapshot', async () => {
    const { area, data } = fakeArea();
    await createHistory(area).save(report());
    const stored = JSON.stringify([...data.values()]);
    expect(stored).not.toMatch(/outerHTML|<!doctype|<body/i);
  });

  it('serializes concurrent saves without losing entries', async () => {
    const h = createHistory(fakeArea().area);
    await Promise.all(Array.from({ length: 8 }, () => h.save(report())));
    expect(await h.list()).toHaveLength(8);
  });
});

describe('migrateIndex (versioned schema)', () => {
  it.each([
    [undefined],
    [null],
    ['x'],
    [{}],
    [{ version: 99, entries: [] }],
    [{ version: 1, entries: 'nope' }],
  ])('treats %j as empty', (raw) => {
    expect(migrateIndex(raw)).toMatchObject({
      version: 1,
      entries: [],
      settings: { historyCap: 50 },
    });
  });
  it('keeps valid v1 data and repairs bad settings', () => {
    const i = migrateIndex({
      version: 1,
      settings: { historyCap: -5, maxBytes: 1 },
      entries: [{ id: 'a' }, { nope: 1 }],
    });
    expect(i.entries).toEqual([{ id: 'a' }]);
    expect(i.settings.historyCap).toBe(1);
    expect(i.settings.maxBytes).toBe(100_000);
  });
});

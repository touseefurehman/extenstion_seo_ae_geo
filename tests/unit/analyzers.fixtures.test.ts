import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runAnalyzers } from '../../src/analyzers';
import { CHECKS } from '../../src/scoring/config';
import { extractSnapshot } from '../../src/content/extractor';
import { FIXTURE_DIR, loadExpected, loadFixtureDocument, mockFetch } from './helpers';

const names = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.expected.json'))
  .map((f) => f.replace('.expected.json', ''))
  .sort();

describe.each(names)('Analyzers on fixture %s', (name) => {
  it('produce the statuses listed in expected.json', async () => {
    const expected = loadExpected(name);
    const snap = await extractSnapshot(loadFixtureDocument(name, expected.url), {
      fetch: mockFetch(expected.network),
    });
    const results = runAnalyzers(snap);
    const byId = new Map(results.map((r) => [r.id, r.status]));
    for (const [id, status] of Object.entries(expected.checks)) {
      expect(byId.get(id), `${name}: ${id}`).toBe(status);
    }
  });
});

describe('analyzer registry', () => {
  it('every check has a unique ID, a known config entry and complete fields', async () => {
    const snap = await extractSnapshot(
      loadFixtureDocument('well-optimized', 'https://example.com/x'),
      { fetch: mockFetch() },
    );
    const results = runAnalyzers(snap);
    const ids = results.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of results) {
      expect(CHECKS[r.id], r.id).toBeDefined();
      expect(r.category).toBe(CHECKS[r.id]!.category);
      expect(r.weight).toBe(CHECKS[r.id]!.weight);
      expect(r.explanation.length).toBeGreaterThan(10);
      expect(r.recommendation.length).toBeGreaterThan(2);
      if (r.status === 'not_tested') expect(r.notTestedReason).toBeTruthy();
    }
  });

  it('every configured check is produced for a rich page', async () => {
    const snap = await extractSnapshot(
      loadFixtureDocument('well-optimized', 'https://example.com/x'),
      { fetch: mockFetch() },
    );
    const produced = new Set(runAnalyzers(snap).map((r) => r.id));
    const missing = Object.keys(CHECKS).filter((id) => !produced.has(id));
    expect(missing).toEqual([]);
  });

  it('is deterministic and does not mutate the snapshot', async () => {
    const snap = await extractSnapshot(loadFixtureDocument('article', 'https://example.com/a'), {
      fetch: mockFetch(),
    });
    const before = JSON.stringify(snap);
    expect(runAnalyzers(snap)).toEqual(runAnalyzers(snap));
    expect(JSON.stringify(snap)).toBe(before);
  });
});

import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIXTURE_DIR, loadExpected } from './helpers';

const STATUSES = ['passed', 'warning', 'failed', 'not_applicable', 'not_tested'];
const ID_RE = /^(seo|tech|perf|links|aeo|geo)(\.[a-z0-9_]+)+$/;
const names = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.expected.json'))
  .map((f) => f.replace('.expected.json', ''));

describe.each(names)('expected.json for %s', (name) => {
  const expected = loadExpected(name);

  it('has an HTML fixture', () => {
    expect(existsSync(resolve(FIXTURE_DIR, `${name}.html`))).toBe(true);
  });

  it('lists well-formed check IDs with valid statuses', () => {
    const entries = Object.entries(expected.checks);
    expect(entries.length).toBeGreaterThan(0);
    for (const [id, status] of entries) {
      expect(id, id).toMatch(ID_RE);
      expect(STATUSES, `${id} -> ${status}`).toContain(status);
    }
  });
});

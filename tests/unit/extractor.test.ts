import { describe, expect, it } from 'vitest';
import { extractSnapshot } from '../../src/content/extractor';

describe('extractSnapshot (phase 1)', () => {
  it('captures url, title and timestamp as plain JSON', () => {
    document.title = '  Hello  ';
    const snap = extractSnapshot(document);
    expect(snap.schemaVersion).toBe(1);
    expect(snap.title).toBe('Hello');
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });

  it('uses null for an empty title', () => {
    document.title = '';
    expect(extractSnapshot(document).title).toBeNull();
  });
});

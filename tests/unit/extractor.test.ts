import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractDom, extractSnapshot } from '../../src/content/extractor';
import {
  FIXTURE_DIR,
  getPath,
  loadExpected,
  loadFixtureDocument,
  makeDocument,
  mockFetch,
} from './helpers';

const names = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith('.expected.json'))
  .map((f) => f.replace('.expected.json', ''))
  .sort();

describe('fixture inventory', () => {
  it('has all ten required fixtures', () => {
    expect(names).toEqual(
      [
        'article',
        'bad-jsonld',
        'empty',
        'faq',
        'missing-alt',
        'missing-metadata',
        'multiple-h1',
        'organization',
        'very-large',
        'well-optimized',
      ].sort(),
    );
  });
});

describe.each(names)('extractor on fixture %s', (name) => {
  const expected = loadExpected(name);

  it('produces the expected snapshot fields', async () => {
    const doc = loadFixtureDocument(name, expected.url);
    const snap = await extractSnapshot(doc, { fetch: mockFetch(expected.network) });

    for (const [path, value] of Object.entries(expected.snapshot ?? {})) {
      expect(getPath(snap, path), `snapshot.${path}`).toEqual(value);
    }
    for (const path of expected.snapshotNotNull ?? []) {
      expect(getPath(snap, path), `snapshot.${path}`).not.toBeNull();
      expect(getPath(snap, path), `snapshot.${path}`).not.toBeUndefined();
    }
    for (const [path, values] of Object.entries(expected.snapshotIncludes ?? {})) {
      expect(getPath(snap, path), `snapshot.${path}`).toEqual(expect.arrayContaining(values));
    }
  });

  it('is JSON-serializable and round-trips unchanged', async () => {
    const doc = loadFixtureDocument(name, expected.url);
    const snap = await extractSnapshot(doc, { fetch: mockFetch(expected.network) });
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
    expect(snap.schemaVersion).toBe(1);
  });
});

describe('very-large fixture', () => {
  it('stays under 5 MB and flags truncation', async () => {
    const expected = loadExpected('very-large');
    const doc = loadFixtureDocument('very-large', expected.url);
    const snap = await extractSnapshot(doc, { fetch: mockFetch() });
    const bytes = new TextEncoder().encode(JSON.stringify(snap)).length;
    expect(bytes).toBeLessThan(5_000_000);
    expect(snap.truncated).toContain('paragraphs');
    expect(snap.htmlSizeApprox).toBeGreaterThan(1_000_000);
    // the real counts survive truncation
    expect(snap.totals.paragraphs).toBeGreaterThan(snap.paragraphs.length);
  });
});

describe('extractor details', () => {
  const url = 'https://example.com/page';

  it('uses null for an empty title and captures url/time', async () => {
    const snap = await extractSnapshot(
      makeDocument('<html><head><title> </title></head></html>', url),
      {
        skipNetwork: true,
        now: () => new Date('2026-01-02T03:04:05.000Z'),
      },
    );
    expect(snap.title).toBeNull();
    expect(snap.url).toBe(url);
    expect(snap.capturedAt).toBe('2026-01-02T03:04:05.000Z');
  });

  it('reports skipped network checks as inaccessible with a reason, not as not_found', async () => {
    const snap = await extractSnapshot(makeDocument('<html></html>', url), { skipNetwork: true });
    expect(snap.robotsTxt.status).toBe('inaccessible');
    expect(snap.robotsTxt.reason).toMatch(/skipped/);
    expect(snap.sitemap.status).toBe('inaccessible');
  });

  it('does not fetch for non-http pages', async () => {
    const calls: string[] = [];
    const snap = await extractSnapshot(makeDocument('<html></html>', 'file:///tmp/a.html'), {
      fetch: async (u) => {
        calls.push(u);
        throw new Error('should not be called');
      },
    });
    expect(calls).toEqual([]);
    expect(snap.robotsTxt.status).toBe('inaccessible');
  });

  it('classifies link kinds and flags unsupported destinations', () => {
    const { snapshot } = extractDom(
      makeDocument(
        `<body>
          <a href="https://example.com/a">same host</a>
          <a href="https://www.other.com/">other host</a>
          <a href="#top">hash</a>
          <a href="/page#section">same page + hash</a>
          <a href="javascript:void(0)">js</a>
          <a href="">empty</a>
          <a href="ftp://files.example.com/x">ftp</a>
          <a href="/img.png"><img src="/i.png" alt="x"></a>
          <a>no href</a>
        </body>`,
        url,
      ),
    );
    const byText = (t: string) => snapshot.links.find((l) => l.text === t)!;
    expect(snapshot.totals.links).toBe(8); // <a> without href is not a link
    expect(byText('same host')).toMatchObject({
      kind: 'http',
      internal: true,
      invalidScheme: false,
    });
    expect(byText('other host')).toMatchObject({ kind: 'http', internal: false });
    expect(byText('hash')).toMatchObject({ kind: 'hash', samePageHash: true, internal: null });
    expect(byText('same page + hash')).toMatchObject({ samePageHash: true });
    expect(byText('js')).toMatchObject({ kind: 'javascript', invalidScheme: true });
    expect(byText('empty')).toMatchObject({ kind: 'empty', invalidScheme: true });
    expect(byText('ftp')).toMatchObject({ kind: 'other', invalidScheme: true });
    expect(snapshot.links.find((l) => l.hasImage)).toMatchObject({ text: '' });
  });

  it('keeps non-executable script types out of the script count', () => {
    const { snapshot } = extractDom(
      makeDocument(
        `<head>
          <script src="https://cdn.other.com/lib.js"></script>
          <script>var x = 1;</script>
          <script type="module" src="/m.js"></script>
          <script type="application/ld+json">{}</script>
          <script type="text/template"><p>hi</p></script>
        </head>`,
        url,
      ),
    );
    expect(snapshot.totals.scripts).toBe(3);
    expect(snapshot.scripts[0]).toMatchObject({ crossOrigin: true, inline: false });
    expect(snapshot.scripts[1]).toMatchObject({ inline: true, crossOrigin: null });
    expect(snapshot.scripts[2]).toMatchObject({ module: true, crossOrigin: false });
  });

  it('records stylesheet links and inline styles', () => {
    const { snapshot } = extractDom(
      makeDocument(
        `<head><link rel="stylesheet" href="/a.css"><link rel="icon" href="/f.ico"><style>p{}</style></head>`,
        url,
      ),
    );
    expect(snapshot.totals.stylesheets).toBe(2);
    expect(snapshot.stylesheets.map((s) => s.inline)).toEqual([false, true]);
  });

  it('handles data-URI images without storing the payload', () => {
    const { snapshot } = extractDom(
      makeDocument(`<img src="data:image/png;base64,${'A'.repeat(5000)}" alt="x">`, url),
    );
    expect(snapshot.images[0]?.isDataUri).toBe(true);
    expect(snapshot.images[0]?.src?.length).toBeLessThanOrEqual(40);
    expect(snapshot.images[0]?.filename).toBeNull();
  });

  it('caps microdata nesting depth and says so', () => {
    let html = '';
    for (let i = 0; i < 9; i++)
      html += `<div itemscope itemtype="https://schema.org/Thing" ${i ? 'itemprop="child"' : ''}>`;
    html += '</div>'.repeat(9);
    const { snapshot, t } = extractDom(makeDocument(html, url));
    expect(snapshot.structuredData.microdata).toHaveLength(1);
    expect(t.list()).toContain('structuredData.microdata.depth');
  });

  it('marks all-zero resource sizes as inaccessible instead of zero', () => {
    const doc = makeDocument('<html></html>', url);
    const fake = (name: string, sizes: [number, number, number]) => ({
      name,
      initiatorType: 'script',
      transferSize: sizes[0],
      encodedBodySize: sizes[1],
      decodedBodySize: sizes[2],
      duration: 12.4,
    });
    Object.defineProperty(doc.defaultView!, 'performance', {
      value: {
        getEntriesByType: (type: string) =>
          type === 'resource'
            ? [
                fake('https://cdn.other.com/a.js', [0, 0, 0]),
                fake('https://example.com/b.js', [300, 200, 900]),
              ]
            : [],
      },
      configurable: true,
    });
    const { snapshot } = extractDom(doc);
    expect(snapshot.resources.available).toBe(true);
    expect(snapshot.resources.sizeInaccessibleCount).toBe(1);
    expect(snapshot.resources.entries[0]?.transferSize).toBeNull();
    expect(snapshot.resources.entries[1]?.transferSize).toBe(300);
  });
});

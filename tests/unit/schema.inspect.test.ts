import { describe, expect, it } from 'vitest';
import {
  collectEntities,
  entitiesOfType,
  hasValue,
  itemToNode,
  shortType,
  valueText,
} from '../../src/analyzers/schema/normalize';
import { inspectSchema } from '../../src/analyzers/schema/inspect';
import { findTypeDef, TYPE_DEFS } from '../../src/analyzers/schema/types';
import { extractSnapshot } from '../../src/content/extractor';
import { blank, jsonld, withJsonLd } from './snapshotFactory';
import { loadFixtureDocument, mockFetch } from './helpers';

describe('normalize', () => {
  it('shortens type names from URLs and prefixes', () => {
    expect(
      ['https://schema.org/Person', 'schema:Person', 'Person', 'http://schema.org/#Thing'].map(
        shortType,
      ),
    ).toEqual(['Person', 'Person', 'Person', 'Thing']);
  });

  it('flattens @graph, arrays and nested objects with parent pointers', () => {
    const e = collectEntities(
      withJsonLd([
        {
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Article', headline: 'H', author: { '@type': 'Person', name: 'A' } },
            { '@type': ['Organization', 'LocalBusiness'], name: 'O' },
          ],
        },
        [{ '@type': 'WebSite' }],
      ]),
    );
    expect(e.map((x) => [x.types.join('/'), x.parent, x.depth])).toEqual([
      ['Article', null, 0],
      ['Person', 0, 1],
      ['Organization/LocalBusiness', null, 0],
      ['WebSite', null, 0],
    ]);
  });

  it('skips invalid blocks and converts microdata/RDFa to the same shape', () => {
    const s = blank({
      structuredData: {
        jsonld: [{ ...jsonld({ '@type': 'Thing' }), error: 'boom', parsed: null }],
        microdata: [
          {
            syntax: 'microdata',
            types: ['https://schema.org/Person'],
            id: null,
            properties: [
              { name: 'name', value: 'Ann' },
              {
                name: 'knows',
                value: {
                  syntax: 'microdata',
                  types: ['https://schema.org/Person'],
                  id: null,
                  properties: [{ name: 'name', value: 'Bo' }],
                },
              },
            ],
          },
        ],
        rdfa: [],
      },
    });
    const e = collectEntities(s);
    expect(e.map((x) => [x.syntax, x.types[0], x.parent])).toEqual([
      ['microdata', 'Person', null],
      ['microdata', 'Person', 0],
    ]);
    expect(itemToNode(s.structuredData.microdata[0]!)).toMatchObject({
      '@type': ['Person'],
      name: 'Ann',
    });
  });

  it('helpers: valueText, hasValue, entitiesOfType', () => {
    expect(valueText({ '@type': 'Person', name: 'Ann' })).toBe('Ann');
    expect(valueText(['', 'x'])).toBe('x');
    expect(valueText('  ')).toBeNull();
    expect([hasValue(''), hasValue([]), hasValue({}), hasValue(0), hasValue('a')]).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
    expect(
      entitiesOfType(collectEntities(withJsonLd([{ '@type': 'Person' }])), 'Person'),
    ).toHaveLength(1);
  });
});

describe('type definitions', () => {
  it('cover every type required by the spec and mandate nothing (recommended is not required)', () => {
    const names = TYPE_DEFS.map((d) => d.name);
    for (const n of [
      'Organization',
      'LocalBusiness',
      'Person',
      'Article',
      'Product',
      'Service',
      'FAQPage',
      'BreadcrumbList',
      'WebSite',
      'WebPage',
    ])
      expect(names).toContain(n);
    for (const d of TYPE_DEFS) {
      expect(d.required, d.name).toEqual([]);
      expect(d.recommended.length, d.name).toBeGreaterThan(0);
    }
  });
  it('resolves subtypes through aliases', () => {
    expect(findTypeDef('BlogPosting')?.name).toBe('Article');
    expect(findTypeDef('Restaurant')?.name).toBe('LocalBusiness');
    expect(findTypeDef('Nonsense')).toBeNull();
  });
});

describe('inspectSchema', () => {
  it('reports present and missing recommended properties, nested objects and block status', () => {
    const r = inspectSchema(
      withJsonLd([
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: 'H',
          author: { '@type': 'Person', name: 'A' },
        },
      ]),
    );
    const article = r.entities[0]!;
    expect(article.matchedType).toBe('Article');
    expect(article.properties.map((p) => p.name)).toEqual(['headline', 'author']);
    expect(article.properties.find((p) => p.name === 'author')).toMatchObject({
      nested: true,
      preview: '[Person]',
      level: 'recommended',
    });
    expect(article.missingRecommended).toEqual(['datePublished', 'dateModified', 'image']);
    expect(article.missingRequired).toEqual([]);
    expect(r.entities[1]).toMatchObject({ parent: 0, depth: 1, types: ['Person'] });
    expect(r.blocks).toEqual([{ index: 0, valid: true, error: null, entityCount: 2 }]);
  });

  it('ignores empty values when deciding what is present', () => {
    const r = inspectSchema(
      withJsonLd([{ '@type': 'Organization', name: 'X', url: '', sameAs: [] }]),
    );
    expect(r.entities[0]!.missingRecommended).toEqual(['url', 'logo', 'sameAs']);
  });

  it('keeps unknown types without crashing', () => {
    const r = inspectSchema(withJsonLd([{ '@type': 'Whatever', a: 1 }]));
    expect(r.entities[0]).toMatchObject({ matchedType: null, missingRecommended: [] });
  });

  it('bad-jsonld fixture: reports the syntax error and still parses the valid block', async () => {
    const snap = await extractSnapshot(
      loadFixtureDocument('bad-jsonld', 'https://example.com/schema-test'),
      { fetch: mockFetch() },
    );
    const r = inspectSchema(snap);
    expect(r.counts).toMatchObject({ jsonld: 3, invalidBlocks: 2, entities: 1 });
    expect(r.blocks.map((b) => b.valid)).toEqual([true, false, false]);
    expect(r.blocks[1]!.error).toBeTruthy();
    expect(r.entities[0]).toMatchObject({ types: ['Organization'], blockIndex: 0 });
    expect(r.rawJsonLd[1]!.raw).toContain('Broken Co');
  });

  it('organization fixture: JSON-LD plus microdata with nested address', async () => {
    const snap = await extractSnapshot(
      loadFixtureDocument('organization', 'https://example.com/about'),
      { fetch: mockFetch() },
    );
    const r = inspectSchema(snap);
    expect(r.counts).toMatchObject({ jsonld: 1, microdata: 1 });
    const types = r.entities.map((e) => `${e.syntax}:${e.types[0]}`);
    expect(types).toEqual(
      expect.arrayContaining([
        'jsonld:Organization',
        'jsonld:ContactPoint',
        'microdata:LocalBusiness',
        'microdata:PostalAddress',
      ]),
    );
    const lb = r.entities.find((e) => e.types[0] === 'LocalBusiness')!;
    expect(lb.missingRecommended).toEqual(
      expect.arrayContaining(['openingHoursSpecification', 'geo']),
    );
  });
});

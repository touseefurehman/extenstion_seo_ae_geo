import { describe, expect, it } from 'vitest';
import { analyzeGeo, brandNames } from '../../src/analyzers/geo/geo';
import {
  blank,
  heading,
  link,
  para,
  statusOf,
  withHead,
  withJsonLd,
  words,
} from './snapshotFactory';

const run = (s: ReturnType<typeof blank>, id: string) => statusOf(analyzeGeo(s), id);
const org = (extra: object = {}) => ({ '@type': 'Organization', name: 'BrewLab', ...extra });
const signals = (over: Partial<ReturnType<typeof blank>['signals']>) => ({
  ...blank().signals,
  ...over,
});
const long = { bodyWordCount: 500 };

describe('analyzeGeo', () => {
  it.each([
    ['org schema', withJsonLd([org()]), 'geo.entity.organization', 'passed'],
    ['org inside @graph', withJsonLd([{ '@graph': [org()] }]), 'geo.entity.organization', 'passed'],
    [
      'LocalBusiness counts',
      withJsonLd([{ '@type': 'LocalBusiness', name: 'Cafe' }]),
      'geo.entity.organization',
      'passed',
    ],
    [
      'org signals only',
      withHead({ og: { 'og:site_name': 'BrewLab' } }),
      'geo.entity.organization',
      'warning',
    ],
    ['no org at all', blank(), 'geo.entity.organization', 'warning'],
    [
      'person schema',
      withJsonLd([{ '@type': 'Person', name: 'Ann' }]),
      'geo.entity.person',
      'passed',
    ],
    [
      'author without Person',
      blank({ signals: signals({ authors: [{ source: 'meta', text: 'Ann' }] }) }),
      'geo.entity.person',
      'warning',
    ],
    ['no person', blank(), 'geo.entity.person', 'not_applicable'],
    [
      'product schema',
      withJsonLd([{ '@type': 'Product', name: 'Mug' }]),
      'geo.entity.product',
      'passed',
    ],
    [
      'service schema',
      withJsonLd([{ '@type': 'Service', name: 'Roasting' }]),
      'geo.entity.product',
      'passed',
    ],
    ['no product', blank(), 'geo.entity.product', 'not_applicable'],
    [
      'sameAs x2',
      withJsonLd([org({ sameAs: ['https://a.com/x', 'https://b.com/y'] })]),
      'geo.sameas',
      'passed',
    ],
    ['sameAs x1', withJsonLd([org({ sameAs: 'https://a.com/x' })]), 'geo.sameas', 'warning'],
    ['sameAs none', withJsonLd([org()]), 'geo.sameas', 'warning'],
    [
      'sameAs ignores non-URLs',
      withJsonLd([org({ sameAs: ['not a url', 'also not'] })]),
      'geo.sameas',
      'warning',
    ],
    ['sameAs without entity', blank(), 'geo.sameas', 'not_applicable'],
    [
      'contact: phone+email',
      blank({ signals: signals({ telLinks: ['+1'], mailtoLinks: ['a@b.c'] }) }),
      'geo.contact',
      'passed',
    ],
    [
      'contact: from schema',
      withJsonLd([org({ telephone: '+1', email: 'a@b.c' })]),
      'geo.contact',
      'passed',
    ],
    [
      'contact: one kind',
      blank({ signals: signals({ telLinks: ['+1'] }) }),
      'geo.contact',
      'warning',
    ],
    ['contact: none', blank(), 'geo.contact', 'warning'],
    ['authorship: none', blank(), 'geo.authorship', 'warning'],
    [
      'authorship: name only',
      blank({ signals: signals({ authors: [{ source: 'meta', text: 'Ann' }] }) }),
      'geo.authorship',
      'warning',
    ],
    [
      'authorship: rel=author profile',
      blank({ signals: signals({ authors: [{ source: 'rel-author', text: 'Ann' }] }) }),
      'geo.authorship',
      'passed',
    ],
    [
      'authorship: Person.jobTitle',
      withJsonLd([
        { '@type': 'Article', author: { '@type': 'Person', name: 'Ann', jobTitle: 'Chef' } },
        { '@type': 'Person', name: 'Ann', jobTitle: 'Chef' },
      ]),
      'geo.authorship',
      'passed',
    ],
    [
      'topical: many sections',
      blank({
        ...long,
        headings: [2, 3, 4, 5].map((n, i) => heading(2, `Brewing method ${n}`, i)),
      }),
      'geo.topical.coverage',
      'passed',
    ],
    [
      'topical: few sections',
      blank({ ...long, headings: [heading(2, 'Only one', 0)] }),
      'geo.topical.coverage',
      'warning',
    ],
    ['topical: thin page', blank(), 'geo.topical.coverage', 'not_applicable'],
    [
      'contextual links enough',
      blank({ ...long, links: [link(), link(), link()] }),
      'geo.links.contextual',
      'passed',
    ],
    [
      'contextual links few',
      blank({ ...long, links: [link()] }),
      'geo.links.contextual',
      'warning',
    ],
    [
      'contextual: nav/generic not counted',
      blank({
        ...long,
        links: [link({ region: 'nav' }), link({ text: 'click here' }), link({ region: 'footer' })],
      }),
      'geo.links.contextual',
      'warning',
    ],
    ['contextual: thin page', blank(), 'geo.links.contextual', 'not_applicable'],
    [
      'claims with references',
      blank({
        paragraphs: [
          para('Sales grew 40% in 2024.'),
          para('A study found 12 percent.'),
          para('According to experts it holds.'),
        ],
        links: [link({ internal: false })],
      }),
      'geo.claims.references',
      'passed',
    ],
    [
      'claims without references',
      blank({
        paragraphs: [
          para('Sales grew 40% in 2024.'),
          para('A study found 12 percent.'),
          para('According to experts it holds.'),
        ],
      }),
      'geo.claims.references',
      'warning',
    ],
    [
      'few claims',
      blank({ paragraphs: [para('Sales grew 40%.'), para(words(20))] }),
      'geo.claims.references',
      'not_applicable',
    ],
  ] as [string, ReturnType<typeof blank>, string, string][])('%s', (_n, s, id, expected) => {
    expect(run(s, id)).toBe(expected);
  });

  describe('brand consistency', () => {
    const page = (title: string | null, og: string | null, schemaName: string | null) =>
      withJsonLd(schemaName ? [org({ name: schemaName })] : [], {
        head: {
          ...blank().head,
          title,
          titleCount: title ? 1 : 0,
          og: og ? { 'og:site_name': og } : {},
        },
      });
    it.each([
      ['consistent everywhere', page('Home | BrewLab', 'BrewLab', 'BrewLab'), 'passed'],
      [
        'case/punctuation differences are fine',
        page('Home | BrewLab', 'Brew-Lab', 'BREWLAB'),
        'passed',
      ],
      [
        'extended legal name still matches',
        page('Home - BrewLab', 'BrewLab', 'BrewLab Coffee Roasters Inc.'),
        'passed',
      ],
      ['different names', page('Home | BrewLab', 'BrewLab', 'Acme Corp'), 'warning'],
      ['name missing from title', page('Welcome to our site', 'BrewLab', 'BrewLab'), 'warning'],
      ['no brand sources', page('Home', null, null), 'not_applicable'],
    ])('%s', (_n, s, expected) => expect(run(s, 'geo.brand.consistency')).toBe(expected));

    it('lists every source as evidence', () => {
      expect(brandNames(page('t', 'A', 'B')).map((b) => b.source)).toEqual([
        'og:site_name',
        'schema Organization',
      ]);
    });
  });

  it('tags results as detected or inferred and never claims AI citation measurement', () => {
    const r = analyzeGeo(
      withJsonLd([org({ sameAs: ['https://a.com/x', 'https://b.com/y'] })], {
        signals: signals({ authors: [{ source: 'rel-author', text: 'Ann' }] }),
      }),
    );
    expect(r.find((c) => c.id === 'geo.entity.organization')?.evidenceKind).toBe('detected');
    expect(r.find((c) => c.id === 'geo.authorship')?.evidenceKind).toBe('inferred');
    const text = r.map((c) => `${c.explanation} ${c.recommendation}`).join(' ');
    expect(text).toMatch(/nothing about whether any AI system|does not verify/);
    expect(text).not.toMatch(
      /citation rank|will be cited|improves? (your )?(ranking|visibility) in (chatgpt|gemini|claude|perplexity)/i,
    );
  });
});

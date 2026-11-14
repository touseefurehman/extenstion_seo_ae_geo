import { describe, expect, it } from 'vitest';
import { analyzeTechnical, robotsBlocksEverything } from '../../src/analyzers/seo/technical';
import { blank, link, meta, statusOf, withHead } from './snapshotFactory';

const canon = (href: string, inHead = true) => ({
  href,
  resolved: href.startsWith('http') ? href : null,
  inHead,
});
const A = 'https://example.com/a';

describe('analyzeTechnical', () => {
  const cases: [string, ReturnType<typeof blank>, string, string][] = [
    ['https', blank(), 'tech.https', 'passed'],
    ['http', blank({ url: 'http://example.com/' }), 'tech.https', 'failed'],
    ['non-http page', blank({ url: 'file:///x.html' }), 'tech.https', 'not_applicable'],
    ['canonical present', withHead({ canonicals: [canon(A)] }), 'tech.canonical.present', 'passed'],
    ['canonical missing', withHead({}), 'tech.canonical.present', 'warning'],
    [
      'canonical only in body',
      withHead({ canonicals: [canon(A, false)] }),
      'tech.canonical.present',
      'warning',
    ],
    ['conflict: none to compare', withHead({}), 'tech.canonical.conflict', 'not_applicable'],
    [
      'conflict: single canonical',
      withHead({ canonicals: [canon(A)] }),
      'tech.canonical.conflict',
      'passed',
    ],
    [
      'conflict: same canonical twice',
      withHead({ canonicals: [canon(A), canon(A)] }),
      'tech.canonical.conflict',
      'passed',
    ],
    [
      'conflict: two different canonicals',
      withHead({ canonicals: [canon(A), canon('https://example.com/b')] }),
      'tech.canonical.conflict',
      'failed',
    ],
    [
      'conflict: unparsable canonical',
      withHead({ canonicals: [{ href: 'http://', resolved: null, inHead: true }] }),
      'tech.canonical.conflict',
      'failed',
    ],
    [
      'conflict: og:url differs',
      withHead({ canonicals: [canon(A)], og: { 'og:url': 'https://example.com/other' } }),
      'tech.canonical.conflict',
      'warning',
    ],
    [
      'conflict: og:url equal (trailing slash/hash ignored)',
      withHead({ canonicals: [canon(A)], og: { 'og:url': `${A}/#x` } }),
      'tech.canonical.conflict',
      'passed',
    ],
    ['robots meta absent', withHead({}), 'tech.robots.meta', 'passed'],
    [
      'robots index,follow',
      withHead({ metas: [meta('robots', 'index, follow')] }),
      'tech.robots.meta',
      'passed',
    ],
    [
      'robots noindex',
      withHead({ metas: [meta('robots', 'noindex')] }),
      'tech.robots.meta',
      'warning',
    ],
    [
      'googlebot nofollow',
      withHead({ metas: [meta('googlebot', 'NOFOLLOW')] }),
      'tech.robots.meta',
      'warning',
    ],
    ['robots none', withHead({ metas: [meta('robots', 'none')] }), 'tech.robots.meta', 'warning'],
    [
      'viewport ok',
      withHead({ metas: [meta('viewport', 'width=device-width, initial-scale=1')] }),
      'tech.viewport',
      'passed',
    ],
    [
      'viewport fixed width',
      withHead({ metas: [meta('viewport', 'width=1024')] }),
      'tech.viewport',
      'warning',
    ],
    ['viewport missing', withHead({}), 'tech.viewport', 'failed'],
    ['lang ok', withHead({ lang: 'en-GB' }), 'tech.lang', 'passed'],
    ['lang missing', withHead({}), 'tech.lang', 'warning'],
    ['lang invalid', withHead({ lang: 'english please' }), 'tech.lang', 'warning'],
    ['hreflang none', withHead({}), 'tech.hreflang.valid', 'not_applicable'],
    [
      'hreflang valid with self',
      withHead({
        hreflang: [
          { lang: 'en', href: A, resolved: A },
          { lang: 'x-default', href: A, resolved: A },
        ].slice(0, 1),
        canonicals: [canon(A)],
      }),
      'tech.hreflang.valid',
      'passed',
    ],
    [
      'hreflang invalid code',
      withHead({ hreflang: [{ lang: 'english', href: A, resolved: A }] }),
      'tech.hreflang.valid',
      'failed',
    ],
    [
      'hreflang relative URL',
      withHead({ hreflang: [{ lang: 'en', href: '/en', resolved: 'https://example.com/en' }] }),
      'tech.hreflang.valid',
      'failed',
    ],
    [
      'hreflang duplicates',
      withHead({
        hreflang: [
          { lang: 'en', href: A, resolved: A },
          { lang: 'en', href: 'https://example.com/b', resolved: 'https://example.com/b' },
        ],
        canonicals: [canon(A)],
      }),
      'tech.hreflang.valid',
      'warning',
    ],
    [
      'hreflang without self-reference',
      withHead({
        hreflang: [
          { lang: 'es', href: 'https://example.com/es', resolved: 'https://example.com/es' },
        ],
        canonicals: [canon(A)],
      }),
      'tech.hreflang.valid',
      'warning',
    ],
    ['no JSON-LD', blank(), 'tech.structured.validjson', 'not_applicable'],
    ['links: none', blank(), 'tech.links.invalidscheme', 'not_applicable'],
    ['links: all fine', blank({ links: [link()] }), 'tech.links.invalidscheme', 'passed'],
    [
      'links: javascript:',
      blank({ links: [link({ kind: 'javascript', invalidScheme: true, internal: null })] }),
      'tech.links.invalidscheme',
      'warning',
    ],
  ];
  it.each(cases)('%s', (_n, s, id, expected) => {
    expect(statusOf(analyzeTechnical(s), id)).toBe(expected);
  });

  const robots = (
    status: 'found' | 'not_found' | 'inaccessible',
    body: string | null = '',
    reason: string | null = null,
  ) =>
    blank({
      robotsTxt: {
        status,
        url: 'https://example.com/robots.txt',
        httpStatus: 200,
        reason,
        body,
        bodyTruncated: false,
        sitemapUrls: [],
      },
    });
  it('robots.txt: found / blocks all / not found / inaccessible', () => {
    expect(
      statusOf(analyzeTechnical(robots('found', 'User-agent: *\nAllow: /')), 'tech.robotstxt'),
    ).toBe('passed');
    expect(
      statusOf(analyzeTechnical(robots('found', 'User-agent: *\nDisallow: /')), 'tech.robotstxt'),
    ).toBe('warning');
    expect(
      statusOf(analyzeTechnical(robots('not_found', null, 'HTTP 404')), 'tech.robotstxt'),
    ).toBe('warning');
    const hidden = analyzeTechnical(robots('inaccessible', null, 'HTTP 403'));
    expect(statusOf(hidden, 'tech.robotstxt')).toBe('not_tested');
    expect(hidden.find((c) => c.id === 'tech.robotstxt')?.notTestedReason).toBe('HTTP 403');
  });

  const sitemap = (status: 'found' | 'not_found' | 'inaccessible', reason: string | null = null) =>
    blank({
      sitemap: {
        status,
        url: 'https://example.com/sitemap.xml',
        source: 'default',
        httpStatus: 200,
        reason,
        kind: 'urlset',
        entryCount: 5,
        entryCountApproximate: false,
      },
    });
  it('sitemap: found / not found / inaccessible', () => {
    expect(statusOf(analyzeTechnical(sitemap('found')), 'tech.sitemap')).toBe('passed');
    expect(statusOf(analyzeTechnical(sitemap('not_found', 'HTTP 404')), 'tech.sitemap')).toBe(
      'warning',
    );
    expect(statusOf(analyzeTechnical(sitemap('inaccessible', 'timed out')), 'tech.sitemap')).toBe(
      'not_tested',
    );
  });

  it('JSON-LD syntax: valid vs invalid, with the real error as evidence', () => {
    const block = (index: number, error: string | null) => ({
      index,
      raw: '{}',
      rawTruncated: false,
      parsed: error ? null : {},
      error,
      tooLarge: false,
    });
    const ok = blank({ structuredData: { jsonld: [block(0, null)], microdata: [], rdfa: [] } });
    const bad = blank({
      structuredData: {
        jsonld: [block(0, null), block(1, 'Unexpected token }')],
        microdata: [],
        rdfa: [],
      },
    });
    expect(statusOf(analyzeTechnical(ok), 'tech.structured.validjson')).toBe('passed');
    const r = analyzeTechnical(bad).find((c) => c.id === 'tech.structured.validjson')!;
    expect(r.status).toBe('failed');
    expect(r.evidence[0]).toEqual({ label: 'Block #2 error', value: 'Unexpected token }' });
  });
});

describe('robotsBlocksEverything', () => {
  it.each([
    ['User-agent: *\nDisallow: /', true],
    ['User-agent: *\nDisallow: /private', false],
    ['User-agent: *\nDisallow:', false],
    ['User-agent: Googlebot\nDisallow: /', false],
    ['User-agent: *\nDisallow: /\nAllow: /', false],
    ['User-agent: Bad\nDisallow: /\n\nUser-agent: *\nDisallow: /tmp', false],
    ['User-agent: Good\nDisallow:\n\nUser-agent: *\nDisallow: /  # all', true],
    ['', false],
  ])('%j -> %s', (body, expected) => {
    expect(robotsBlocksEverything(body)).toBe(expected);
  });
});

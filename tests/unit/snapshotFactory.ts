import type { HeadingInfo, ImageInfo, LinkInfo, PageSnapshot } from '../../src/types/snapshot';

/** A minimal, valid, empty snapshot. Tests override only what they need. */
export function blank(over: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    schemaVersion: 1,
    url: 'https://example.com/page',
    capturedAt: '2026-01-01T00:00:00.000Z',
    contentType: 'text/html',
    title: null,
    head: {
      title: null,
      titleCount: 0,
      metas: [],
      canonicals: [],
      lang: null,
      charset: 'UTF-8',
      hasDoctype: true,
      hreflang: [],
      og: {},
      twitter: {},
      links: [],
    },
    headings: [],
    paragraphs: [],
    lists: [],
    tables: [],
    faqBlocks: [],
    faqContainerHints: [],
    images: [],
    links: [],
    scripts: [],
    stylesheets: [],
    domNodeCount: 100,
    htmlSizeApprox: 10_000,
    bodyWordCount: 0,
    resources: {
      available: true,
      total: 0,
      entries: [],
      sizeInaccessibleCount: 0,
      navigation: null,
    },
    structuredData: { jsonld: [], microdata: [], rdfa: [] },
    signals: {
      authors: [],
      dates: [],
      addresses: [],
      telLinks: [],
      mailtoLinks: [],
      citations: { blockquotes: [], citeElements: 0 },
    },
    robotsTxt: {
      status: 'not_found',
      url: 'https://example.com/robots.txt',
      httpStatus: 404,
      reason: 'HTTP 404',
      body: null,
      bodyTruncated: false,
      sitemapUrls: [],
    },
    sitemap: {
      status: 'not_found',
      url: 'https://example.com/sitemap.xml',
      source: 'default',
      httpStatus: 404,
      reason: 'HTTP 404',
      kind: null,
      entryCount: null,
      entryCountApproximate: false,
    },
    totals: {
      headings: 0,
      paragraphs: 0,
      lists: 0,
      tables: 0,
      images: 0,
      links: 0,
      scripts: 0,
      stylesheets: 0,
    },
    truncated: [],
    ...over,
  };
}

/** Builds a snapshot whose head fields are overridden; keeps `title` in sync. */
export function withHead(
  head: Partial<PageSnapshot['head']>,
  over: Partial<PageSnapshot> = {},
): PageSnapshot {
  const base = blank();
  const merged = { ...base.head, ...head };
  return blank({ head: merged, title: merged.title, ...over });
}

export const meta = (name: string, content: string) => ({
  name,
  property: null,
  httpEquiv: null,
  charset: null,
  itemprop: null,
  content,
});

export const heading = (
  level: HeadingInfo['level'],
  text: string,
  order: number,
  over: Partial<HeadingInfo> = {},
): HeadingInfo => ({
  level,
  text,
  order,
  empty: text === '',
  region: 'main',
  ...over,
});

export const image = (over: Partial<ImageInfo> = {}): ImageInfo => ({
  src: '/img/a.jpg',
  resolvedSrc: 'https://example.com/img/a.jpg',
  isDataUri: false,
  alt: 'A',
  widthAttr: 100,
  heightAttr: 100,
  naturalWidth: 100,
  naturalHeight: 100,
  complete: true,
  loading: null,
  hasSrcset: false,
  filename: 'a.jpg',
  ...over,
});

export const link = (over: Partial<LinkInfo> = {}): LinkInfo => ({
  href: '/a',
  resolved: 'https://example.com/a',
  kind: 'http',
  internal: true,
  rel: [],
  text: 'About us',
  ariaLabel: null,
  hasImage: false,
  target: null,
  samePageHash: false,
  invalidScheme: false,
  region: 'main',
  ...over,
});

export function statusOf(
  results: { id: string; status: string }[],
  id: string,
): string | undefined {
  return results.find((r) => r.id === id)?.status;
}

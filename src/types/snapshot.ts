/**
 * PageSnapshot: plain, JSON-serializable data extracted from the live page.
 *
 * Every list is capped (see src/content/limits.ts). When a cap is hit, the field name is added to
 * `truncated` and the real number of items is still available in `totals`, so analyzers can stay
 * honest about partial data.
 */
export type Availability = 'found' | 'not_found' | 'inaccessible';
export type Region = 'main' | 'nav' | 'header' | 'footer' | 'aside' | 'other';

export interface MetaTag {
  name: string | null;
  property: string | null;
  httpEquiv: string | null;
  charset: string | null;
  itemprop: string | null;
  content: string | null;
}

export interface HeadLink {
  rel: string;
  href: string | null;
  type: string | null;
  hreflang: string | null;
  media: string | null;
  sizes: string | null;
  as: string | null;
}

export interface CanonicalLink {
  href: string;
  resolved: string | null;
  /** False when the tag sits outside <head> (search engines may ignore it). */
  inHead: boolean;
}

export interface HeadInfo {
  /** Text of the first <title> in <head>, or null when missing or empty. */
  title: string | null;
  /** Number of <title> elements in <head>. */
  titleCount: number;
  metas: MetaTag[];
  canonicals: CanonicalLink[];
  /** Value of <html lang>, or null when absent. */
  lang: string | null;
  charset: string | null;
  hasDoctype: boolean;
  hreflang: { lang: string; href: string; resolved: string | null }[];
  /** First occurrence of each `og:*` property. */
  og: Record<string, string>;
  /** First occurrence of each `twitter:*` tag. */
  twitter: Record<string, string>;
  links: HeadLink[];
}

export interface HeadingInfo {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  /** Zero-based position among all headings in document order. */
  order: number;
  /** True when the heading has no text (and no image with alt text). */
  empty: boolean;
  region: Region;
}

export interface ParagraphInfo {
  text: string;
  /** Word count of the full (untruncated) text. */
  wordCount: number;
  /** `order` of the closest preceding heading, or null before the first heading. */
  afterHeadingIndex: number | null;
  region: Region;
}

export interface ListInfo {
  ordered: boolean;
  itemCount: number;
  items: string[];
  afterHeadingIndex: number | null;
  region: Region;
}

export interface TableInfo {
  rows: number;
  /** Largest number of cells found in a single row. */
  cols: number;
  hasHeader: boolean;
  caption: string | null;
  afterHeadingIndex: number | null;
  region: Region;
}

export interface FaqBlock {
  source: 'details' | 'dl' | 'microdata';
  question: string;
  answer: string;
}

export interface ImageInfo {
  /** Raw `src` attribute (falls back to `data-src`); data URIs are shortened. */
  src: string | null;
  resolvedSrc: string | null;
  isDataUri: boolean;
  /** null = attribute absent; '' = present but empty. */
  alt: string | null;
  widthAttr: number | null;
  heightAttr: number | null;
  /** 0 can mean "not loaded yet"; check `complete`. */
  naturalWidth: number;
  naturalHeight: number;
  complete: boolean;
  loading: string | null;
  hasSrcset: boolean;
  filename: string | null;
}

export type LinkKind = 'http' | 'mailto' | 'tel' | 'hash' | 'javascript' | 'empty' | 'other';

export interface LinkInfo {
  href: string;
  resolved: string | null;
  kind: LinkKind;
  /** Same host as the page; null when not an http(s) link. */
  internal: boolean | null;
  rel: string[];
  /** Visible anchor text (whitespace-normalised). */
  text: string;
  ariaLabel: string | null;
  hasImage: boolean;
  target: string | null;
  /** Points to an anchor on the current page. */
  samePageHash: boolean;
  /** javascript:, empty or other unsupported destinations. */
  invalidScheme: boolean;
  region: Region;
}

export interface ScriptInfo {
  src: string | null;
  inline: boolean;
  async: boolean;
  defer: boolean;
  module: boolean;
  /** Host differs from the page; null for inline scripts. */
  crossOrigin: boolean | null;
}

export interface StylesheetInfo {
  href: string | null;
  inline: boolean;
  media: string | null;
  crossOrigin: boolean | null;
}

export interface ResourceEntry {
  name: string;
  initiatorType: string;
  /** null when the browser withholds sizes (cross-origin without Timing-Allow-Origin). */
  transferSize: number | null;
  encodedBodySize: number | null;
  duration: number;
}

export interface ResourcesInfo {
  /** False when the Performance API was unavailable. */
  available: boolean;
  total: number;
  entries: ResourceEntry[];
  /** Resources whose size the browser did not report (inaccessible, not zero). */
  sizeInaccessibleCount: number;
  navigation: {
    type: string | null;
    domContentLoadedMs: number | null;
    loadMs: number | null;
  } | null;
}

export interface JsonLdBlock {
  index: number;
  raw: string;
  rawTruncated: boolean;
  /** Parsed value, or null on syntax error or when the block is too large to keep. */
  parsed: unknown;
  /** JSON syntax error message, or null. */
  error: string | null;
  tooLarge: boolean;
}

export interface StructuredItem {
  syntax: 'microdata' | 'rdfa';
  types: string[];
  id: string | null;
  properties: { name: string; value: string | StructuredItem }[];
}

export interface StructuredDataInfo {
  jsonld: JsonLdBlock[];
  microdata: StructuredItem[];
  rdfa: StructuredItem[];
}

export interface AuthorSignal {
  source: 'meta' | 'rel-author' | 'itemprop' | 'byline-class';
  text: string;
}

export interface DateSignal {
  source: 'meta' | 'itemprop' | 'time';
  kind: 'published' | 'modified' | 'unspecified';
  /** Raw value (datetime attribute, content attribute or text). */
  value: string;
}

export interface SignalsInfo {
  authors: AuthorSignal[];
  dates: DateSignal[];
  addresses: string[];
  telLinks: string[];
  mailtoLinks: string[];
  citations: {
    /** <blockquote> elements with their `cite` attribute (null when absent). */
    blockquotes: { cite: string | null; text: string }[];
    /** Number of <cite> elements on the page. */
    citeElements: number;
  };
}

export interface RobotsTxtInfo {
  status: Availability;
  url: string | null;
  httpStatus: number | null;
  /** Why the file was not read, when status is not `found`. */
  reason: string | null;
  body: string | null;
  bodyTruncated: boolean;
  /** `Sitemap:` lines declared in robots.txt. */
  sitemapUrls: string[];
}

export interface SitemapInfo {
  status: Availability;
  url: string | null;
  source: 'robots' | 'default' | null;
  httpStatus: number | null;
  reason: string | null;
  kind: 'urlset' | 'index' | null;
  entryCount: number | null;
  entryCountApproximate: boolean;
}

export interface Totals {
  headings: number;
  paragraphs: number;
  lists: number;
  tables: number;
  images: number;
  links: number;
  scripts: number;
  stylesheets: number;
}

export interface PageSnapshot {
  schemaVersion: 1;
  url: string;
  /** ISO timestamp. */
  capturedAt: string;
  contentType: string | null;
  /** Same as head.title; kept for the popup. */
  title: string | null;
  head: HeadInfo;
  headings: HeadingInfo[];
  paragraphs: ParagraphInfo[];
  lists: ListInfo[];
  tables: TableInfo[];
  faqBlocks: FaqBlock[];
  /** Elements whose id/class contains "faq" (hint only). */
  faqContainerHints: string[];
  images: ImageInfo[];
  links: LinkInfo[];
  scripts: ScriptInfo[];
  stylesheets: StylesheetInfo[];
  domNodeCount: number;
  /** Approximation: length of documentElement.outerHTML in characters (the rendered DOM, not the network response). */
  htmlSizeApprox: number;
  /** Word count of visible-text nodes in <body>, excluding script/style. Hidden elements are included. */
  bodyWordCount: number;
  resources: ResourcesInfo;
  structuredData: StructuredDataInfo;
  signals: SignalsInfo;
  robotsTxt: RobotsTxtInfo;
  sitemap: SitemapInfo;
  /** Real item counts before caps were applied. */
  totals: Totals;
  /** Names of fields that were capped or shortened. */
  truncated: string[];
}

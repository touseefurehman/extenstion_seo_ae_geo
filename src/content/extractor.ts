import type {
  AuthorSignal,
  CanonicalLink,
  DateSignal,
  FaqBlock,
  HeadingInfo,
  HeadInfo,
  ImageInfo,
  LinkInfo,
  LinkKind,
  ListInfo,
  MetaTag,
  PageSnapshot,
  ParagraphInfo,
  Region,
  ResourcesInfo,
  ScriptInfo,
  StylesheetInfo,
  TableInfo,
  Totals,
} from '../types/snapshot';
import { LIMITS } from './limits';
import { fetchRobotsTxt, fetchSitemap, networkUnavailable, type FetchLike } from './network';
import { extractItems, extractJsonLd } from './structured';
import {
  clip,
  countWords,
  filenameFromUrl,
  norm,
  parseDimension,
  relTokens,
  safeUrl,
  Truncations,
} from './text';

/**
 * Reads the live page DOM into a PageSnapshot. Everything under src/content/ may touch the DOM;
 * analyzers must not. The robots.txt / sitemap fetches are the only network calls and are
 * same-origin only.
 */

export interface ExtractOptions {
  fetch?: FetchLike;
  now?: () => Date;
  /** Skip robots.txt/sitemap fetches (reported as inaccessible with a reason). */
  skipNetwork?: boolean;
}

function regionOf(el: Element): Region {
  const r = el.closest('main,nav,header,footer,aside');
  return r ? (r.tagName.toLowerCase() as Region) : 'other';
}

function attr(
  el: Element,
  name: string,
  t: Truncations,
  field: string,
  max: number = LIMITS.attrChars,
) {
  const v = el.getAttribute(name);
  return v === null ? null : clip(v, max, t, field);
}

function sameHost(url: URL, pageUrl: URL | null): boolean | null {
  if (!pageUrl) return null;
  return url.hostname.toLowerCase() === pageUrl.hostname.toLowerCase();
}

function extractHead(doc: Document, pageUrl: string, t: Truncations): HeadInfo {
  const titles = doc.head ? Array.from(doc.head.querySelectorAll('title')) : [];
  const titleText = norm(titles[0]?.textContent);
  const allMetas = Array.from(doc.querySelectorAll('meta'));
  if (allMetas.length > LIMITS.metas) t.mark('head.metas');
  const metas: MetaTag[] = allMetas.slice(0, LIMITS.metas).map((m) => ({
    name: m.getAttribute('name')?.trim().toLowerCase() ?? null,
    property: m.getAttribute('property')?.trim().toLowerCase() ?? null,
    httpEquiv: m.getAttribute('http-equiv')?.trim().toLowerCase() ?? null,
    charset: m.getAttribute('charset'),
    itemprop: m.getAttribute('itemprop'),
    content: attr(m, 'content', t, 'head.metas.content', LIMITS.metaChars),
  }));
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  for (const m of metas) {
    const key = m.property ?? m.name;
    if (!key || m.content === null) continue;
    if (key.startsWith('og:') && !(key in og)) og[key] = m.content;
    if (key.startsWith('twitter:') && !(key in twitter)) twitter[key] = m.content;
  }

  const linkEls = Array.from(doc.querySelectorAll('link'));
  const canonicals: CanonicalLink[] = linkEls
    .filter((l) => relTokens(l.getAttribute('rel')).includes('canonical'))
    .map((l) => {
      const href = l.getAttribute('href') ?? '';
      return {
        href: clip(href, LIMITS.attrChars, t, 'head.canonicals'),
        resolved: safeUrl(href, pageUrl)?.href ?? null,
        inHead: l.closest('head') !== null,
      };
    });
  const hreflang = linkEls
    .filter(
      (l) =>
        relTokens(l.getAttribute('rel')).includes('alternate') &&
        l.getAttribute('hreflang') !== null,
    )
    .map((l) => {
      const href = l.getAttribute('href') ?? '';
      return {
        lang: (l.getAttribute('hreflang') ?? '').trim(),
        href: clip(href, LIMITS.attrChars, t, 'head.hreflang'),
        resolved: safeUrl(href, pageUrl)?.href ?? null,
      };
    });
  if (linkEls.length > LIMITS.headLinks) t.mark('head.links');
  const links = linkEls.slice(0, LIMITS.headLinks).map((l) => ({
    rel: (l.getAttribute('rel') ?? '').trim().toLowerCase(),
    href: attr(l, 'href', t, 'head.links.href'),
    type: l.getAttribute('type'),
    hreflang: l.getAttribute('hreflang'),
    media: l.getAttribute('media'),
    sizes: l.getAttribute('sizes'),
    as: l.getAttribute('as'),
  }));

  const lang = doc.documentElement.getAttribute('lang');
  return {
    title: titleText === '' ? null : clip(titleText, LIMITS.textChars, t, 'head.title'),
    titleCount: titles.length,
    metas,
    canonicals,
    lang: lang === null || lang.trim() === '' ? null : lang.trim(),
    charset: doc.characterSet ?? null,
    hasDoctype: doc.doctype !== null,
    hreflang,
    og,
    twitter,
    links,
  };
}

interface ContentParts {
  headings: HeadingInfo[];
  paragraphs: ParagraphInfo[];
  lists: ListInfo[];
  tables: TableInfo[];
}

function extractContent(doc: Document, t: Truncations, totals: Totals): ContentParts {
  const headings: HeadingInfo[] = [];
  const paragraphs: ParagraphInfo[] = [];
  const lists: ListInfo[] = [];
  const tables: TableInfo[] = [];
  let lastHeading: number | null = null;

  for (const el of Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6,p,ul,ol,table'))) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const order = totals.headings++;
      lastHeading = order;
      if (headings.length >= LIMITS.headings) {
        t.mark('headings');
        continue;
      }
      const text = norm(el.textContent);
      const hasAltImage = Array.from(el.querySelectorAll('img')).some(
        (i) => norm(i.getAttribute('alt')) !== '',
      );
      headings.push({
        level: Number(tag[1]) as HeadingInfo['level'],
        text: clip(text, LIMITS.headingChars, t, 'headings.text'),
        order,
        empty: text === '' && !hasAltImage,
        region: regionOf(el),
      });
    } else if (tag === 'p') {
      const text = norm(el.textContent);
      if (text === '') continue;
      totals.paragraphs++;
      if (paragraphs.length >= LIMITS.paragraphs) {
        t.mark('paragraphs');
        continue;
      }
      paragraphs.push({
        text: clip(text, LIMITS.textChars, t, 'paragraphs.text'),
        wordCount: countWords(text),
        afterHeadingIndex: lastHeading,
        region: regionOf(el),
      });
    } else if (tag === 'ul' || tag === 'ol') {
      totals.lists++;
      if (lists.length >= LIMITS.lists) {
        t.mark('lists');
        continue;
      }
      const lis = Array.from(el.children).filter((c) => c.tagName === 'LI');
      if (lis.length > LIMITS.listItems) t.mark('lists.items');
      lists.push({
        ordered: tag === 'ol',
        itemCount: lis.length,
        items: lis
          .slice(0, LIMITS.listItems)
          .map((li) => clip(norm(li.textContent), LIMITS.listItemChars, t, 'lists.items')),
        afterHeadingIndex: lastHeading,
        region: regionOf(el),
      });
    } else {
      totals.tables++;
      if (tables.length >= LIMITS.tables) {
        t.mark('tables');
        continue;
      }
      const rows = Array.from(el.querySelectorAll('tr'));
      const caption = norm(el.querySelector('caption')?.textContent);
      tables.push({
        rows: rows.length,
        cols: rows.reduce(
          (max, r) =>
            Math.max(
              max,
              Array.from(r.children).filter((c) => c.tagName === 'TD' || c.tagName === 'TH').length,
            ),
          0,
        ),
        hasHeader: el.querySelector('th') !== null,
        caption: caption === '' ? null : clip(caption, LIMITS.textChars, t, 'tables.caption'),
        afterHeadingIndex: lastHeading,
        region: regionOf(el),
      });
    }
  }
  return { headings, paragraphs, lists, tables };
}

function extractFaq(doc: Document, t: Truncations): { blocks: FaqBlock[]; hints: string[] } {
  const blocks: FaqBlock[] = [];
  const push = (b: FaqBlock) => {
    if (blocks.length >= LIMITS.faqBlocks) {
      t.mark('faqBlocks');
      return;
    }
    blocks.push({
      source: b.source,
      question: clip(b.question, LIMITS.textChars, t, 'faqBlocks.text'),
      answer: clip(b.answer, LIMITS.textChars, t, 'faqBlocks.text'),
    });
  };

  for (const d of Array.from(doc.querySelectorAll('details'))) {
    const summary = Array.from(d.children).find((c) => c.tagName === 'SUMMARY');
    if (!summary) continue;
    const answer = norm(
      Array.from(d.childNodes)
        .filter((n) => n !== summary)
        .map((n) => n.textContent ?? '')
        .join(' '),
    );
    push({ source: 'details', question: norm(summary.textContent), answer });
  }

  for (const dl of Array.from(doc.querySelectorAll('dl'))) {
    let question: string | null = null;
    let answer: string[] = [];
    const flush = () => {
      if (question !== null) push({ source: 'dl', question, answer: norm(answer.join(' ')) });
      question = null;
      answer = [];
    };
    for (const child of Array.from(dl.children)) {
      if (child.tagName === 'DT') {
        flush();
        question = norm(child.textContent);
      } else if (child.tagName === 'DD' && question !== null) {
        answer.push(child.textContent ?? '');
      }
    }
    flush();
  }

  for (const q of Array.from(doc.querySelectorAll('[itemscope][itemtype]'))) {
    if (!/\/Question\/?$/i.test(q.getAttribute('itemtype') ?? '')) continue;
    const name = q.querySelector('[itemprop~="name"]');
    const text = q.querySelector('[itemprop~="acceptedAnswer"] [itemprop~="text"]');
    if (name)
      push({
        source: 'microdata',
        question: norm(name.textContent),
        answer: norm(text?.textContent),
      });
  }

  const hints: string[] = [];
  for (const el of Array.from(doc.querySelectorAll('[id],[class]'))) {
    const id = el.getAttribute('id') ?? '';
    const cls = el.getAttribute('class') ?? '';
    if (!/faq/i.test(`${id} ${cls}`)) continue;
    if (hints.length >= LIMITS.faqHints) {
      t.mark('faqContainerHints');
      break;
    }
    const firstClass = cls.trim().split(/\s+/)[0];
    hints.push(
      `${el.tagName.toLowerCase()}${id ? `#${id}` : ''}${firstClass ? `.${firstClass}` : ''}`,
    );
  }
  return { blocks, hints };
}

function extractImages(
  doc: Document,
  pageUrl: string,
  t: Truncations,
  totals: Totals,
): ImageInfo[] {
  const imgs = Array.from(doc.querySelectorAll('img'));
  totals.images = imgs.length;
  if (imgs.length > LIMITS.images) t.mark('images');
  return imgs.slice(0, LIMITS.images).map((img) => {
    const rawSrc = img.getAttribute('src') ?? img.getAttribute('data-src');
    const isDataUri = rawSrc !== null && /^\s*data:/i.test(rawSrc);
    const resolved = rawSrc && !isDataUri ? safeUrl(rawSrc, pageUrl) : null;
    return {
      src:
        rawSrc === null
          ? null
          : clip(isDataUri ? rawSrc.slice(0, 40) : rawSrc, LIMITS.attrChars, t, 'images.src'),
      resolvedSrc: resolved ? clip(resolved.href, LIMITS.attrChars, t, 'images.src') : null,
      isDataUri,
      alt: img.getAttribute('alt'),
      widthAttr: parseDimension(img.getAttribute('width')),
      heightAttr: parseDimension(img.getAttribute('height')),
      naturalWidth: img.naturalWidth || 0,
      naturalHeight: img.naturalHeight || 0,
      complete: img.complete ?? false,
      loading: img.getAttribute('loading')?.trim().toLowerCase() ?? null,
      hasSrcset: img.hasAttribute('srcset'),
      filename: resolved ? filenameFromUrl(resolved) : null,
    };
  });
}

function classifyLink(href: string, resolved: URL | null): LinkKind {
  if (href.trim() === '') return 'empty';
  if (href.trim().startsWith('#')) return 'hash';
  if (!resolved) return 'other';
  switch (resolved.protocol) {
    case 'http:':
    case 'https:':
      return 'http';
    case 'mailto:':
      return 'mailto';
    case 'tel:':
      return 'tel';
    case 'javascript:':
      return 'javascript';
    default:
      return 'other';
  }
}

function extractLinks(
  doc: Document,
  pageUrl: string,
  t: Truncations,
  totals: Totals,
): { links: LinkInfo[]; tel: string[]; mailto: string[] } {
  const base = doc.baseURI || pageUrl; // read once: the getter is slow on large documents
  const anchors = Array.from(doc.querySelectorAll('a[href]'));
  totals.links = anchors.length;
  if (anchors.length > LIMITS.links) t.mark('links');
  const page = safeUrl(pageUrl, pageUrl);
  const pageNoHash = page ? page.href.split('#')[0] : null;
  const tel = new Set<string>();
  const mailto = new Set<string>();
  const links: LinkInfo[] = [];

  anchors.forEach((a, i) => {
    const href = a.getAttribute('href') ?? '';
    const resolved = safeUrl(href, base);
    const kind = classifyLink(href, resolved);
    if (kind === 'tel' && tel.size < LIMITS.contactLinks) {
      tel.add(clip(href.replace(/^tel:/i, '').trim(), 60));
    }
    if (kind === 'mailto' && mailto.size < LIMITS.contactLinks) {
      mailto.add(
        clip(
          href
            .replace(/^mailto:/i, '')
            .split('?')[0]
            ?.trim() ?? '',
          120,
        ),
      );
    }
    if (i >= LIMITS.links) return;
    const samePageHash =
      kind === 'hash' ||
      (kind === 'http' &&
        resolved !== null &&
        resolved.hash !== '' &&
        resolved.href.split('#')[0] === pageNoHash);
    links.push({
      href: clip(href, LIMITS.attrChars, t, 'links.href'),
      resolved: resolved ? clip(resolved.href, LIMITS.attrChars, t, 'links.href') : null,
      kind,
      internal: kind === 'http' && resolved ? sameHost(resolved, page) : null,
      rel: relTokens(a.getAttribute('rel')),
      text: clip(norm(a.textContent), LIMITS.anchorChars, t, 'links.text'),
      ariaLabel: a.getAttribute('aria-label'),
      hasImage: a.querySelector('img') !== null,
      target: a.getAttribute('target'),
      samePageHash,
      invalidScheme: kind === 'javascript' || kind === 'empty' || kind === 'other',
      region: regionOf(a),
    });
  });
  return { links, tel: [...tel], mailto: [...mailto] };
}

function extractAssets(
  doc: Document,
  pageUrl: string,
  t: Truncations,
  totals: Totals,
): { scripts: ScriptInfo[]; stylesheets: StylesheetInfo[] } {
  const base = doc.baseURI || pageUrl;
  const page = safeUrl(pageUrl, pageUrl);
  const crossOrigin = (src: string | null): boolean | null => {
    if (src === null) return null;
    const u = safeUrl(src, base);
    return u ? !sameHost(u, page) : null;
  };

  const scriptEls = Array.from(doc.querySelectorAll('script')).filter((s) => {
    const type = (s.getAttribute('type') ?? '').trim().toLowerCase();
    return type === '' || /javascript|ecmascript|^module$/.test(type);
  });
  totals.scripts = scriptEls.length;
  if (scriptEls.length > LIMITS.scripts) t.mark('scripts');
  const scripts = scriptEls.slice(0, LIMITS.scripts).map((s) => {
    const src = s.getAttribute('src');
    return {
      src: src === null ? null : clip(src, LIMITS.attrChars, t, 'scripts.src'),
      inline: src === null,
      async: s.hasAttribute('async'),
      defer: s.hasAttribute('defer'),
      module: (s.getAttribute('type') ?? '').trim().toLowerCase() === 'module',
      crossOrigin: crossOrigin(src),
    };
  });

  const sheetEls = Array.from(doc.querySelectorAll('link,style')).filter(
    (el) => el.tagName === 'STYLE' || relTokens(el.getAttribute('rel')).includes('stylesheet'),
  );
  totals.stylesheets = sheetEls.length;
  if (sheetEls.length > LIMITS.stylesheets) t.mark('stylesheets');
  const stylesheets = sheetEls.slice(0, LIMITS.stylesheets).map((el) => {
    const href = el.tagName === 'LINK' ? el.getAttribute('href') : null;
    return {
      href: href === null ? null : clip(href, LIMITS.attrChars, t, 'stylesheets.href'),
      inline: el.tagName === 'STYLE',
      media: el.getAttribute('media'),
      crossOrigin: crossOrigin(href),
    };
  });
  return { scripts, stylesheets };
}

function extractResources(doc: Document, t: Truncations): ResourcesInfo {
  const perf = doc.defaultView?.performance;
  if (!perf || typeof perf.getEntriesByType !== 'function') {
    return { available: false, total: 0, entries: [], sizeInaccessibleCount: 0, navigation: null };
  }
  let raw: PerformanceResourceTiming[];
  try {
    raw = perf.getEntriesByType('resource') as PerformanceResourceTiming[];
  } catch {
    return { available: false, total: 0, entries: [], sizeInaccessibleCount: 0, navigation: null };
  }
  let inaccessible = 0;
  const all = raw.map((e) => {
    // Browsers report all three sizes as 0 for cross-origin resources without Timing-Allow-Origin.
    const hidden = e.transferSize === 0 && e.encodedBodySize === 0 && e.decodedBodySize === 0;
    if (hidden) inaccessible++;
    return {
      name: clip(e.name, LIMITS.attrChars, t, 'resources.name'),
      initiatorType: e.initiatorType,
      transferSize: hidden ? null : e.transferSize,
      encodedBodySize: hidden ? null : e.encodedBodySize,
      duration: Math.round(e.duration),
    };
  });
  if (all.length > LIMITS.resources) t.mark('resources');

  let navigation: ResourcesInfo['navigation'] = null;
  try {
    const nav = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      navigation = {
        type: nav.type ?? null,
        domContentLoadedMs:
          nav.domContentLoadedEventEnd > 0 ? Math.round(nav.domContentLoadedEventEnd) : null,
        loadMs: nav.loadEventEnd > 0 ? Math.round(nav.loadEventEnd) : null,
      };
    }
  } catch {
    navigation = null;
  }
  return {
    available: true,
    total: all.length,
    entries: all.slice(0, LIMITS.resources),
    sizeInaccessibleCount: inaccessible,
    navigation,
  };
}

const PUBLISHED_RE = /publish|created|posted/i;
const MODIFIED_RE = /modif|updated|edited/i;

function dateKind(s: string): DateSignal['kind'] {
  if (MODIFIED_RE.test(s)) return 'modified';
  if (PUBLISHED_RE.test(s)) return 'published';
  return 'unspecified';
}

function extractSignals(
  doc: Document,
  head: HeadInfo,
  tel: string[],
  mailto: string[],
  t: Truncations,
) {
  const authors: AuthorSignal[] = [];
  const addAuthor = (source: AuthorSignal['source'], raw: string | null | undefined) => {
    const text = clip(norm(raw), 100);
    if (text === '' || authors.some((a) => a.source === source && a.text === text)) return;
    if (authors.length >= LIMITS.authors) {
      t.mark('signals.authors');
      return;
    }
    authors.push({ source, text });
  };
  for (const m of head.metas) if (m.name === 'author') addAuthor('meta', m.content);
  for (const el of Array.from(doc.querySelectorAll('a[rel],link[rel]'))) {
    if (relTokens(el.getAttribute('rel')).includes('author')) {
      addAuthor('rel-author', el.textContent || el.getAttribute('href'));
    }
  }
  for (const el of Array.from(doc.querySelectorAll('[itemprop~="author"]'))) {
    const name = el.querySelector('[itemprop~="name"]');
    addAuthor('itemprop', name ? name.textContent : (el.getAttribute('content') ?? el.textContent));
  }
  for (const el of Array.from(doc.querySelectorAll('[class]'))) {
    if (/(^|[\s_-])(author|byline)([\s_-]|$)/i.test(el.getAttribute('class') ?? '')) {
      addAuthor('byline-class', el.textContent);
    }
  }

  const dates: DateSignal[] = [];
  const addDate = (d: DateSignal) => {
    if (d.value.trim() === '') return;
    if (dates.length >= LIMITS.dates) {
      t.mark('signals.dates');
      return;
    }
    dates.push({ ...d, value: clip(d.value.trim(), 100) });
  };
  for (const m of head.metas) {
    const key = m.property ?? m.name;
    if (!key || m.content === null || m.itemprop) continue;
    if (
      /^(article:)?(published_time|modified_time)$|^og:updated_time$|^(dc|dcterms)\.(date|created|modified)$|^(date|pubdate|last-modified)$/i.test(
        key,
      )
    ) {
      addDate({ source: 'meta', kind: dateKind(key), value: m.content });
    }
  }
  for (const el of Array.from(
    doc.querySelectorAll('[itemprop~="datePublished"],[itemprop~="dateModified"]'),
  )) {
    const prop = el.getAttribute('itemprop') ?? '';
    addDate({
      source: 'itemprop',
      kind: /dateModified/.test(prop) ? 'modified' : 'published',
      value: el.getAttribute('content') ?? el.getAttribute('datetime') ?? norm(el.textContent),
    });
  }
  for (const el of Array.from(doc.querySelectorAll('time'))) {
    if (/datePublished|dateModified/.test(el.getAttribute('itemprop') ?? '')) continue;
    addDate({
      source: 'time',
      kind: dateKind(`${el.getAttribute('class') ?? ''} ${el.getAttribute('itemprop') ?? ''}`),
      value: el.getAttribute('datetime') ?? norm(el.textContent),
    });
  }

  const addressEls = Array.from(doc.querySelectorAll('address'));
  if (addressEls.length > LIMITS.addresses) t.mark('signals.addresses');
  const addresses = addressEls
    .slice(0, LIMITS.addresses)
    .map((a) => clip(norm(a.textContent), 300, t, 'signals.addresses'))
    .filter((a) => a !== '');

  const quoteEls = Array.from(doc.querySelectorAll('blockquote'));
  if (quoteEls.length > LIMITS.citations) t.mark('signals.citations');
  const blockquotes = quoteEls.slice(0, LIMITS.citations).map((q) => ({
    cite: q.getAttribute('cite'),
    text: clip(norm(q.textContent), LIMITS.textChars, t, 'signals.citations'),
  }));

  return {
    authors,
    dates,
    addresses,
    telLinks: tel,
    mailtoLinks: mailto,
    citations: { blockquotes, citeElements: doc.querySelectorAll('cite').length },
  };
}

function countBodyWords(doc: Document): number {
  const body = doc.body;
  if (!body) return 0;
  const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const walker = doc.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */);
  let words = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = n.parentElement;
    if (parent && skip.has(parent.tagName)) continue;
    words += countWords(n.textContent ?? '');
  }
  return words;
}

/** Synchronous DOM part of the extraction (no network). */
export function extractDom(doc: Document, now: Date = new Date()) {
  const t = new Truncations();
  const url = doc.location?.href ?? '';
  const totals: Totals = {
    headings: 0,
    paragraphs: 0,
    lists: 0,
    tables: 0,
    images: 0,
    links: 0,
    scripts: 0,
    stylesheets: 0,
  };
  const head = extractHead(doc, url, t);
  const content = extractContent(doc, t, totals);
  const faq = extractFaq(doc, t);
  const images = extractImages(doc, url, t, totals);
  const linkData = extractLinks(doc, url, t, totals);
  const assets = extractAssets(doc, url, t, totals);

  return {
    t,
    snapshot: {
      schemaVersion: 1 as const,
      url,
      capturedAt: now.toISOString(),
      contentType: doc.contentType ?? null,
      title: head.title,
      head,
      ...content,
      faqBlocks: faq.blocks,
      faqContainerHints: faq.hints,
      images,
      links: linkData.links,
      ...assets,
      domNodeCount: doc.getElementsByTagName('*').length,
      htmlSizeApprox: doc.documentElement.outerHTML.length,
      bodyWordCount: countBodyWords(doc),
      resources: extractResources(doc, t),
      structuredData: {
        jsonld: extractJsonLd(doc, t),
        microdata: extractItems(doc, 'microdata', t),
        rdfa: extractItems(doc, 'rdfa', t),
      },
      signals: extractSignals(doc, head, linkData.tel, linkData.mailto, t),
      totals,
    },
  };
}

export async function extractSnapshot(
  doc: Document = document,
  options: ExtractOptions = {},
): Promise<PageSnapshot> {
  const { t, snapshot } = extractDom(doc, options.now?.() ?? new Date());
  const origin = safeUrl(snapshot.url, snapshot.url)?.origin ?? '';
  const isHttp = /^https?:\/\//i.test(origin);

  let net;
  if (options.skipNetwork) {
    net = networkUnavailable('network checks were skipped');
  } else if (!isHttp) {
    net = networkUnavailable('the page is not served over http(s)');
  } else {
    const fetchImpl = options.fetch ?? (globalThis.fetch.bind(globalThis) as unknown as FetchLike);
    const robotsTxt = await fetchRobotsTxt(origin, fetchImpl);
    const sitemap = await fetchSitemap(origin, robotsTxt, fetchImpl);
    net = { robots: robotsTxt, sitemap };
  }
  if (net.robots.bodyTruncated) t.mark('robotsTxt.body');

  return { ...snapshot, robotsTxt: net.robots, sitemap: net.sitemap, truncated: t.list() };
}

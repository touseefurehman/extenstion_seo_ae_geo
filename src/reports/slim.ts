import type { PageSnapshot } from '../types/snapshot';

const CAPS = {
  paragraphs: 200,
  paragraphChars: 300,
  links: 500,
  images: 200,
  scripts: 100,
  stylesheets: 100,
  resources: 100,
  headLinks: 50,
  robotsChars: 2000,
  lists: 60,
  listItems: 15,
  faq: 50,
};

/**
 * Reduces a snapshot for storage in a saved report. No page HTML is ever stored; this only trims
 * extracted lists and long texts. Real counts stay in `totals`, and clipped fields are added to `truncated`.
 */
export function slimSnapshot(s: PageSnapshot): PageSnapshot {
  const truncated = new Set(s.truncated);
  const cap = <T>(arr: T[], n: number, name: string): T[] => {
    if (arr.length > n) truncated.add(`report.${name}`);
    return arr.slice(0, n);
  };
  const clip = (t: string, n: number, name: string) => {
    if (t.length > n) truncated.add(`report.${name}`);
    return t.length > n ? t.slice(0, n) : t;
  };
  const slim: PageSnapshot = {
    ...s,
    head: { ...s.head, links: cap(s.head.links, CAPS.headLinks, 'head.links') },
    paragraphs: cap(s.paragraphs, CAPS.paragraphs, 'paragraphs').map((p) => ({
      ...p,
      text: clip(p.text, CAPS.paragraphChars, 'paragraphs.text'),
    })),
    lists: cap(s.lists, CAPS.lists, 'lists').map((l) => ({
      ...l,
      items: cap(l.items, CAPS.listItems, 'lists.items'),
    })),
    faqBlocks: cap(s.faqBlocks, CAPS.faq, 'faqBlocks'),
    images: cap(s.images, CAPS.images, 'images'),
    links: cap(s.links, CAPS.links, 'links'),
    scripts: cap(s.scripts, CAPS.scripts, 'scripts'),
    stylesheets: cap(s.stylesheets, CAPS.stylesheets, 'stylesheets'),
    resources: { ...s.resources, entries: cap(s.resources.entries, CAPS.resources, 'resources') },
    robotsTxt: {
      ...s.robotsTxt,
      body:
        s.robotsTxt.body === null
          ? null
          : clip(s.robotsTxt.body, CAPS.robotsChars, 'robotsTxt.body'),
    },
    // raw JSON-LD text is kept once in report.schema.rawJsonLd; the parsed value stays for entity lookups
    structuredData: {
      ...s.structuredData,
      jsonld: s.structuredData.jsonld.map((b) => ({ ...b, raw: '' })),
    },
  };
  slim.truncated = [...truncated].sort();
  return slim;
}

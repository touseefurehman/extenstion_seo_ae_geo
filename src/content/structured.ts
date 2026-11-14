import type { JsonLdBlock, StructuredItem } from '../types/snapshot';
import { LIMITS } from './limits';
import { clip, norm, Truncations } from './text';

export function extractJsonLd(doc: Document, t: Truncations): JsonLdBlock[] {
  const scripts = Array.from(doc.querySelectorAll('script')).filter(
    (s) => (s.getAttribute('type') ?? '').trim().toLowerCase() === 'application/ld+json',
  );
  if (scripts.length > LIMITS.jsonld) t.mark('structuredData.jsonld');
  return scripts.slice(0, LIMITS.jsonld).map((script, index) => {
    const text = script.textContent ?? '';
    const tooLarge = text.length > LIMITS.jsonldRawChars;
    let parsed: unknown = null;
    let error: string | null = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    if (tooLarge) {
      t.mark('structuredData.jsonld.raw');
      parsed = null; // keep the snapshot small; the syntax result above is still reported
    }
    return {
      index,
      raw: clip(text, LIMITS.jsonldRawChars),
      rawTruncated: tooLarge,
      parsed,
      error,
      tooLarge,
    };
  });
}

function microdataValue(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === 'meta') return el.getAttribute('content') ?? '';
  if (tag === 'a' || tag === 'link' || tag === 'area') return el.getAttribute('href') ?? '';
  if (['img', 'audio', 'video', 'source', 'embed', 'iframe', 'track'].includes(tag)) {
    return el.getAttribute('src') ?? '';
  }
  if (tag === 'time') return el.getAttribute('datetime') ?? norm(el.textContent);
  if (tag === 'data' || tag === 'meter') return el.getAttribute('value') ?? norm(el.textContent);
  if (tag === 'object') return el.getAttribute('data') ?? '';
  return norm(el.textContent);
}

function rdfaValue(el: Element): string {
  const content = el.getAttribute('content');
  if (content !== null) return content;
  const resource = el.getAttribute('resource') ?? el.getAttribute('href') ?? el.getAttribute('src');
  if (resource !== null) return resource;
  if (el.tagName.toLowerCase() === 'time')
    return el.getAttribute('datetime') ?? norm(el.textContent);
  return norm(el.textContent);
}

function tokens(value: string | null): string[] {
  return (value ?? '').split(/\s+/).filter(Boolean);
}

function buildItem(
  syntax: 'microdata' | 'rdfa',
  root: Element,
  depth: number,
  t: Truncations,
): StructuredItem {
  const scopeAttr = syntax === 'microdata' ? '[itemscope]' : '[typeof]';
  const propAttr = syntax === 'microdata' ? 'itemprop' : 'property';
  const props: StructuredItem['properties'] = [];
  for (const el of Array.from(root.querySelectorAll(`[${propAttr}]`))) {
    if (el.parentElement?.closest(scopeAttr) !== root) continue; // belongs to a nested item
    const names = tokens(el.getAttribute(propAttr));
    const isNested = el.matches(scopeAttr);
    let value: string | StructuredItem;
    if (isNested && depth >= LIMITS.nestDepth) {
      t.mark(`structuredData.${syntax}.depth`);
      value = '[nested item omitted: depth limit]';
    } else if (isNested) {
      value = buildItem(syntax, el, depth + 1, t);
    } else {
      value = clip(
        syntax === 'microdata' ? microdataValue(el) : rdfaValue(el),
        LIMITS.metaChars,
        t,
        `structuredData.${syntax}.value`,
      );
    }
    for (const name of names) props.push({ name, value });
  }
  return {
    syntax,
    types:
      syntax === 'microdata'
        ? tokens(root.getAttribute('itemtype'))
        : tokens(root.getAttribute('typeof')),
    id: syntax === 'microdata' ? root.getAttribute('itemid') : root.getAttribute('about'),
    properties: props,
  };
}

/** Top-level items only; nested items appear as property values. */
export function extractItems(
  doc: Document,
  syntax: 'microdata' | 'rdfa',
  t: Truncations,
): StructuredItem[] {
  const scopeAttr = syntax === 'microdata' ? '[itemscope]' : '[typeof]';
  const propAttr = syntax === 'microdata' ? 'itemprop' : 'property';
  const roots = Array.from(doc.querySelectorAll(scopeAttr)).filter(
    (el) => el.parentElement?.closest(scopeAttr) == null && !el.hasAttribute(propAttr),
  );
  if (roots.length > LIMITS.structuredItems) t.mark(`structuredData.${syntax}`);
  return roots.slice(0, LIMITS.structuredItems).map((root) => buildItem(syntax, root, 0, t));
}

import type { PageSnapshot, StructuredItem } from '../../types/snapshot';

export type SchemaSyntax = 'jsonld' | 'microdata' | 'rdfa';

/** One typed node from any syntax, flattened with a parent pointer so the tree can be rebuilt. */
export interface SchemaEntity {
  index: number;
  parent: number | null;
  depth: number;
  syntax: SchemaSyntax;
  blockIndex: number;
  /** Short type names (the schema.org prefix removed). */
  types: string[];
  node: Record<string, unknown>;
}

export function shortType(t: string): string {
  const cut = t.split(/[/#:]/).filter(Boolean).pop();
  return cut ?? t;
}

function typesOf(node: Record<string, unknown>): string[] {
  const t = node['@type'];
  const list = Array.isArray(t) ? t : typeof t === 'string' ? [t] : [];
  return list.filter((x): x is string => typeof x === 'string').map(shortType);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Converts a Microdata/RDFa item into the same JSON-LD-like object shape. */
export function itemToNode(item: StructuredItem): Record<string, unknown> {
  const node: Record<string, unknown> = { '@type': item.types.map(shortType) };
  if (item.id) node['@id'] = item.id;
  for (const p of item.properties) {
    const value = typeof p.value === 'string' ? p.value : itemToNode(p.value);
    const prev = node[p.name];
    node[p.name] =
      prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
  }
  return node;
}

/** Flattens JSON-LD (handling @graph, arrays and nesting), Microdata and RDFa into one entity list. */
export function collectEntities(s: PageSnapshot): SchemaEntity[] {
  const out: SchemaEntity[] = [];

  const walk = (
    value: unknown,
    parent: number | null,
    depth: number,
    syntax: SchemaSyntax,
    blockIndex: number,
  ): void => {
    if (Array.isArray(value)) {
      for (const v of value) walk(v, parent, depth, syntax, blockIndex);
      return;
    }
    if (!isObject(value)) return;
    let nextParent = parent;
    let nextDepth = depth;
    const types = typesOf(value);
    if (types.length > 0) {
      const entity: SchemaEntity = {
        index: out.length,
        parent,
        depth,
        syntax,
        blockIndex,
        types,
        node: value,
      };
      out.push(entity);
      nextParent = entity.index;
      nextDepth = depth + 1;
    }
    for (const [key, v] of Object.entries(value)) {
      if (key === '@context' || key === '@type' || key === '@id') continue;
      walk(v, nextParent, nextDepth, syntax, blockIndex);
    }
  };

  for (const block of s.structuredData.jsonld) {
    if (block.error === null && block.parsed !== null)
      walk(block.parsed, null, 0, 'jsonld', block.index);
  }
  s.structuredData.microdata.forEach((item, i) => walk(itemToNode(item), null, 0, 'microdata', i));
  s.structuredData.rdfa.forEach((item, i) => walk(itemToNode(item), null, 0, 'rdfa', i));
  return out;
}

export function entitiesOfType(entities: SchemaEntity[], ...names: string[]): SchemaEntity[] {
  return entities.filter((e) => e.types.some((t) => names.includes(t)));
}

/** Best-effort plain text of a schema value (string, {name}, {@value}, array...). */
export function valueText(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) {
    for (const x of v) {
      const t = valueText(x);
      if (t) return t;
    }
    return null;
  }
  if (isObject(v)) {
    for (const k of ['name', '@value', 'text', 'url', '@id']) {
      const t = valueText(v[k]);
      if (t) return t;
    }
  }
  return null;
}

export function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.some(hasValue);
  if (isObject(v)) return Object.keys(v).some((k) => k !== '@context') && Object.keys(v).length > 0;
  return true;
}

export function valuesOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : v === undefined ? [] : [v];
}

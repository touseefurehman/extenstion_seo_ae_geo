import type { PageSnapshot } from '../../types/snapshot';
import { collectEntities, hasValue, valueText, type SchemaSyntax } from './normalize';
import { findTypeDef } from './types';

export interface InspectedProperty {
  name: string;
  /** Short text preview of the value; nested objects show their type. */
  preview: string;
  nested: boolean;
  level: 'recommended' | 'optional' | 'other';
}

export interface InspectedEntity {
  index: number;
  parent: number | null;
  depth: number;
  syntax: SchemaSyntax;
  blockIndex: number;
  types: string[];
  /** The type definition used for property checks, if any. */
  matchedType: string | null;
  properties: InspectedProperty[];
  /** Recommended properties (not mandatory) that are absent. */
  missingRecommended: string[];
  missingRequired: string[];
}

export interface SchemaBlockStatus {
  index: number;
  valid: boolean;
  error: string | null;
  entityCount: number;
}

export interface SchemaReport {
  counts: {
    jsonld: number;
    microdata: number;
    rdfa: number;
    entities: number;
    invalidBlocks: number;
  };
  blocks: SchemaBlockStatus[];
  entities: InspectedEntity[];
  /** Raw JSON-LD text per block, for the raw viewer. */
  rawJsonLd: { index: number; raw: string; truncated: boolean; error: string | null }[];
}

function preview(v: unknown): { text: string; nested: boolean } {
  if (Array.isArray(v)) {
    const first = v[0];
    const inner = preview(first);
    return {
      text: v.length > 1 ? `${inner.text} (+${v.length - 1} more)` : inner.text,
      nested: inner.nested,
    };
  }
  if (typeof v === 'object' && v !== null) {
    const t = (v as Record<string, unknown>)['@type'];
    const type = Array.isArray(t) ? t.join(', ') : typeof t === 'string' ? t : null;
    return { text: type ? `[${type}]` : (valueText(v) ?? '{…}'), nested: type !== null };
  }
  const text = valueText(v) ?? '';
  return { text: text.length > 120 ? `${text.slice(0, 120)}…` : text, nested: false };
}

/** Builds the schema inspector data. Never throws on malformed input. */
export function inspectSchema(s: PageSnapshot): SchemaReport {
  const entities = collectEntities(s);
  const inspected: InspectedEntity[] = entities.map((e) => {
    const def = e.types.map((t) => findTypeDef(t)).find((d) => d !== null) ?? null;
    const props: InspectedProperty[] = Object.entries(e.node)
      .filter(([k, v]) => !k.startsWith('@') && hasValue(v))
      .map(([name, v]) => {
        const p = preview(v);
        return {
          name,
          preview: p.text,
          nested: p.nested,
          level: def?.recommended.includes(name)
            ? 'recommended'
            : def?.optional.includes(name)
              ? 'optional'
              : 'other',
        };
      });
    const present = new Set(props.map((p) => p.name));
    return {
      index: e.index,
      parent: e.parent,
      depth: e.depth,
      syntax: e.syntax,
      blockIndex: e.blockIndex,
      types: e.types,
      matchedType: def?.name ?? null,
      properties: props,
      missingRecommended: def ? def.recommended.filter((p) => !present.has(p)) : [],
      missingRequired: def ? def.required.filter((p) => !present.has(p)) : [],
    };
  });

  const blocks = s.structuredData.jsonld.map((b) => ({
    index: b.index,
    valid: b.error === null,
    error: b.error,
    entityCount: entities.filter((e) => e.syntax === 'jsonld' && e.blockIndex === b.index).length,
  }));
  return {
    counts: {
      jsonld: s.structuredData.jsonld.length,
      microdata: s.structuredData.microdata.length,
      rdfa: s.structuredData.rdfa.length,
      entities: inspected.length,
      invalidBlocks: blocks.filter((b) => !b.valid).length,
    },
    blocks,
    entities: inspected,
    rawJsonLd: s.structuredData.jsonld.map((b) => ({
      index: b.index,
      raw: b.raw,
      truncated: b.rawTruncated,
      error: b.error,
    })),
  };
}

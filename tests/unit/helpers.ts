import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Window } from 'happy-dom';
import type { FetchLike } from '../../src/content/network';
import { extractSnapshot } from '../../src/content/extractor';
import { buildReport } from '../../src/reports/build';
import type { StorageArea } from '../../src/storage/history';
import type { AuditReport } from '../../src/types/report';

export const FIXTURE_DIR = resolve(import.meta.dirname, '../fixtures');

export interface MockResponse {
  status: number;
  contentType?: string;
  body?: string;
}

export interface Expected {
  url: string;
  network?: Record<string, MockResponse>;
  snapshot?: Record<string, unknown>;
  snapshotNotNull?: string[];
  snapshotIncludes?: Record<string, unknown[]>;
  checks: Record<string, string>;
}

export function loadExpected(name: string): Expected {
  return JSON.parse(
    readFileSync(resolve(FIXTURE_DIR, `${name}.expected.json`), 'utf8'),
  ) as Expected;
}

/** Parses HTML into an isolated happy-dom document at the given URL (scripts are not executed). */
export function makeDocument(html: string, url: string): Document {
  const window = new Window({
    url,
    settings: {
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      disableIframePageLoading: true,
    },
  });
  window.document.write(html);
  return window.document as unknown as Document;
}

export function loadFixtureDocument(name: string, url: string): Document {
  return makeDocument(readFileSync(resolve(FIXTURE_DIR, `${name}.html`), 'utf8'), url);
}

/** Stub fetch keyed by pathname; unknown paths answer 404. */
export function mockFetch(routes: Record<string, MockResponse> = {}): FetchLike {
  return async (url) => {
    const u = new URL(url);
    const route = routes[u.pathname] ?? {
      status: 404,
      contentType: 'text/html',
      body: 'Not found',
    };
    return {
      status: route.status,
      url,
      headers: {
        get: (n) => (n.toLowerCase() === 'content-type' ? (route.contentType ?? null) : null),
      },
      text: async () => route.body ?? '',
    };
  };
}

export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function fakeArea(opts: { quotaBytes?: number } = {}) {
  const data = new Map<string, unknown>();
  const used = () => [...data.values()].reduce<number>((n, v) => n + JSON.stringify(v).length, 0);
  const area: StorageArea = {
    get: async (keys) => {
      const list = keys === null ? [...data.keys()] : Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        list.filter((k) => data.has(k)).map((k) => [k, structuredClone(data.get(k))]),
      );
    },
    set: async (items) => {
      const before = new Map(data);
      for (const [k, v] of Object.entries(items)) data.set(k, structuredClone(v));
      if (opts.quotaBytes && used() > opts.quotaBytes) {
        data.clear();
        before.forEach((v, k) => data.set(k, v));
        throw new Error('QUOTA_BYTES quota exceeded');
      }
    },
    remove: async (keys) => {
      for (const k of Array.isArray(keys) ? keys : [keys]) data.delete(k);
    },
  };
  return { area, data };
}

let reportCounter = 0;
/** Extracts a fixture and builds a real report from it. */
export async function fixtureReport(
  name: string,
  over: { id?: string; createdAt?: Date } = {},
): Promise<AuditReport> {
  const exp = loadExpected(name);
  const snap = await extractSnapshot(loadFixtureDocument(name, exp.url), {
    fetch: mockFetch(exp.network),
  });
  return buildReport(snap, {
    id: over.id ?? `fx-${name}-${++reportCounter}`,
    now: () => over.createdAt ?? new Date(Date.UTC(2026, 0, 1, 0, 0, reportCounter)),
  });
}

import type { Category } from '../types/check';
import type { AuditReport } from '../types/report';

/** The subset of chrome.storage.StorageArea used here (injectable for tests). */
export interface StorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export const INDEX_KEY = 'nexusrank:index';
export const REPORT_PREFIX = 'nexusrank:report:';
export const SCHEMA_VERSION = 1;
export const DEFAULTS = { historyCap: 50, maxBytes: 8_000_000 } as const;
export const LIMITS = { minCap: 1, maxCap: 500 } as const;

export interface HistorySettings {
  historyCap: number;
  /** Soft budget for stored report JSON; chrome.storage.local allows about 10 MB without unlimitedStorage. */
  maxBytes: number;
}

export interface HistoryEntry {
  id: string;
  url: string;
  title: string | null;
  createdAt: string;
  overall: number | null;
  categories: Record<Category, number | null>;
  bytes: number;
}

interface Index {
  version: typeof SCHEMA_VERSION;
  settings: HistorySettings;
  /** Newest first. */
  entries: HistoryEntry[];
}

export interface SaveResult {
  saved: AuditReport['id'];
  evicted: string[];
}

const emptyIndex = (): Index => ({
  version: SCHEMA_VERSION,
  settings: { ...DEFAULTS },
  entries: [],
});

function clampCap(n: number): number {
  return Math.min(LIMITS.maxCap, Math.max(LIMITS.minCap, Math.floor(n)));
}

/** Reads an index of any age. Unknown or corrupt data yields an empty index; it never throws. */
export function migrateIndex(raw: unknown): Index {
  if (typeof raw !== 'object' || raw === null) return emptyIndex();
  const r = raw as Partial<Index>;
  if (r.version !== SCHEMA_VERSION || !Array.isArray(r.entries)) return emptyIndex();
  const settings = {
    historyCap: clampCap(Number(r.settings?.historyCap ?? DEFAULTS.historyCap)),
    maxBytes: Math.max(100_000, Number(r.settings?.maxBytes ?? DEFAULTS.maxBytes)),
  };
  return {
    version: SCHEMA_VERSION,
    settings,
    entries: r.entries.filter((e) => typeof e?.id === 'string'),
  };
}

export function toEntry(report: AuditReport, bytes: number): HistoryEntry {
  return {
    id: report.id,
    url: report.url,
    title: report.title,
    createdAt: report.createdAt,
    overall: report.overall,
    categories: {
      technical: report.categories.technical.score,
      onpage: report.categories.onpage.score,
      aeo: report.categories.aeo.score,
      geo: report.categories.geo.score,
    },
    bytes,
  };
}

/**
 * Local audit history: reports only (never page HTML), one storage key per report plus a small
 * index. Operations are serialized so concurrent popups cannot corrupt the index.
 */
export function createHistory(area: StorageArea) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  const readIndex = async (): Promise<Index> =>
    migrateIndex((await area.get(INDEX_KEY))[INDEX_KEY]);
  const writeIndex = (index: Index) => area.set({ [INDEX_KEY]: index });

  /** Drops oldest entries until count and byte budgets hold (never the newest). */
  function trim(index: Index): string[] {
    const evicted: string[] = [];
    const over = () =>
      index.entries.length > index.settings.historyCap ||
      index.entries.reduce((n, e) => n + e.bytes, 0) > index.settings.maxBytes;
    while (index.entries.length > 1 && over()) {
      const old = index.entries.pop();
      if (old) evicted.push(old.id);
    }
    return evicted;
  }

  return {
    list: () => serial(async () => (await readIndex()).entries),

    getSettings: () => serial(async () => (await readIndex()).settings),

    get: (id: string) =>
      serial(async () => {
        const key = REPORT_PREFIX + id;
        const report = (await area.get(key))[key];
        return (report as AuditReport | undefined) ?? null;
      }),

    save: (report: AuditReport) =>
      serial(async (): Promise<SaveResult> => {
        const json = JSON.stringify(report);
        const index = await readIndex();
        index.entries = [
          toEntry(report, json.length),
          ...index.entries.filter((e) => e.id !== report.id),
        ];
        const evicted = trim(index);
        // Writing can still hit the browser quota: evict the oldest entries and retry.
        for (;;) {
          try {
            await area.set({ [REPORT_PREFIX + report.id]: report });
            await writeIndex(index);
            break;
          } catch (error) {
            const old = index.entries.length > 1 ? index.entries.pop() : undefined;
            if (!old) throw error;
            evicted.push(old.id);
            await area.remove(REPORT_PREFIX + old.id); // free the space before retrying
          }
        }
        if (evicted.length > 0) await area.remove(evicted.map((id) => REPORT_PREFIX + id)); // idempotent
        return { saved: report.id, evicted };
      }),

    remove: (id: string) =>
      serial(async () => {
        const index = await readIndex();
        index.entries = index.entries.filter((e) => e.id !== id);
        await writeIndex(index);
        await area.remove(REPORT_PREFIX + id);
      }),

    clear: () =>
      serial(async () => {
        const index = await readIndex();
        await area.remove(index.entries.map((e) => REPORT_PREFIX + e.id));
        await writeIndex({ ...index, entries: [] });
      }),

    setHistoryCap: (cap: number) =>
      serial(async () => {
        const index = await readIndex();
        index.settings.historyCap = clampCap(cap);
        const evicted = trim(index);
        await writeIndex(index);
        if (evicted.length > 0) await area.remove(evicted.map((id) => REPORT_PREFIX + id));
        return index.settings.historyCap;
      }),
  };
}

export type History = ReturnType<typeof createHistory>;

/** History backed by chrome.storage.local (extension contexts only). */
export function chromeHistory(): History {
  return createHistory(chrome.storage.local as unknown as StorageArea);
}

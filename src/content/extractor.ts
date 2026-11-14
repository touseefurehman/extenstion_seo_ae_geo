import type { PageSnapshot } from '../types/snapshot';

/**
 * The only module that reads the live page DOM.
 * Phase 1: page identity only. Phase 2 builds out the full extraction.
 */
export function extractSnapshot(doc: Document = document): PageSnapshot {
  const title = doc.title.trim();
  return {
    schemaVersion: 1,
    url: doc.location?.href ?? '',
    title: title === '' ? null : title,
    capturedAt: new Date().toISOString(),
  };
}

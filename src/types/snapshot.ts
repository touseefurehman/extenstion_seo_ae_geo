/**
 * PageSnapshot: plain, JSON-serializable data extracted from the live page.
 * Phase 1 carries only the page identity; Phase 2 extends it with the full DOM extraction.
 */
export interface PageSnapshot {
  schemaVersion: 1;
  /** Page URL at capture time. */
  url: string;
  title: string | null;
  /** ISO timestamp. */
  capturedAt: string;
}

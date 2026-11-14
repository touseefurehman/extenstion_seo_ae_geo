import type { PageSnapshot } from './snapshot';

export type AnalyzeErrorCode = 'unsupported_page' | 'no_tab' | 'injection_failed' | 'no_result';

export interface AnalyzeRequest {
  type: 'nexusrank:analyze';
  tabId: number;
}

export type AnalyzeResponse =
  { ok: true; snapshot: PageSnapshot } | { ok: false; code: AnalyzeErrorCode; message: string };

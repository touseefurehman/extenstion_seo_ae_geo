import type { AuditReport } from './report';

export type AnalyzeErrorCode =
  'unsupported_page' | 'no_tab' | 'injection_failed' | 'no_result' | 'analysis_failed';

export interface AnalyzeRequest {
  type: 'nexusrank:analyze';
  tabId: number;
}

export type AnalyzeResponse =
  | { ok: true; report: AuditReport; saved: boolean; saveError?: string }
  | { ok: false; code: AnalyzeErrorCode; message: string };

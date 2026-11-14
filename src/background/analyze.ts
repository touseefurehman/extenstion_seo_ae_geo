import { buildReport } from '../reports/build';
import { chromeHistory } from '../storage/history';
import type { AnalyzeResponse } from '../types/messages';
import type { AuditReport } from '../types/report';
import type { PageSnapshot } from '../types/snapshot';
import { checkPageSupport } from '../utils/pageSupport';

/** The subset of chrome.* used here, injectable so it can be unit tested. */
export interface AnalyzeDeps {
  getTab(tabId: number): Promise<{ id?: number; url?: string } | undefined>;
  executeContentScript(tabId: number): Promise<unknown>;
  saveReport(report: AuditReport): Promise<void>;
}

function isSnapshot(value: unknown): value is PageSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { schemaVersion?: unknown }).schemaVersion === 1 &&
    typeof (value as { url?: unknown }).url === 'string'
  );
}

/** Injects the content script into a tab, then analyzes, scores and stores the result locally. */
export async function analyzeTab(tabId: number, deps: AnalyzeDeps): Promise<AnalyzeResponse> {
  let tab;
  try {
    tab = await deps.getTab(tabId);
  } catch {
    return { ok: false, code: 'no_tab', message: 'That tab is no longer available.' };
  }
  if (!tab) {
    return { ok: false, code: 'no_tab', message: 'That tab is no longer available.' };
  }
  const support = checkPageSupport(tab.url);
  if (!support.supported) {
    return { ok: false, code: 'unsupported_page', message: support.reason };
  }
  let result: unknown;
  try {
    result = await deps.executeContentScript(tabId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      code: 'injection_failed',
      message: `NexusRank could not read this page. ${detail}`,
    };
  }
  if (!isSnapshot(result)) {
    return {
      ok: false,
      code: 'no_result',
      message: 'The page did not return any data. Reload the tab and try again.',
    };
  }
  let report: AuditReport;
  try {
    report = buildReport(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      code: 'analysis_failed',
      message: `The analysis failed unexpectedly. ${detail}`,
    };
  }
  try {
    await deps.saveReport(report);
    return { ok: true, report, saved: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: true, report, saved: false, saveError: detail };
  }
}

export const chromeDeps: AnalyzeDeps = {
  getTab: (tabId) => chrome.tabs.get(tabId),
  executeContentScript: async (tabId) => {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
    return results[0]?.result;
  },
  saveReport: async (report) => {
    await chromeHistory().save(report);
  },
};

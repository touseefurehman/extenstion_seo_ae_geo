import { useCallback, useEffect, useState } from 'react';
import { LayoutDashboard, Loader2, RotateCw, ScanSearch, TriangleAlert } from 'lucide-react';
import { ScoreBar } from '../components/ScoreBar';
import { ScoreRing } from '../components/ScoreRing';
import type { AnalyzeRequest, AnalyzeResponse } from '../types/messages';
import type { AuditReport } from '../types/report';
import { topIssues, titleOf } from '../utils/issues';
import { CATEGORIES, CATEGORY_LABELS } from '../utils/labels';
import { checkPageSupport } from '../utils/pageSupport';

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; report: AuditReport; saved: boolean; saveError?: string }
  | { phase: 'error'; message: string };

interface TabInfo {
  id?: number;
  url?: string;
}

/** The tab to analyze: `?tabId=` when given (used by the dashboard and tests), else the active tab. */
async function resolveTab(): Promise<TabInfo> {
  const param = new URLSearchParams(window.location.search).get('tabId');
  if (param !== null && /^\d+$/.test(param)) {
    try {
      return await chrome.tabs.get(Number(param));
    } catch {
      return {};
    }
  }
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  return active ?? {};
}

export function Popup() {
  const [tab, setTab] = useState<TabInfo | null>(null);
  const [state, setState] = useState<State>({ phase: 'idle' });

  useEffect(() => {
    resolveTab().then(setTab);
  }, []);

  const analyze = useCallback(async () => {
    if (tab?.id === undefined) {
      setState({ phase: 'error', message: 'No active tab was found.' });
      return;
    }
    setState({ phase: 'loading' });
    const request: AnalyzeRequest = { type: 'nexusrank:analyze', tabId: tab.id };
    try {
      const response = (await chrome.runtime.sendMessage(request)) as AnalyzeResponse | undefined;
      if (!response) {
        setState({ phase: 'error', message: 'The extension did not respond. Try again.' });
      } else if (response.ok) {
        setState({
          phase: 'done',
          report: response.report,
          saved: response.saved,
          ...(response.saveError ? { saveError: response.saveError } : {}),
        });
      } else {
        setState({ phase: 'error', message: response.message });
      }
    } catch (error) {
      setState({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Analysis failed.',
      });
    }
  }, [tab]);

  const openDashboard = useCallback((reportId: string) => {
    const url = chrome.runtime.getURL(
      `dashboard/dashboard.html?report=${encodeURIComponent(reportId)}`,
    );
    void chrome.tabs.create({ url });
  }, []);

  const support = tab ? checkPageSupport(tab.url) : null;
  const loading = state.phase === 'loading';
  const report = state.phase === 'done' ? state.report : null;
  const issues = report ? topIssues(report.checks, 3) : [];

  return (
    <main className="nr-popup">
      <header className="d-flex align-items-center justify-content-between mb-2">
        <h1 className="h5 mb-0">NexusRank</h1>
        <span className="nr-muted small">by WebsNexus</span>
      </header>

      <div className="nr-card mb-3">
        <div className="nr-muted small">Current page</div>
        <div className="nr-url">{report?.url ?? tab?.url ?? 'Loading…'}</div>
      </div>

      {support && !support.supported && (
        <div className="nr-card mb-3 d-flex gap-2" role="status">
          <TriangleAlert size={18} aria-hidden />
          <div>
            <strong>Can&rsquo;t analyze this page.</strong>
            <div className="nr-muted small">{support.reason}</div>
          </div>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="nr-card mb-3 nr-card-error" role="alert">
          <strong>Analysis failed.</strong>
          <div className="nr-muted small">{state.message}</div>
        </div>
      )}

      {report && (
        <section aria-label="Results" className="mb-3">
          <div className="nr-card mb-3 d-flex align-items-center gap-3">
            <ScoreRing score={report.overall} label="Overall score" />
            <div>
              <div className="fw-semibold">Overall score</div>
              <div className="nr-muted small">
                {report.summary.criticalIssues} critical · {report.summary.warnings} warnings ·{' '}
                {report.summary.passed} passed
              </div>
              <div className="nr-muted small">
                Local, lightweight indicators — not search rankings.
              </div>
            </div>
          </div>
          <div className="nr-card mb-3">
            {CATEGORIES.map((c) => (
              <ScoreBar key={c} label={CATEGORY_LABELS[c]} score={report.categories[c].score} />
            ))}
          </div>
          <div className="nr-card">
            <div className="fw-semibold mb-1">Top issues</div>
            {issues.length === 0 ? (
              <div className="nr-muted small">No warnings or failures found.</div>
            ) : (
              <ol className="nr-issues">
                {issues.map((c) => (
                  <li key={c.id}>
                    <span
                      className={`nr-dot nr-bg-${c.status === 'failed' ? 'bad' : 'ok'}`}
                      aria-hidden
                    />
                    <div>
                      <div>{titleOf(c)}</div>
                      <div className="nr-muted small">{c.recommendation}</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {state.phase === 'done' && !state.saved && (
            <div className="nr-muted small mt-2" role="status">
              The report could not be saved to history ({state.saveError}), so the dashboard is
              unavailable for it.
            </div>
          )}
        </section>
      )}

      <div className="d-flex gap-2">
        <button
          type="button"
          className="nr-btn-primary flex-fill d-flex align-items-center justify-content-center gap-2"
          onClick={analyze}
          disabled={loading || !support?.supported}
        >
          {loading ? (
            <Loader2 size={16} className="spin" aria-hidden />
          ) : state.phase === 'idle' ? (
            <ScanSearch size={16} aria-hidden />
          ) : (
            <RotateCw size={16} aria-hidden />
          )}
          {loading ? 'Analyzing…' : state.phase === 'idle' ? 'Analyze page' : 'Re-analyze'}
        </button>
        {report && (
          <button
            type="button"
            className="nr-btn-secondary d-flex align-items-center justify-content-center gap-2"
            onClick={() => openDashboard(report.id)}
            disabled={state.phase === 'done' && !state.saved}
          >
            <LayoutDashboard size={16} aria-hidden />
            Open dashboard
          </button>
        )}
      </div>
    </main>
  );
}

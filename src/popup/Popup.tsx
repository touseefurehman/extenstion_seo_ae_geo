import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCw, ScanSearch, TriangleAlert } from 'lucide-react';
import type { AnalyzeRequest, AnalyzeResponse } from '../types/messages';
import type { PageSnapshot } from '../types/snapshot';
import { checkPageSupport } from '../utils/pageSupport';

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; snapshot: PageSnapshot }
  | { phase: 'error'; message: string };

export function Popup() {
  const [tab, setTab] = useState<{ id?: number; url?: string } | null>(null);
  const [state, setState] = useState<State>({ phase: 'idle' });

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([active]) => {
      setTab(active ?? {});
    });
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
        console.info('NexusRank snapshot', response.snapshot);
        setState({ phase: 'done', snapshot: response.snapshot });
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

  const support = tab ? checkPageSupport(tab.url) : null;
  const loading = state.phase === 'loading';

  return (
    <main className="nr-popup">
      <h1 className="h5 mb-1">NexusRank</h1>
      <p className="nr-muted small mb-3">SEO, AEO &amp; GEO analysis, entirely on your device.</p>

      <div className="nr-card mb-3">
        <div className="nr-muted small">Current page</div>
        <div className="nr-url">{tab?.url ?? 'Loading…'}</div>
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
        <div className="nr-card mb-3" role="alert" style={{ borderColor: 'var(--nr-danger)' }}>
          <strong>Analysis failed.</strong>
          <div className="nr-muted small">{state.message}</div>
        </div>
      )}

      {state.phase === 'done' && (
        <div className="nr-card mb-3" role="status">
          <div className="nr-muted small">Snapshot captured</div>
          <div>{state.snapshot.title ?? '(no title)'}</div>
          <div className="nr-muted small">{state.snapshot.capturedAt}</div>
        </div>
      )}

      <button
        type="button"
        className="nr-btn-primary w-100 d-flex align-items-center justify-content-center gap-2"
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
    </main>
  );
}

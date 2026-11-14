import {
  BarChart3,
  Binary,
  Bot,
  FileDown,
  GitCompare,
  History as HistoryIcon,
  LayoutDashboard,
  Link2,
  ListTree,
  Network,
  ScanSearch,
  Settings2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistoryData } from '../hooks/useHistoryData';
import { chromeHistory, type History } from '../storage/history';
import type { AuditReport } from '../types/report';
import { Aeo } from './sections/Aeo';
import { Compare } from './sections/Compare';
import { ContentStructure } from './sections/ContentStructure';
import { Geo } from './sections/Geo';
import { HistorySection } from './sections/History';
import { Links } from './sections/Links';
import { OnPage, Technical } from './sections/Checks';
import { Overview } from './sections/Overview';
import { Reports } from './sections/Reports';
import { SchemaInspector } from './sections/SchemaInspector';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, needsReport: true },
  { id: 'technical', label: 'Technical SEO', icon: Settings2, needsReport: true },
  { id: 'onpage', label: 'On-page', icon: ScanSearch, needsReport: true },
  { id: 'aeo', label: 'AEO Intelligence', icon: Bot, needsReport: true },
  { id: 'geo', label: 'GEO Intelligence', icon: Network, needsReport: true },
  { id: 'schema', label: 'Schema Inspector', icon: Binary, needsReport: true },
  { id: 'structure', label: 'Content Structure', icon: ListTree, needsReport: true },
  { id: 'links', label: 'Links', icon: Link2, needsReport: true },
  { id: 'history', label: 'History', icon: HistoryIcon, needsReport: false },
  { id: 'compare', label: 'Compare', icon: GitCompare, needsReport: false },
  { id: 'reports', label: 'Reports', icon: FileDown, needsReport: true },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

function initialSection(): SectionId {
  const h = window.location.hash.replace('#', '');
  return (SECTIONS.find((s) => s.id === h)?.id ?? 'overview') as SectionId;
}

export function App({ history }: { history?: History }) {
  const store = useMemo(() => history ?? chromeHistory(), [history]);
  const data = useHistoryData(store);
  const [section, setSection] = useState<SectionId>(initialSection);
  const [reportId, setReportId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('report'),
  );
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Default to the newest saved report once the list is known.
  const effectiveId = reportId ?? data.entries[0]?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!effectiveId) {
        setReport(null);
        return;
      }
      try {
        const r = await store.get(effectiveId);
        if (cancelled) return;
        setReport(r);
        setLoadError(r ? null : 'That report was not found. It may have been deleted.');
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load the report.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveId, store]);

  const go = useCallback((id: SectionId) => {
    setSection(id);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#${id}`,
    );
  }, []);

  const open = useCallback((id: string) => {
    setReportId(id);
    const params = new URLSearchParams(window.location.search);
    params.set('report', id);
    window.history.replaceState(null, '', `${window.location.pathname}?${params}#overview`);
    setSection('overview');
  }, []);

  const onDelete = async (id: string) => {
    await store.remove(id);
    if (id === effectiveId) setReportId(null);
    await data.reload();
  };
  const onClear = async () => {
    await store.clear();
    setReportId(null);
    await data.reload();
  };
  const onCap = async (cap: number) => {
    await store.setHistoryCap(cap);
    await data.reload();
  };

  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const needsReportButMissing = current.needsReport && !report;

  const body = (() => {
    if (data.loading)
      return (
        <div className="nr-muted" role="status">
          Loading…
        </div>
      );
    if (data.error)
      return (
        <div className="nr-card nr-card-error" role="alert">
          Could not read history: {data.error}
        </div>
      );
    if (section === 'history')
      return (
        <HistorySection
          entries={data.entries}
          settings={data.settings}
          selectedId={effectiveId}
          onOpen={open}
          onDelete={onDelete}
          onClear={onClear}
          onCap={onCap}
        />
      );
    if (section === 'compare') return <Compare entries={data.entries} history={store} />;
    if (needsReportButMissing) {
      return (
        <div className="nr-card nr-empty" role="status">
          {loadError ??
            (data.entries.length === 0
              ? 'No audit yet. Open a web page, click the NexusRank icon, then choose “Analyze page”. The report will appear here.'
              : 'Loading report…')}
        </div>
      );
    }
    if (!report) return null;
    switch (section) {
      case 'overview':
        return <Overview report={report} />;
      case 'technical':
        return <Technical report={report} />;
      case 'onpage':
        return <OnPage report={report} />;
      case 'aeo':
        return <Aeo report={report} />;
      case 'geo':
        return <Geo report={report} />;
      case 'schema':
        return <SchemaInspector report={report} />;
      case 'structure':
        return <ContentStructure report={report} />;
      case 'links':
        return <Links report={report} />;
      case 'reports':
        return <Reports report={report} />;
      default:
        return null;
    }
  })();

  return (
    <div className="nr-app">
      <aside className="nr-sidebar">
        <div className="nr-brand">
          <BarChart3 size={22} aria-hidden /> <span>NexusRank</span>
        </div>
        <nav aria-label="Dashboard sections">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                className={`nr-nav${section === s.id ? ' active' : ''}`}
                aria-current={section === s.id ? 'page' : undefined}
                onClick={() => go(s.id)}
              >
                <Icon size={16} aria-hidden /> {s.label}
              </button>
            );
          })}
        </nav>
        <div className="nr-sidebar-foot nr-muted small">
          Local analysis. Nothing leaves your browser.
        </div>
      </aside>
      <main className="nr-main" id="nr-main">
        {report && section !== 'history' && section !== 'compare' && (
          <div className="nr-context nr-muted small" title={report.url}>
            Report for <span className="nr-url">{report.url}</span>
          </div>
        )}
        {body}
      </main>
    </div>
  );
}

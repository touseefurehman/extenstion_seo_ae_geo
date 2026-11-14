import { FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import { toCsv } from '../../reports/csv';
import { reportFileName, toJson } from '../../reports/json';
import { buildPdf } from '../../reports/pdf';
import type { AuditReport } from '../../types/report';
import { downloadBlob, downloadText } from '../../utils/download';
import { LIMITATION_NOTE, Panel, Section } from './common';

export function Reports({ report }: { report: AuditReport }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const run = async (label: string, fn: () => void | Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage({ kind: 'ok', text: `${label} downloaded.` });
    } catch (e) {
      setMessage({
        kind: 'error',
        text: `${label} export failed: ${e instanceof Error ? e.message : String(e)}`,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Reports"
      subtitle="Export this audit. Files are created in your browser; nothing is uploaded."
    >
      <div className="row g-3 mb-3">
        <div className="col-md-4">
          <div className="nr-card h-100">
            <h3 className="h6">
              <FileText size={16} aria-hidden /> PDF report
            </h3>
            <p className="nr-muted small">
              Multi-page summary with scores, recommendations, every check with evidence, and the
              limitations disclaimer.
            </p>
            <button
              type="button"
              className="nr-btn-primary"
              disabled={busy}
              onClick={() =>
                run('PDF', async () =>
                  downloadBlob(await buildPdf(report), reportFileName(report, 'pdf')),
                )
              }
            >
              Export PDF
            </button>
          </div>
        </div>
        <div className="col-md-4">
          <div className="nr-card h-100">
            <h3 className="h6">
              <FileSpreadsheet size={16} aria-hidden /> CSV
            </h3>
            <p className="nr-muted small">
              One row per check: ID, category, severity, status, weight, explanation, recommendation
              and evidence.
            </p>
            <button
              type="button"
              className="nr-btn-primary"
              disabled={busy}
              onClick={() =>
                run('CSV', () =>
                  downloadText(toCsv(report), 'text/csv', reportFileName(report, 'csv'), true),
                )
              }
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="col-md-4">
          <div className="nr-card h-100">
            <h3 className="h6">
              <FileJson size={16} aria-hidden /> JSON
            </h3>
            <p className="nr-muted small">
              The complete audit report, including scores and the score breakdown, for your own
              tooling.
            </p>
            <button
              type="button"
              className="nr-btn-primary"
              disabled={busy}
              onClick={() =>
                run('JSON', () =>
                  downloadText(toJson(report), 'application/json', reportFileName(report, 'json')),
                )
              }
            >
              Export JSON
            </button>
          </div>
        </div>
      </div>
      <div
        aria-live="polite"
        role="status"
        className={message?.kind === 'error' ? 'nr-error-text' : 'nr-muted'}
      >
        {message?.text}
      </div>
      <Panel title="Limitations">
        <p className="mb-0 nr-muted">{LIMITATION_NOTE}</p>
      </Panel>
    </Section>
  );
}

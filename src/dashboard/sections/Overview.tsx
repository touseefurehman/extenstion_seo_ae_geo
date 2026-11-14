import { ScoreRing } from '../../components/ScoreRing';
import { StatusBar } from '../../components/Charts';
import { SerpPreview } from '../../components/Previews';
import { StatusBadge } from '../../components/Badges';
import type { AuditReport } from '../../types/report';
import { titleOf, topIssues } from '../../utils/issues';
import { CATEGORIES, CATEGORY_LABELS } from '../../utils/labels';
import { LIMITATION_NOTE, Panel, Section, Stat } from './common';

export function Overview({ report }: { report: AuditReport }) {
  const issues = topIssues(report.checks, 6);
  const byId = new Map(report.checks.map((c) => [c.id, c]));
  return (
    <Section title="Overview" subtitle="Summary of the analyzed page.">
      <div className="nr-card mb-3">
        <div className="nr-muted small">Website URL</div>
        <div className="nr-url mb-2">{report.url}</div>
        <div className="nr-muted small">Page title</div>
        <div>{report.title ?? <span className="nr-muted">(no title)</span>}</div>
        <div className="nr-muted small mt-2">
          Analyzed {new Date(report.createdAt).toLocaleString()}
        </div>
      </div>

      <div className="nr-grid-scores mb-3">
        <div className="nr-card nr-score-main">
          <ScoreRing score={report.overall} size={132} label="Overall score" />
          <div className="fw-semibold mt-2">Overall score</div>
        </div>
        {CATEGORIES.map((c) => (
          <div key={c} className="nr-card nr-score-cat">
            <ScoreRing score={report.categories[c].score} size={84} label={CATEGORY_LABELS[c]} />
            <div className="fw-semibold mt-2">{CATEGORY_LABELS[c]}</div>
            <div className="nr-muted small">
              {report.categories[c].applicableChecks} scored checks
            </div>
          </div>
        ))}
      </div>

      <div className="nr-grid-stats mb-3">
        <Stat
          label="Critical issues"
          value={report.summary.criticalIssues}
          hint="Failed checks of critical or high severity"
        />
        <Stat label="Warnings" value={report.summary.warnings} />
        <Stat label="Passed checks" value={report.summary.passed} />
        <Stat
          label="Not tested / N/A"
          value={report.summary.byStatus.not_tested + report.summary.byStatus.not_applicable}
          hint="Excluded from scores"
        />
      </div>

      <Panel title="Check results">
        <StatusBar counts={report.summary.byStatus} />
      </Panel>

      <Panel title="Top recommendations">
        {issues.length === 0 ? (
          <div className="nr-muted">No warnings or failed checks.</div>
        ) : (
          <ol className="nr-reco">
            {issues.map((c) => (
              <li key={c.id}>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <strong>{titleOf(c)}</strong> <StatusBadge status={c.status} />
                </div>
                <div className="nr-muted">{c.recommendation}</div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <SerpPreview page={report.page} />

      <Panel
        title="How the scores are calculated"
        note={`Each category score = Σ(weight × severity multiplier × status value) ÷ Σ(weight × severity multiplier) over applicable checks. Passed = ${report.breakdown.config.statusValues.passed}, warning = ${report.breakdown.config.statusValues.warning}, failed = ${report.breakdown.config.statusValues.failed}. Not applicable and not tested checks are excluded.`}
      >
        <table className="nr-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Share of overall</th>
              <th>Score</th>
              <th>Scored checks</th>
              <th>Excluded</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => {
              const b = report.breakdown.categories[c];
              const part = report.breakdown.overall.parts.find((p) => p.category === c);
              return (
                <tr key={c}>
                  <td>{CATEGORY_LABELS[c]}</td>
                  <td>{part ? `${Math.round(part.normalizedWeight * 1000) / 10}%` : 'left out'}</td>
                  <td>{b.score ?? 'n/a'}</td>
                  <td>{b.applicableChecks}</td>
                  <td>
                    {b.excluded.not_applicable} N/A, {b.excluded.not_tested} not tested
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {CATEGORIES.map((c) => (
          <details key={c} className="mt-2">
            <summary>{CATEGORY_LABELS[c]}: contributions</summary>
            <table className="nr-table nr-table-sm">
              <thead>
                <tr>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Weight × severity</th>
                  <th>Credit</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {report.breakdown.categories[c].contributions.map((x) => (
                  <tr key={x.id}>
                    <td>{byId.get(x.id) ? titleOf(byId.get(x.id)!) : x.id}</td>
                    <td>{x.status}</td>
                    <td>
                      {x.weight} × {x.severityMultiplier} = {x.effectiveWeight}
                    </td>
                    <td>{x.statusValue}</td>
                    <td>{x.points.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="nr-muted small">
              {report.breakdown.categories[c].earnedPoints.toFixed(2)} ÷{' '}
              {report.breakdown.categories[c].totalEffectiveWeight.toFixed(2)}
            </div>
          </details>
        ))}
      </Panel>
      <p className="nr-muted small">{LIMITATION_NOTE}</p>
    </Section>
  );
}

import { CheckList } from '../../components/CheckList';
import { Histogram } from '../../components/Charts';
import { detectQuestions } from '../../analyzers/aeo/aeo';
import type { AuditReport } from '../../types/report';
import { titleOf } from '../../utils/issues';
import { Empty, Panel, Section } from './common';

export function Aeo({ report }: { report: AuditReport }) {
  const page = report.page;
  const checks = report.checks.filter((c) => c.category === 'aeo');
  const questions = detectQuestions(page);
  const faqSchema = report.schema.entities.filter((e) => e.types.includes('FAQPage'));
  const words = page.paragraphs.map((p) => p.wordCount);
  const avg = words.length ? Math.round(words.reduce((a, b) => a + b, 0) / words.length) : 0;
  const lists = page.lists.filter((l) => l.itemCount >= 3);
  const missing = checks.filter((c) => c.status === 'warning' || c.status === 'failed');

  return (
    <Section
      title="AEO Intelligence"
      subtitle="Answer Engine Optimization: how easy the page is to read, quote and answer from. Based on on-page signals only."
    >
      <div className="row g-3">
        <div className="col-lg-6">
          <Panel
            title={`Questions detected (${questions.length})`}
            note="Detecting a question does not mean any search or answer engine will select the page."
          >
            {questions.length === 0 ? (
              <Empty>No question-style headings or sentences were found.</Empty>
            ) : (
              <ul className="nr-list">
                {questions.slice(0, 20).map((q, i) => (
                  <li key={i}>
                    <span className="nr-tag">{q.source}</span> {q.text}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title="FAQ structures">
            <dl className="nr-dl">
              <dt>FAQ blocks</dt>
              <dd>{page.faqBlocks.length}</dd>
              <dt>FAQ containers</dt>
              <dd>{page.faqContainerHints.join(', ') || 'none'}</dd>
              <dt>FAQPage schema</dt>
              <dd>{faqSchema.length > 0 ? `${faqSchema.length} found` : 'not found'}</dd>
            </dl>
            {page.faqBlocks.slice(0, 6).map((f, i) => (
              <details key={i}>
                <summary>{f.question}</summary>
                <div className="nr-muted">{f.answer || '(no answer text)'}</div>
              </details>
            ))}
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title="Content organization">
            <dl className="nr-dl">
              <dt>Lists (3+ items)</dt>
              <dd>{lists.length}</dd>
              <dt>Tables</dt>
              <dd>{page.totals.tables}</dd>
              <dt>Paragraphs</dt>
              <dd>{page.totals.paragraphs}</dd>
              <dt>Average paragraph length</dt>
              <dd>{avg} words</dd>
            </dl>
            {words.length > 0 && (
              <Histogram
                title="Paragraph length distribution (words)"
                values={words}
                buckets={[
                  { label: '≤20', max: 20 },
                  { label: '21-40', max: 40 },
                  { label: '41-60', max: 60 },
                  { label: '61-120', max: 120 },
                  { label: '>120', max: Infinity },
                ]}
              />
            )}
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title="Missing opportunities">
            {missing.length === 0 ? (
              <Empty>No AEO warnings or failures.</Empty>
            ) : (
              <ul className="nr-list">
                {missing.map((c) => (
                  <li key={c.id}>
                    <strong>{titleOf(c)}:</strong> {c.recommendation}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
      <h3 className="h6 mt-2">All AEO checks</h3>
      <CheckList checks={checks} />
    </Section>
  );
}

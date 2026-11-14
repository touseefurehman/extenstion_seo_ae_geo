import { Histogram } from '../../components/Charts';
import { detectQuestions } from '../../analyzers/aeo/aeo';
import type { AuditReport } from '../../types/report';
import { Empty, Panel, Section } from './common';

export function ContentStructure({ report }: { report: AuditReport }) {
  const page = report.page;
  const questions = detectQuestions(page);
  const words = page.paragraphs.map((p) => p.wordCount);
  const longest = [...page.paragraphs].sort((a, b) => b.wordCount - a.wordCount).slice(0, 5);
  const truncatedHeadings = page.totals.headings > page.headings.length;

  return (
    <Section
      title="Content Structure"
      subtitle="Heading outline, paragraphs, questions, lists and tables."
    >
      <Panel
        title={`Heading tree (${page.totals.headings})`}
        note={
          truncatedHeadings
            ? `Showing the first ${page.headings.length} of ${page.totals.headings} headings.`
            : undefined
        }
      >
        {page.headings.length === 0 ? (
          <Empty>The page has no headings.</Empty>
        ) : (
          <ul className="nr-tree" aria-label="Heading tree">
            {page.headings.map((h, i) => {
              const before = page.headings[i - 1];
              const skipped = before !== undefined && h.level > before.level + 1;
              return (
                <li key={h.order} style={{ paddingLeft: (h.level - 1) * 18 }}>
                  <span className="nr-tag">H{h.level}</span>{' '}
                  {h.empty ? <em className="nr-muted">(empty heading)</em> : h.text}
                  {skipped && (
                    <span className="nr-badge nr-status-warning ms-2">skipped level</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="row g-3">
        <div className="col-lg-6">
          <Panel
            title="Paragraph analysis"
            note={
              page.totals.paragraphs > page.paragraphs.length
                ? `Based on the first ${page.paragraphs.length} of ${page.totals.paragraphs} paragraphs.`
                : undefined
            }
          >
            {words.length === 0 ? (
              <Empty>No paragraphs found.</Empty>
            ) : (
              <>
                <dl className="nr-dl">
                  <dt>Paragraphs</dt>
                  <dd>{page.totals.paragraphs}</dd>
                  <dt>Words in body</dt>
                  <dd>{page.bodyWordCount}</dd>
                  <dt>Average length</dt>
                  <dd>{Math.round(words.reduce((a, b) => a + b, 0) / words.length)} words</dd>
                </dl>
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
                <div className="small fw-semibold mt-2">Longest paragraphs</div>
                <ul className="nr-list">
                  {longest.map((p, i) => (
                    <li key={i}>
                      {p.wordCount} words — {p.text.slice(0, 110)}
                      {p.text.length > 110 ? '…' : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title={`Questions (${questions.length})`}>
            {questions.length === 0 ? (
              <Empty>No questions detected.</Empty>
            ) : (
              <ul className="nr-list">
                {questions.slice(0, 15).map((q, i) => (
                  <li key={i}>
                    <span className="nr-tag">{q.source}</span> {q.text}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title={`Lists (${page.totals.lists})`}>
            {page.lists.length === 0 ? (
              <Empty>No lists.</Empty>
            ) : (
              <ul className="nr-list">
                {page.lists.slice(0, 10).map((l, i) => (
                  <li key={i}>
                    {l.ordered ? 'Ordered' : 'Unordered'}, {l.itemCount} items:{' '}
                    {l.items.slice(0, 3).join(' · ')}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="col-lg-6">
          <Panel title={`Tables (${page.totals.tables})`}>
            {page.tables.length === 0 ? (
              <Empty>No tables.</Empty>
            ) : (
              <ul className="nr-list">
                {page.tables.slice(0, 10).map((t, i) => (
                  <li key={i}>
                    {t.rows} rows × {t.cols} columns ·{' '}
                    {t.hasHeader ? 'has header cells' : 'no header cells'}
                    {t.caption ? ` · “${t.caption}”` : ''}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </Section>
  );
}

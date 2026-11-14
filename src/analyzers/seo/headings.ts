import { THRESHOLDS } from '../../scoring/config';
import type { CheckResult } from '../../types/check';
import type { PageSnapshot } from '../../types/snapshot';
import { check, ev, notApplicable, OK, partialNote } from '../common';

export function analyzeHeadings(s: PageSnapshot): CheckResult[] {
  const out: CheckResult[] = [];
  const partial = partialNote(s.totals.headings, s.headings.length);
  const h1s = s.headings.filter((h) => h.level === 1);
  const filled = h1s.filter((h) => !h.empty);
  const required = THRESHOLDS.headings.requiredH1Count;

  if (filled.length === required) {
    out.push(
      check('seo.h1.single', 'passed', {
        evidence: [ev('H1', filled[0]?.text ?? ''), ...partial],
        explanation: 'The page has exactly one H1 heading.',
        recommendation: OK,
      }),
    );
  } else if (filled.length === 0) {
    out.push(
      check('seo.h1.single', 'failed', {
        evidence: [ev('H1 elements', h1s.length), ev('Non-empty H1 elements', 0), ...partial],
        explanation: 'No H1 with text was found. The H1 is the main on-page heading.',
        recommendation: 'Add one descriptive H1 that states the page topic.',
      }),
    );
  } else {
    out.push(
      check('seo.h1.single', 'warning', {
        evidence: [...filled.map((h, i) => ev(`H1 #${i + 1}`, h.text)), ...partial],
        explanation: `${filled.length} H1 headings were found. Multiple H1s are valid HTML but make the main topic less clear.`,
        recommendation: 'Use one H1 for the main topic and H2-H6 for sections.',
      }),
    );
  }

  if (s.headings.length === 0) {
    out.push(notApplicable('seo.headings.hierarchy', 'the page has no headings.'));
    out.push(notApplicable('seo.headings.empty', 'the page has no headings.'));
    return out;
  }

  const ignored = THRESHOLDS.headings.hierarchyIgnoredRegions;
  const seq = s.headings.filter((h) => !ignored.includes(h.region));
  const jumps: string[] = [];
  for (let i = 1; i < seq.length; i++) {
    const prev = seq[i - 1]!;
    const cur = seq[i]!;
    if (cur.level > prev.level + 1) jumps.push(`H${prev.level} → H${cur.level} ("${cur.text}")`);
  }
  out.push(
    jumps.length === 0
      ? check('seo.headings.hierarchy', 'passed', {
          evidence: [ev('Headings analyzed', seq.length), ...partial],
          explanation: 'Heading levels never skip a level going down the page.',
          recommendation: OK,
        })
      : check('seo.headings.hierarchy', 'warning', {
          evidence: [...jumps.map((j, i) => ev(`Skipped level #${i + 1}`, j)), ...partial],
          explanation:
            'Some headings skip a level, which weakens the outline for assistive technology and parsers.',
          recommendation: 'Nest headings without skipping levels (H2 → H3, not H2 → H4).',
        }),
  );

  const empties = s.headings.filter((h) => h.empty);
  out.push(
    empties.length === 0
      ? check('seo.headings.empty', 'passed', {
          evidence: [ev('Headings', s.headings.length), ...partial],
          explanation: 'No empty headings were found.',
          recommendation: OK,
        })
      : check('seo.headings.empty', 'warning', {
          evidence: empties.map((h) =>
            ev(`Empty H${h.level}`, `heading #${h.order + 1} in page order`),
          ),
          explanation: 'Empty headings add noise to the page outline.',
          recommendation: 'Remove the empty heading or give it text.',
        }),
  );
  return out;
}

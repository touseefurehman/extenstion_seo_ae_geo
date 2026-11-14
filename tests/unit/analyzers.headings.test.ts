import { describe, expect, it } from 'vitest';
import { analyzeHeadings } from '../../src/analyzers/seo/headings';
import { blank, heading, statusOf } from './snapshotFactory';

const snap = (hs: ReturnType<typeof heading>[], totals = hs.length) =>
  blank({ headings: hs, totals: { ...blank().totals, headings: totals } });

describe('analyzeHeadings', () => {
  const cases: [string, ReturnType<typeof snap>, string, string][] = [
    ['single h1', snap([heading(1, 'A', 0)]), 'seo.h1.single', 'passed'],
    ['no headings: h1 fails', snap([]), 'seo.h1.single', 'failed'],
    ['only h2: h1 fails', snap([heading(2, 'A', 0)]), 'seo.h1.single', 'failed'],
    ['empty h1 counts as missing', snap([heading(1, '', 0)]), 'seo.h1.single', 'failed'],
    ['two h1', snap([heading(1, 'A', 0), heading(1, 'B', 1)]), 'seo.h1.single', 'warning'],
    [
      'clean hierarchy',
      snap([heading(1, 'A', 0), heading(2, 'B', 1), heading(3, 'C', 2), heading(2, 'D', 3)]),
      'seo.headings.hierarchy',
      'passed',
    ],
    [
      'skipped level',
      snap([heading(1, 'A', 0), heading(3, 'C', 1)]),
      'seo.headings.hierarchy',
      'warning',
    ],
    [
      'going back up is fine',
      snap([heading(1, 'A', 0), heading(2, 'B', 1), heading(3, 'C', 2), heading(1, 'D', 3)]),
      'seo.headings.hierarchy',
      'passed',
    ],
    [
      'footer headings are ignored',
      snap([heading(1, 'A', 0), heading(4, 'Follow', 1, { region: 'footer' })]),
      'seo.headings.hierarchy',
      'passed',
    ],
    ['hierarchy without headings', snap([]), 'seo.headings.hierarchy', 'not_applicable'],
    ['no empty headings', snap([heading(1, 'A', 0)]), 'seo.headings.empty', 'passed'],
    [
      'an empty heading',
      snap([heading(1, 'A', 0), heading(2, '', 1)]),
      'seo.headings.empty',
      'warning',
    ],
    ['empty check without headings', snap([]), 'seo.headings.empty', 'not_applicable'],
  ];
  it.each(cases)('%s', (_n, s, id, expected) => {
    expect(statusOf(analyzeHeadings(s), id)).toBe(expected);
  });

  it('reports the actual H1 text and skipped-level evidence', () => {
    const a = analyzeHeadings(snap([heading(1, 'Main', 0), heading(3, 'Deep', 1)]));
    expect(a.find((c) => c.id === 'seo.h1.single')?.evidence[0]?.value).toBe('Main');
    expect(a.find((c) => c.id === 'seo.headings.hierarchy')?.evidence[0]?.value).toContain(
      'H1 → H3 ("Deep")',
    );
  });

  it('flags partial analysis when the snapshot was capped', () => {
    const a = analyzeHeadings(snap([heading(1, 'A', 0)], 900));
    expect(JSON.stringify(a.find((c) => c.id === 'seo.h1.single')?.evidence)).toContain(
      'Only the first 1 of 900',
    );
  });
});

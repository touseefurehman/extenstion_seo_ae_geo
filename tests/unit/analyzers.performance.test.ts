import { describe, expect, it } from 'vitest';
import { analyzePerformance } from '../../src/analyzers/seo/performance';
import { blank, statusOf } from './snapshotFactory';

const entry = (size: number | null) => ({
  name: 'https://example.com/a.js',
  initiatorType: 'script',
  transferSize: size,
  encodedBodySize: size,
  duration: 5,
});
const res = (entries: ReturnType<typeof entry>[], available = true) => ({
  available,
  total: entries.length,
  entries,
  sizeInaccessibleCount: entries.filter((e) => e.transferSize === null).length,
  navigation: null,
});

describe('analyzePerformance', () => {
  const cases: [string, ReturnType<typeof blank>, string, string][] = [
    ['dom small', blank({ domNodeCount: 1500 }), 'perf.dom.size', 'passed'],
    ['dom large', blank({ domNodeCount: 1501 }), 'perf.dom.size', 'warning'],
    ['dom huge', blank({ domNodeCount: 3001 }), 'perf.dom.size', 'failed'],
    ['html small', blank({ htmlSizeApprox: 300_000 }), 'perf.html.size', 'passed'],
    ['html large', blank({ htmlSizeApprox: 300_001 }), 'perf.html.size', 'warning'],
    ['html huge', blank({ htmlSizeApprox: 1_000_001 }), 'perf.html.size', 'failed'],
    [
      'scripts few',
      blank({ totals: { ...blank().totals, scripts: 20 } }),
      'perf.scripts.count',
      'passed',
    ],
    [
      'scripts many',
      blank({ totals: { ...blank().totals, scripts: 21 } }),
      'perf.scripts.count',
      'warning',
    ],
    [
      'scripts excessive',
      blank({ totals: { ...blank().totals, scripts: 41 } }),
      'perf.scripts.count',
      'failed',
    ],
    [
      'stylesheets few',
      blank({ totals: { ...blank().totals, stylesheets: 8 } }),
      'perf.stylesheets.count',
      'passed',
    ],
    [
      'stylesheets many',
      blank({ totals: { ...blank().totals, stylesheets: 9 } }),
      'perf.stylesheets.count',
      'warning',
    ],
    [
      'stylesheets excessive',
      blank({ totals: { ...blank().totals, stylesheets: 16 } }),
      'perf.stylesheets.count',
      'failed',
    ],
    [
      'resources: light',
      blank({ resources: res([entry(1000), entry(2000)]) }),
      'perf.resources.sizes',
      'passed',
    ],
    [
      'resources: heavy',
      blank({ resources: res([entry(2_500_000)]) }),
      'perf.resources.sizes',
      'warning',
    ],
    [
      'resources: very heavy',
      blank({ resources: res([entry(5_500_000)]) }),
      'perf.resources.sizes',
      'failed',
    ],
    [
      'resources: API unavailable',
      blank({ resources: res([], false) }),
      'perf.resources.sizes',
      'not_tested',
    ],
    [
      'resources: none recorded',
      blank({ resources: res([]) }),
      'perf.resources.sizes',
      'not_applicable',
    ],
    [
      'resources: sizes mostly withheld',
      blank({ resources: res([entry(null), entry(null), entry(100)]) }),
      'perf.resources.sizes',
      'not_tested',
    ],
  ];
  it.each(cases)('%s', (_n, s, id, expected) => {
    expect(statusOf(analyzePerformance(s), id)).toBe(expected);
  });

  it('never reports withheld sizes as zero and labels results as lightweight indicators', () => {
    const r = analyzePerformance(
      blank({ resources: res([entry(null), entry(1000), entry(2000)]) }),
    );
    const sizes = r.find((c) => c.id === 'perf.resources.sizes')!;
    expect(sizes.evidence.find((e) => e.label.startsWith('Resources with unreported'))?.value).toBe(
      1,
    );
    expect(sizes.explanation).toMatch(/lightweight/i);
    expect(r.find((c) => c.id === 'perf.dom.size')?.explanation).toMatch(
      /not a Lighthouse or Core Web Vitals/,
    );
  });
});

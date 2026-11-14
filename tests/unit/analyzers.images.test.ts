import { describe, expect, it } from 'vitest';
import { analyzeImagePerformance, analyzeImages } from '../../src/analyzers/seo/images';
import { blank, image, statusOf } from './snapshotFactory';

const withImages = (images: ReturnType<typeof image>[], over = {}) =>
  blank({ images, totals: { ...blank().totals, images: images.length }, ...over });

describe('analyzeImages', () => {
  const four = (alts: (string | null)[]) => withImages(alts.map((alt) => image({ alt })));
  const cases: [string, ReturnType<typeof withImages>, string, string][] = [
    ['no images: alt N/A', withImages([]), 'seo.images.alt', 'not_applicable'],
    ['no images: dimensions N/A', withImages([]), 'seo.images.dimensions', 'not_applicable'],
    ['no images: filename N/A', withImages([]), 'seo.images.filename', 'not_applicable'],
    ['all alt present', four(['a', 'b', 'c', 'd']), 'seo.images.alt', 'passed'],
    ['empty alt is decorative, not missing', four(['', '', 'c', 'd']), 'seo.images.alt', 'passed'],
    ['1 of 4 missing = 25% -> warning', four([null, 'b', 'c', 'd']), 'seo.images.alt', 'warning'],
    ['2 of 4 missing -> failed', four([null, null, 'c', 'd']), 'seo.images.alt', 'failed'],
    ['dimensions all set', withImages([image(), image()]), 'seo.images.dimensions', 'passed'],
    [
      'one of four without dimensions',
      withImages([image({ widthAttr: null }), image(), image(), image()]),
      'seo.images.dimensions',
      'warning',
    ],
    [
      'most without dimensions',
      withImages([image({ widthAttr: null }), image({ heightAttr: null }), image()]),
      'seo.images.dimensions',
      'failed',
    ],
    [
      'descriptive filenames',
      withImages([image({ filename: 'espresso-machine.jpg' })]),
      'seo.images.filename',
      'passed',
    ],
    [
      'one generic of three',
      withImages([
        image({ filename: 'IMG_0001.jpg' }),
        image({ filename: 'a-b.jpg' }),
        image({ filename: 'c-d.jpg' }),
      ]),
      'seo.images.filename',
      'warning',
    ],
    [
      'mostly generic',
      withImages([
        image({ filename: 'IMG_0001.jpg' }),
        image({ filename: 'DSC_22.JPG' }),
        image({ filename: 'a-b.jpg' }),
      ]),
      'seo.images.filename',
      'failed',
    ],
    [
      'data-URI images have no filename',
      withImages([image({ filename: null, isDataUri: true })]),
      'seo.images.filename',
      'not_applicable',
    ],
  ];
  it.each(cases)('%s', (_n, s, id, expected) => {
    expect(statusOf(analyzeImages(s), id)).toBe(expected);
  });

  it('lists the images that lack alt text', () => {
    const r = analyzeImages(four([null, 'b', 'c', 'd'])).find((c) => c.id === 'seo.images.alt')!;
    expect(r.evidence.map((e) => e.label)).toContain('Missing alt #1');
  });
});

describe('analyzeImagePerformance', () => {
  const lazy = (n: number, loading: string | null) =>
    Array.from({ length: n }, () => image({ loading }));
  const cases: [string, ReturnType<typeof withImages>, string, string][] = [
    ['few images', withImages(lazy(3, null)), 'perf.images.count', 'passed'],
    ['many images', withImages(lazy(61, null)), 'perf.images.count', 'warning'],
    ['far too many', withImages(lazy(151, null)), 'perf.images.count', 'failed'],
    ['lazy: too few candidates', withImages(lazy(2, null)), 'perf.images.lazy', 'not_applicable'],
    [
      'lazy: all lazy after first',
      withImages([image(), ...lazy(3, 'lazy')]),
      'perf.images.lazy',
      'passed',
    ],
    ['lazy: none lazy', withImages(lazy(4, null)), 'perf.images.lazy', 'warning'],
    ['large: no images', withImages([]), 'perf.images.large', 'not_applicable'],
  ];
  it.each(cases)('%s', (_n, s, id, expected) => {
    expect(statusOf(analyzeImagePerformance(s), id)).toBe(expected);
  });

  const res = (entries: { name: string; size: number | null }[], available = true) =>
    withImages([image()], {
      resources: {
        available,
        total: entries.length,
        sizeInaccessibleCount: entries.filter((e) => e.size === null).length,
        navigation: null,
        entries: entries.map((e) => ({
          name: e.name,
          initiatorType: 'img',
          transferSize: e.size,
          encodedBodySize: e.size,
          duration: 1,
        })),
      },
    });
  it('large images: passed / warning / not_tested (inaccessible) / not_tested (no API)', () => {
    expect(
      statusOf(analyzeImagePerformance(res([{ name: 'a.jpg', size: 1000 }])), 'perf.images.large'),
    ).toBe('passed');
    expect(
      statusOf(
        analyzeImagePerformance(res([{ name: 'a.jpg', size: 300_000 }])),
        'perf.images.large',
      ),
    ).toBe('warning');
    const hidden = analyzeImagePerformance(res([{ name: 'a.jpg', size: null }]));
    expect(statusOf(hidden, 'perf.images.large')).toBe('not_tested');
    expect(hidden.find((c) => c.id === 'perf.images.large')?.notTestedReason).toMatch(
      /Timing-Allow-Origin/,
    );
    expect(statusOf(analyzeImagePerformance(res([], false)), 'perf.images.large')).toBe(
      'not_tested',
    );
  });
});

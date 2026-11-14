import { THRESHOLDS } from '../../scoring/config';
import type { CheckResult } from '../../types/check';
import type { PageSnapshot } from '../../types/snapshot';
import { band, check, ev, notApplicable, notTested, OK, partialNote } from '../common';

const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`;

/** Image checks that belong to on-page SEO. */
export function analyzeImages(s: PageSnapshot): CheckResult[] {
  const out: CheckResult[] = [];
  const I = THRESHOLDS.images;
  const imgs = s.images;
  const partial = partialNote(s.totals.images, imgs.length);

  if (imgs.length === 0) {
    return [
      notApplicable('seo.images.alt', 'the page has no <img> elements.'),
      notApplicable('seo.images.dimensions', 'the page has no <img> elements.'),
      notApplicable('seo.images.filename', 'the page has no <img> elements.'),
    ];
  }

  // alt: absent = missing; alt="" is a valid way to mark a decorative image.
  const missing = imgs.filter((i) => i.alt === null);
  const emptyAlt = imgs.filter((i) => i.alt === '');
  const ratio = missing.length / imgs.length;
  const altStatus =
    missing.length === 0 ? 'passed' : ratio <= I.altMissingWarnRatio ? 'warning' : 'failed';
  out.push(
    check('seo.images.alt', altStatus, {
      evidence: [
        ev('Images', imgs.length),
        ev('Missing alt attribute', missing.length),
        ev('Empty alt (treated as decorative)', emptyAlt.length),
        ...missing.slice(0, 5).map((i, n) => ev(`Missing alt #${n + 1}`, i.src ?? '(no src)')),
        ...partial,
      ],
      explanation:
        missing.length === 0
          ? 'Every image has an alt attribute (empty alt is accepted for decorative images).'
          : `${missing.length} of ${imgs.length} images (${pct(missing.length, imgs.length)}) have no alt attribute, which hurts accessibility and image understanding.`,
      recommendation:
        missing.length === 0
          ? OK
          : 'Add descriptive alt text to meaningful images, and alt="" to purely decorative ones.',
    }),
  );

  // dimensions: width+height attributes reduce layout shift
  const noDims = imgs.filter((i) => i.widthAttr === null || i.heightAttr === null);
  const dimRatio = noDims.length / imgs.length;
  const dimStatus =
    noDims.length === 0 ? 'passed' : dimRatio <= I.dimensionsFailRatio ? 'warning' : 'failed';
  out.push(
    check('seo.images.dimensions', dimStatus, {
      evidence: [
        ev('Images without width and height attributes', noDims.length),
        ev('Images', imgs.length),
        ...partial,
      ],
      explanation:
        noDims.length === 0
          ? 'All images declare width and height, which lets the browser reserve space.'
          : 'Images without width/height attributes can cause layout shift while loading. This is an HTML-attribute check, not a measured layout-shift score.',
      recommendation:
        noDims.length === 0 ? OK : 'Add width and height attributes (or CSS aspect-ratio).',
    }),
  );

  // filenames
  const named = imgs.filter((i) => i.filename !== null);
  if (named.length === 0) {
    out.push(
      notApplicable(
        'seo.images.filename',
        'no image has a readable file name (inline or data images).',
      ),
    );
  } else {
    const generic = named.filter((i) => I.genericFilenamePattern.test(i.filename ?? ''));
    const r = generic.length / named.length;
    const status =
      generic.length === 0 ? 'passed' : r > I.genericFilenameFailRatio ? 'failed' : 'warning';
    out.push(
      check('seo.images.filename', status, {
        evidence: [
          ev('Images with generic file names', generic.length),
          ev('Images with file names', named.length),
          ...generic.slice(0, 5).map((i, n) => ev(`Generic name #${n + 1}`, i.filename)),
        ],
        explanation:
          generic.length === 0
            ? 'Image file names look descriptive.'
            : 'Camera or default file names (IMG_0001.jpg) carry no topic information.',
        recommendation:
          generic.length === 0 ? OK : 'Rename images with short, descriptive, hyphenated names.',
      }),
    );
  }
  return out;
}

/** Image-related performance indicators (technical category). */
export function analyzeImagePerformance(s: PageSnapshot): CheckResult[] {
  const out: CheckResult[] = [];
  const I = THRESHOLDS.images;
  const n = s.totals.images;

  out.push(
    check('perf.images.count', band(n, { warn: I.countWarn, fail: I.countFail }), {
      evidence: [ev('Images', n)],
      explanation: `The page contains ${n} <img> elements. This is a lightweight indicator, not a load-time measurement.`,
      recommendation: n > I.countWarn ? 'Consider fewer, smaller or lazier-loaded images.' : OK,
    }),
  );

  const candidates = s.images.slice(1); // the first image is assumed above the fold
  if (candidates.length < I.lazyMinCandidates) {
    out.push(
      notApplicable('perf.images.lazy', 'the page has too few images for lazy-loading to matter.'),
    );
  } else {
    const lazy = candidates.filter((i) => i.loading === 'lazy').length;
    const ok = lazy / candidates.length >= I.lazyMinRatio;
    out.push(
      check('perf.images.lazy', ok ? 'passed' : 'warning', {
        evidence: [
          ev('Images after the first', candidates.length),
          ev('With loading="lazy"', lazy),
        ],
        explanation: ok
          ? 'Most images below the first use native lazy-loading.'
          : 'Most images after the first do not use loading="lazy". Whether they are below the fold depends on layout, which is not measured.',
        recommendation: ok ? OK : 'Add loading="lazy" to images that start below the fold.',
      }),
    );
  }

  // large images: only measurable when the Performance API exposes sizes
  const r = s.resources;
  if (n === 0) {
    out.push(notApplicable('perf.images.large', 'the page has no images.'));
  } else if (!r.available) {
    out.push(notTested('perf.images.large', 'the Performance API was not available.'));
  } else {
    const imgEntries = r.entries.filter(
      (e) => e.initiatorType === 'img' || /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(e.name),
    );
    const known = imgEntries.filter((e) => e.transferSize !== null || e.encodedBodySize !== null);
    if (known.length === 0) {
      out.push(
        notTested(
          'perf.images.large',
          'no image reported a size (cross-origin images need Timing-Allow-Origin).',
        ),
      );
    } else {
      const big = known.filter(
        (e) => (e.encodedBodySize ?? e.transferSize ?? 0) > I.largeImageBytes,
      );
      out.push(
        check('perf.images.large', big.length === 0 ? 'passed' : 'warning', {
          evidence: [
            ev('Images with a known size', known.length),
            ev('Images with an unreported size', imgEntries.length - known.length),
            ...big
              .slice(0, 5)
              .map((e, i) =>
                ev(
                  `Large image #${i + 1}`,
                  `${e.name} (${e.encodedBodySize ?? e.transferSize} bytes)`,
                ),
              ),
          ],
          explanation:
            big.length === 0
              ? 'No image with a reported size exceeds the configured threshold. Images with unreported sizes were not measured.'
              : `${big.length} image(s) exceed ${I.largeImageBytes} bytes.`,
          recommendation:
            big.length === 0 ? OK : 'Compress or resize large images, or use modern formats.',
        }),
      );
    }
  }
  return out;
}

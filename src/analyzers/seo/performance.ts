import { THRESHOLDS } from '../../scoring/config';
import type { CheckResult } from '../../types/check';
import type { PageSnapshot } from '../../types/snapshot';
import { band, check, ev, notApplicable, notTested, OK } from '../common';

const NOTE =
  'This is a lightweight browser-side indicator, not a Lighthouse or Core Web Vitals result.';

/** Performance indicators. Image-specific ones live in images.ts. */
export function analyzePerformance(s: PageSnapshot): CheckResult[] {
  const P = THRESHOLDS.performance;
  const out: CheckResult[] = [];

  const dom = s.domNodeCount;
  const domStatus = band(dom, P.domNodes);
  out.push(
    check('perf.dom.size', domStatus, {
      evidence: [
        ev('DOM elements', dom),
        ev('Warn above', P.domNodes.warn),
        ev('Fail above', P.domNodes.fail),
      ],
      explanation: `${dom} DOM elements. Very large DOMs make rendering and scripting slower. ${NOTE}`,
      recommendation:
        domStatus === 'passed' ? OK : 'Reduce page complexity or paginate/virtualise long lists.',
    }),
  );

  const html = s.htmlSizeApprox;
  const htmlStatus = band(html, P.htmlChars);
  out.push(
    check('perf.html.size', htmlStatus, {
      evidence: [ev('Rendered HTML size, approx. (characters)', html)],
      explanation: `Approximate size of the rendered DOM serialised as HTML (not the transferred, compressed network size). ${NOTE}`,
      recommendation:
        htmlStatus === 'passed' ? OK : 'Trim inline scripts/styles and unused markup.',
    }),
  );

  const sc = s.totals.scripts;
  const scStatus = band(sc, P.scripts);
  out.push(
    check('perf.scripts.count', scStatus, {
      evidence: [
        ev('Script elements', sc),
        ev('Cross-origin scripts', s.scripts.filter((x) => x.crossOrigin === true).length),
        ev('Async/defer', s.scripts.filter((x) => x.async || x.defer || x.module).length),
      ],
      explanation: `${sc} executable <script> elements. ${NOTE}`,
      recommendation:
        scStatus === 'passed' ? OK : 'Remove unused scripts and bundle where possible.',
    }),
  );

  const st = s.totals.stylesheets;
  const stStatus = band(st, P.stylesheets);
  out.push(
    check('perf.stylesheets.count', stStatus, {
      evidence: [ev('Stylesheets (link + style)', st)],
      explanation: `${st} stylesheets. ${NOTE}`,
      recommendation: stStatus === 'passed' ? OK : 'Combine or inline critical CSS.',
    }),
  );

  // resource weight from the Performance API (sizes may be withheld)
  const r = s.resources;
  if (!r.available) {
    out.push(notTested('perf.resources.sizes', 'the Performance API was not available.'));
  } else if (r.total === 0) {
    out.push(notApplicable('perf.resources.sizes', 'no sub-resource requests were recorded.'));
  } else if (r.sizeInaccessibleCount / r.total > P.resourceInaccessibleMaxRatio) {
    out.push(
      notTested(
        'perf.resources.sizes',
        `${r.sizeInaccessibleCount} of ${r.total} resources did not report a size (cross-origin without Timing-Allow-Origin, or cached).`,
      ),
    );
  } else {
    const known = r.entries.reduce((sum, e) => sum + (e.transferSize ?? 0), 0);
    const status = band(known, P.knownResourceBytes);
    out.push(
      check('perf.resources.sizes', status, {
        evidence: [
          ev('Resources recorded', r.total),
          ev('Resources with unreported size', r.sizeInaccessibleCount),
          ev('Known transfer size (bytes, lower bound)', known),
        ],
        explanation: `Sum of the transfer sizes the browser reported. Resources with withheld sizes are not counted, so this is a lower bound. ${NOTE}`,
        recommendation: status === 'passed' ? OK : 'Compress assets and remove unneeded requests.',
      }),
    );
  }
  return out;
}

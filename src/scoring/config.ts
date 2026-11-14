import type { Category, Severity } from '../types/check';

/**
 * All tunable numbers live here: thresholds used by analyzers and the weight/severity/category of
 * every check. Analyzers contain no magic numbers. Weights are on a 1-10 scale.
 * Performance figures are lightweight indicators, not Lighthouse or Core Web Vitals results.
 */

export interface CheckMeta {
  category: Category;
  severity: Severity;
  weight: number;
}

const t = (category: Category, severity: Severity, weight: number): CheckMeta => ({
  category,
  severity,
  weight,
});

export const CHECKS: Record<string, CheckMeta> = {
  // ---- Technical SEO ----
  'tech.https': t('technical', 'high', 8),
  'tech.canonical.present': t('technical', 'medium', 8),
  'tech.canonical.conflict': t('technical', 'high', 8),
  'tech.robots.meta': t('technical', 'critical', 9),
  'tech.viewport': t('technical', 'high', 7),
  'tech.lang': t('technical', 'low', 5),
  'tech.hreflang.valid': t('technical', 'medium', 4),
  'tech.robotstxt': t('technical', 'medium', 6),
  'tech.sitemap': t('technical', 'medium', 5),
  'tech.structured.validjson': t('technical', 'high', 7),
  'tech.links.invalidscheme': t('technical', 'low', 3),
  'perf.dom.size': t('technical', 'low', 4),
  'perf.html.size': t('technical', 'low', 3),
  'perf.scripts.count': t('technical', 'low', 3),
  'perf.stylesheets.count': t('technical', 'low', 2),
  'perf.images.count': t('technical', 'low', 2),
  'perf.images.lazy': t('technical', 'low', 3),
  'perf.images.large': t('technical', 'low', 3),
  'perf.resources.sizes': t('technical', 'low', 3),
  // ---- On-page SEO ----
  'seo.title.present': t('onpage', 'critical', 9),
  'seo.title.length': t('onpage', 'medium', 6),
  'seo.title.duplicate': t('onpage', 'medium', 3),
  'seo.description.present': t('onpage', 'high', 8),
  'seo.description.length': t('onpage', 'low', 5),
  'seo.description.duplicate': t('onpage', 'low', 2),
  'seo.metakeywords': t('onpage', 'info', 1),
  'seo.h1.single': t('onpage', 'high', 9),
  'seo.headings.hierarchy': t('onpage', 'medium', 6),
  'seo.headings.empty': t('onpage', 'medium', 4),
  'seo.images.alt': t('onpage', 'high', 7),
  'seo.images.dimensions': t('onpage', 'low', 4),
  'seo.images.filename': t('onpage', 'low', 2),
  'seo.og.present': t('onpage', 'medium', 4),
  'seo.twitter.present': t('onpage', 'low', 3),
  'links.internal.count': t('onpage', 'medium', 4),
  'links.anchor.empty': t('onpage', 'medium', 4),
  'links.anchor.generic': t('onpage', 'low', 4),
  'links.nofollow.ratio': t('onpage', 'low', 2),
};

export const THRESHOLDS = {
  title: { minChars: 30, maxChars: 60 },
  description: { minChars: 70, maxChars: 160 },
  headings: { requiredH1Count: 1, hierarchyIgnoredRegions: ['nav', 'footer', 'aside'] as string[] },
  images: {
    /** Share of images missing `alt` at or below which the result is a warning rather than a failure. */
    altMissingWarnRatio: 0.25,
    /** Share of images without width+height attributes: above 0 warns, above this fails. */
    dimensionsFailRatio: 0.5,
    /** The first image is assumed to be above the fold; lazy-loading is judged on the rest. */
    lazyMinCandidates: 2,
    lazyMinRatio: 0.5,
    /** Share of generically named files (IMG_0001.jpg) above which the check fails. */
    genericFilenameFailRatio: 0.5,
    genericFilenamePattern:
      /^(img|image|dsc|dscn|pic|picture|photo|screenshot|untitled|download|file)[-_ ]?\d*(\.\w+)?$/i,
    largeImageBytes: 250_000,
    countWarn: 60,
    countFail: 150,
  },
  links: {
    minInternal: 3,
    emptyAnchorFailRatio: 0.2,
    genericAnchorFailRatio: 0.3,
    internalNofollowWarnRatio: 0.5,
    genericAnchorTexts: [
      'click here',
      'here',
      'read more',
      'more',
      'learn more',
      'link',
      'this link',
      'this',
      'click',
      'details',
      'continue',
      'go',
      'read',
      'more info',
    ] as string[],
  },
  viewport: { requiredToken: 'width=device-width' },
  langPattern: /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i,
  hreflangPattern: /^(x-default|[a-z]{2,3}(-[a-z0-9]{2,8})*)$/i,
  performance: {
    domNodes: { warn: 1500, fail: 3000 },
    htmlChars: { warn: 300_000, fail: 1_000_000 },
    scripts: { warn: 20, fail: 40 },
    stylesheets: { warn: 8, fail: 15 },
    knownResourceBytes: { warn: 2_000_000, fail: 5_000_000 },
    /** Above this share of resources with withheld sizes, the weight check is not_tested. */
    resourceInaccessibleMaxRatio: 0.5,
  },
} as const;

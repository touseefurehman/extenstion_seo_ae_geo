import type { Category, Severity } from '../types/check';
import type { ScoringConfig } from '../types/report';

/**
 * All tunable numbers live here: thresholds used by analyzers and the weight/severity/category of
 * every check. Analyzers contain no magic numbers. Weights are on a 1-10 scale.
 * Performance figures are lightweight indicators, not Lighthouse or Core Web Vitals results.
 */

export interface CheckMeta {
  /** Human-readable name shown in the UI and exports. */
  title: string;
  category: Category;
  severity: Severity;
  weight: number;
}

const t = (category: Category, severity: Severity, weight: number, title: string): CheckMeta => ({
  title,
  category,
  severity,
  weight,
});

export const CHECKS: Record<string, CheckMeta> = {
  // ---- Technical SEO ----
  'tech.https': t('technical', 'high', 8, 'HTTPS'),
  'tech.canonical.present': t('technical', 'medium', 8, 'Canonical URL'),
  'tech.canonical.conflict': t('technical', 'high', 8, 'Canonical conflicts'),
  'tech.robots.meta': t('technical', 'critical', 9, 'Robots meta directives'),
  'tech.viewport': t('technical', 'high', 7, 'Viewport meta tag'),
  'tech.lang': t('technical', 'low', 5, 'Language attribute'),
  'tech.hreflang.valid': t('technical', 'medium', 4, 'Hreflang tags'),
  'tech.robotstxt': t('technical', 'medium', 6, 'robots.txt'),
  'tech.sitemap': t('technical', 'medium', 5, 'XML sitemap'),
  'tech.structured.validjson': t('technical', 'high', 7, 'JSON-LD syntax'),
  'tech.links.invalidscheme': t('technical', 'low', 3, 'Link destinations'),
  'perf.dom.size': t('technical', 'low', 4, 'DOM size'),
  'perf.html.size': t('technical', 'low', 3, 'HTML size'),
  'perf.scripts.count': t('technical', 'low', 3, 'Script count'),
  'perf.stylesheets.count': t('technical', 'low', 2, 'Stylesheet count'),
  'perf.images.count': t('technical', 'low', 2, 'Image count'),
  'perf.images.lazy': t('technical', 'low', 3, 'Image lazy-loading'),
  'perf.images.large': t('technical', 'low', 3, 'Large images'),
  'perf.resources.sizes': t('technical', 'low', 3, 'Resource weight'),
  // ---- AEO ----
  'aeo.questions.detected': t('aeo', 'medium', 5, 'Question phrases'),
  'aeo.answer.distance': t('aeo', 'medium', 6, 'Question and answer proximity'),
  'aeo.faq.section': t('aeo', 'low', 5, 'FAQ section'),
  'aeo.faq.schema': t('aeo', 'low', 5, 'FAQPage structured data'),
  'aeo.definition.patterns': t('aeo', 'low', 4, 'Definition-style content'),
  'aeo.direct.answer': t('aeo', 'medium', 6, 'Direct answer paragraphs'),
  'aeo.structure.lists': t('aeo', 'low', 4, 'Lists'),
  'aeo.structure.tables': t('aeo', 'low', 3, 'Tables'),
  'aeo.structure.steps': t('aeo', 'low', 3, 'Step-by-step content'),
  'aeo.paragraph.length': t('aeo', 'low', 4, 'Paragraph length'),
  'aeo.readability': t('aeo', 'low', 4, 'Readability'),
  'aeo.author': t('aeo', 'medium', 5, 'Author information'),
  'aeo.dates': t('aeo', 'medium', 5, 'Published and modified dates'),
  'aeo.citations': t('aeo', 'low', 4, 'Citations and sources'),
  'aeo.conversational': t('aeo', 'low', 3, 'Conversational question coverage'),
  // ---- GEO ----
  'geo.entity.organization': t('geo', 'high', 7, 'Organization entity'),
  'geo.entity.person': t('geo', 'low', 4, 'Person entity'),
  'geo.entity.product': t('geo', 'low', 4, 'Product or service entity'),
  'geo.sameas': t('geo', 'medium', 5, 'sameAs profile links'),
  'geo.brand.consistency': t('geo', 'medium', 6, 'Brand consistency'),
  'geo.contact': t('geo', 'medium', 5, 'Business contact information'),
  'geo.authorship': t('geo', 'medium', 6, 'Authorship and expertise'),
  'geo.topical.coverage': t('geo', 'low', 5, 'Topical coverage'),
  'geo.links.contextual': t('geo', 'low', 4, 'Contextual internal links'),
  'geo.claims.references': t('geo', 'low', 5, 'Claims and references'),
  // ---- On-page SEO ----
  'seo.title.present': t('onpage', 'critical', 9, 'Page title'),
  'seo.title.length': t('onpage', 'medium', 6, 'Title length'),
  'seo.title.duplicate': t('onpage', 'medium', 3, 'Duplicate titles'),
  'seo.description.present': t('onpage', 'high', 8, 'Meta description'),
  'seo.description.length': t('onpage', 'low', 5, 'Description length'),
  'seo.description.duplicate': t('onpage', 'low', 2, 'Duplicate descriptions'),
  'seo.metakeywords': t('onpage', 'info', 1, 'Meta keywords'),
  'seo.h1.single': t('onpage', 'high', 9, 'H1 heading'),
  'seo.headings.hierarchy': t('onpage', 'medium', 6, 'Heading hierarchy'),
  'seo.headings.empty': t('onpage', 'medium', 4, 'Empty headings'),
  'seo.images.alt': t('onpage', 'high', 7, 'Image alt text'),
  'seo.images.dimensions': t('onpage', 'low', 4, 'Image dimensions'),
  'seo.images.filename': t('onpage', 'low', 2, 'Image file names'),
  'seo.og.present': t('onpage', 'medium', 4, 'Open Graph tags'),
  'seo.twitter.present': t('onpage', 'low', 3, 'Twitter Card tags'),
  'links.internal.count': t('onpage', 'medium', 4, 'Internal links'),
  'links.anchor.empty': t('onpage', 'medium', 4, 'Empty anchor text'),
  'links.anchor.generic': t('onpage', 'low', 4, 'Generic anchor text'),
  'links.nofollow.ratio': t('onpage', 'low', 2, 'Internal nofollow links'),
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
  aeo: {
    /** Question words that open a question-style heading. */
    questionOpeners: [
      'who',
      'what',
      'why',
      'how',
      'when',
      'where',
      'which',
      'can',
      'does',
      'do',
      'is',
      'are',
      'should',
      'will',
      'could',
      'did',
      'would',
    ] as string[],
    ignoredRegions: ['nav', 'footer', 'aside'] as string[],
    directAnswerMinWords: 40,
    directAnswerMaxWords: 60,
    /** Sentence pattern "<Subject> is a/an/the ..." or "refers to / means". */
    definitionPattern:
      /^(?:[A-Z][\w'’-]*(?:\s+[\w'’-]+){0,5})\s+(?:is|are)\s+(?:a|an|the|one|any|defined as|called|known as)\s|^[A-Z][\w'’-]*(?:\s+[\w'’-]+){0,5}\s+(?:refers to|means|describes)\s/,
    listMinItems: 3,
    /** Below this many body words, missing lists/tables are not penalized. */
    minWordsForStructure: 300,
    longParagraphWords: 120,
    longParagraphFailRatio: 0.3,
    minParagraphsForLength: 3,
    readabilityMinWords: 100,
    readability: { passAtLeast: 50, warnAtLeast: 30 },
    distinctQuestionTypesPass: 3,
    minExternalLinksForCitation: 2,
    referencesHeading: /\b(references?|sources?|citations?|further reading|bibliography)\b/i,
    faqHeading: /\bfaqs?\b|frequently asked/i,
    howToTitle: /\bhow to\b|\bguide\b|\btutorial\b|\bsteps?\b/i,
  },
  geo: {
    minSameAs: 2,
    minContactKinds: 2,
    minSections: 4,
    sectionHeadingLevels: [2, 3, 4] as number[],
    minWordsForAnalysis: 150,
    minContextualLinks: 3,
    claimMinCount: 3,
    claimPattern:
      /\b\d[\d,.]*\s?(%|percent|million|billion|years?|x)\b|\b(19|20)\d{2}\b|\baccording to\b|\b(study|studies|survey|research|report)\b/i,
    ignoredRegions: ['nav', 'footer', 'aside', 'header'] as string[],
    stopwords: [
      'the',
      'and',
      'for',
      'with',
      'your',
      'you',
      'our',
      'are',
      'what',
      'how',
      'why',
      'this',
      'that',
      'from',
      'about',
      'into',
      'out',
      'can',
      'does',
      'is',
      'to',
      'of',
      'in',
      'on',
      'a',
      'an',
      'or',
      'by',
      'at',
      'it',
    ] as string[],
    brandSeparators: /\s[|\-–—:·]\s/,
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

/** Scoring rules. Everything here can be overridden when calling the engine. */
export const DEFAULT_SCORING: ScoringConfig = {
  categoryWeights: { technical: 0.35, onpage: 0.25, aeo: 0.2, geo: 0.2 },
  statusValues: { passed: 1, warning: 0.5, failed: 0 },
  severityMultipliers: { critical: 1.5, high: 1.25, medium: 1, low: 0.75, info: 0.5 },
};

/** Bump when weights, thresholds or check logic change, so saved reports can be told apart. */
export const CONFIG_VERSION = '1';

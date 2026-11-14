import type { CheckResult } from '../types/check';
import type { PageSnapshot } from '../types/snapshot';
import { analyzeLinks } from './links/links';
import { analyzeHeadings } from './seo/headings';
import { analyzeImagePerformance, analyzeImages } from './seo/images';
import { analyzeMetadata } from './seo/metadata';
import { analyzePerformance } from './seo/performance';
import { analyzeTechnical } from './seo/technical';

export type Analyzer = (snapshot: PageSnapshot) => CheckResult[];

/** Registered analyzers. Phases 5 and 6 add AEO and GEO. */
export const ANALYZERS: Analyzer[] = [
  analyzeMetadata,
  analyzeHeadings,
  analyzeImages,
  analyzeLinks,
  analyzeTechnical,
  analyzePerformance,
  analyzeImagePerformance,
];

export function runAnalyzers(snapshot: PageSnapshot): CheckResult[] {
  return ANALYZERS.flatMap((a) => a(snapshot));
}

import { DEFAULT_SCORING } from './config';
import type { Category, CheckResult } from '../types/check';
import type {
  CategoryBreakdown,
  CheckContribution,
  OverallBreakdown,
  ReportSummary,
  ScoreBreakdown,
  ScoredStatus,
  ScoringConfig,
} from '../types/report';

const CATEGORIES: Category[] = ['technical', 'onpage', 'aeo', 'geo'];

const isScored = (s: CheckResult['status']): s is ScoredStatus =>
  s === 'passed' || s === 'warning' || s === 'failed';

const round = (n: number) => Math.round(n);

/**
 * score(category) = sum(weight x severityMultiplier x statusValue) / sum(weight x severityMultiplier),
 * over applicable checks only. not_applicable and not_tested checks are excluded from both sums.
 * Overall = weighted mean of the category scores that have applicable checks, with the weights
 * re-normalized over those categories.
 */
export function scoreChecks(
  checks: CheckResult[],
  config: ScoringConfig = DEFAULT_SCORING,
): ScoreBreakdown {
  const categories = {} as Record<Category, CategoryBreakdown>;

  for (const category of CATEGORIES) {
    const mine = checks.filter((c) => c.category === category);
    const contributions: CheckContribution[] = [];
    for (const c of mine) {
      if (!isScored(c.status)) continue;
      const severityMultiplier = config.severityMultipliers[c.severity];
      const effectiveWeight = c.weight * severityMultiplier;
      const statusValue = config.statusValues[c.status];
      contributions.push({
        id: c.id,
        status: c.status,
        weight: c.weight,
        severityMultiplier,
        effectiveWeight,
        statusValue,
        points: effectiveWeight * statusValue,
      });
    }
    const totalEffectiveWeight = contributions.reduce((n, c) => n + c.effectiveWeight, 0);
    const earnedPoints = contributions.reduce((n, c) => n + c.points, 0);
    const rawScore = totalEffectiveWeight > 0 ? (earnedPoints / totalEffectiveWeight) * 100 : null;
    categories[category] = {
      category,
      score: rawScore === null ? null : round(rawScore),
      rawScore,
      applicableChecks: contributions.length,
      excluded: {
        not_applicable: mine.filter((c) => c.status === 'not_applicable').length,
        not_tested: mine.filter((c) => c.status === 'not_tested').length,
      },
      totalEffectiveWeight,
      earnedPoints,
      contributions,
    };
  }

  const scored = CATEGORIES.filter(
    (c) => categories[c].rawScore !== null && config.categoryWeights[c] > 0,
  );
  const weightSum = scored.reduce((n, c) => n + config.categoryWeights[c], 0);
  const parts = scored.map((category) => ({
    category,
    configuredWeight: config.categoryWeights[category],
    normalizedWeight: config.categoryWeights[category] / weightSum,
    rawScore: categories[category].rawScore as number,
  }));
  const overallRaw =
    parts.length > 0 ? parts.reduce((n, p) => n + p.normalizedWeight * p.rawScore, 0) : null;
  const overall: OverallBreakdown = {
    score: overallRaw === null ? null : round(overallRaw),
    parts,
    excludedCategories: CATEGORIES.filter((c) => !scored.includes(c)),
  };
  return { categories, overall, config };
}

export function summarize(checks: CheckResult[]): ReportSummary {
  const byStatus = { passed: 0, warning: 0, failed: 0, not_applicable: 0, not_tested: 0 };
  for (const c of checks) byStatus[c.status]++;
  return {
    total: checks.length,
    byStatus,
    criticalIssues: checks.filter(
      (c) => c.status === 'failed' && (c.severity === 'critical' || c.severity === 'high'),
    ).length,
    warnings: byStatus.warning,
    passed: byStatus.passed,
  };
}

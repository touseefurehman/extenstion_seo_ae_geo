import { describe, expect, it } from 'vitest';
import { DEFAULT_SCORING } from '../../src/scoring/config';
import { scoreChecks, summarize } from '../../src/scoring/engine';
import type { Category, CheckResult, Severity, Status } from '../../src/types/check';
import type { ScoringConfig } from '../../src/types/report';

let n = 0;
const c = (
  category: Category,
  status: Status,
  weight = 10,
  severity: Severity = 'medium',
): CheckResult => ({
  id: `t.${category}.${n++}`,
  title: 'T',
  category,
  severity,
  status,
  weight,
  evidence: [],
  explanation: 'x',
  recommendation: 'y',
  ...(status === 'not_tested' ? { notTestedReason: 'because' } : {}),
});
const flat: ScoringConfig = {
  ...DEFAULT_SCORING,
  severityMultipliers: { critical: 1, high: 1, medium: 1, low: 1, info: 1 },
};

describe('scoreChecks', () => {
  it('status values: passed = 1, warning = 0.5, failed = 0', () => {
    const b = scoreChecks(
      [c('technical', 'passed'), c('technical', 'warning'), c('technical', 'failed')],
      flat,
    );
    expect(b.categories.technical.rawScore).toBeCloseTo(50);
    expect(b.categories.technical.contributions.map((x) => x.statusValue)).toEqual([1, 0.5, 0]);
  });

  it('all passed = 100 and all failed = 0', () => {
    expect(scoreChecks([c('aeo', 'passed'), c('aeo', 'passed')], flat).categories.aeo.score).toBe(
      100,
    );
    expect(scoreChecks([c('aeo', 'failed'), c('aeo', 'failed')], flat).categories.aeo.score).toBe(
      0,
    );
  });

  it('weights are respected: a heavy failed check outweighs a light passed one', () => {
    const b = scoreChecks([c('onpage', 'passed', 1), c('onpage', 'failed', 9)], flat);
    expect(b.categories.onpage.score).toBe(10);
  });

  it('not_applicable and not_tested are excluded from numerator AND denominator', () => {
    const b = scoreChecks(
      [c('geo', 'passed', 5), c('geo', 'not_applicable', 100), c('geo', 'not_tested', 100)],
      flat,
    );
    expect(b.categories.geo.score).toBe(100);
    expect(b.categories.geo.applicableChecks).toBe(1);
    expect(b.categories.geo.excluded).toEqual({ not_applicable: 1, not_tested: 1 });
    expect(b.categories.geo.totalEffectiveWeight).toBe(5);
  });

  it('severity multipliers scale the weight and are configurable', () => {
    const checks = [c('technical', 'passed', 10, 'low'), c('technical', 'failed', 10, 'critical')];
    expect(scoreChecks(checks, flat).categories.technical.score).toBe(50);
    const def = scoreChecks(checks).categories.technical; // low 0.75 vs critical 1.5
    expect(def.score).toBe(Math.round((7.5 / (7.5 + 15)) * 100));
    expect(def.contributions[1]).toMatchObject({
      severityMultiplier: 1.5,
      effectiveWeight: 15,
      points: 0,
    });
    const custom = scoreChecks(checks, {
      ...flat,
      severityMultipliers: { ...flat.severityMultipliers, critical: 3 },
    });
    expect(custom.categories.technical.score).toBe(Math.round((10 / 40) * 100));
  });

  it('status values are configurable', () => {
    const b = scoreChecks([c('aeo', 'warning')], {
      ...flat,
      statusValues: { passed: 1, warning: 0.8, failed: 0 },
    });
    expect(b.categories.aeo.score).toBe(80);
  });

  it('a category with no applicable checks has a null score, not zero', () => {
    const b = scoreChecks(
      [c('technical', 'passed'), c('aeo', 'not_applicable'), c('geo', 'not_tested')],
      flat,
    );
    expect(b.categories.aeo.score).toBeNull();
    expect(b.categories.geo.score).toBeNull();
    expect(b.categories.onpage.score).toBeNull();
  });

  it('rounds the category score to the nearest integer', () => {
    // 1 passed of 3 equal-weight checks = 33.33 -> 33 ; 2 of 3 = 66.67 -> 67
    expect(
      scoreChecks(
        [c('technical', 'passed'), c('technical', 'failed'), c('technical', 'failed')],
        flat,
      ).categories.technical.score,
    ).toBe(33);
    expect(
      scoreChecks(
        [c('technical', 'passed'), c('technical', 'passed'), c('technical', 'failed')],
        flat,
      ).categories.technical.score,
    ).toBe(67);
    // exactly .5 rounds up
    expect(
      scoreChecks([c('technical', 'passed', 1), c('technical', 'failed', 199)], flat).categories
        .technical.score,
    ).toBe(1);
    expect(
      scoreChecks([c('technical', 'passed', 1), c('technical', 'failed', 1), ...Array(0)], flat)
        .categories.technical.score,
    ).toBe(50);
  });
});

describe('overall score', () => {
  const all = (statuses: Record<Category, Status>) =>
    (Object.keys(statuses) as Category[]).map((k) => c(k, statuses[k]));

  it('uses Technical 35%, On-page 25%, AEO 20%, GEO 20%', () => {
    expect(DEFAULT_SCORING.categoryWeights).toEqual({
      technical: 0.35,
      onpage: 0.25,
      aeo: 0.2,
      geo: 0.2,
    });
    const b = scoreChecks(
      all({ technical: 'passed', onpage: 'failed', aeo: 'failed', geo: 'failed' }),
      flat,
    );
    expect(b.overall.score).toBe(35);
    const b2 = scoreChecks(
      all({ technical: 'failed', onpage: 'passed', aeo: 'passed', geo: 'failed' }),
      flat,
    );
    expect(b2.overall.score).toBe(45);
  });

  it('all 100 -> 100; all 0 -> 0; weights sum to 1', () => {
    expect(
      scoreChecks(
        all({ technical: 'passed', onpage: 'passed', aeo: 'passed', geo: 'passed' }),
        flat,
      ).overall.score,
    ).toBe(100);
    expect(
      scoreChecks(
        all({ technical: 'failed', onpage: 'failed', aeo: 'failed', geo: 'failed' }),
        flat,
      ).overall.score,
    ).toBe(0);
    expect(Object.values(DEFAULT_SCORING.categoryWeights).reduce((a, b) => a + b, 0)).toBeCloseTo(
      1,
    );
  });

  it('re-normalizes when a category has no applicable checks', () => {
    const checks = [
      c('technical', 'passed'),
      c('onpage', 'failed'),
      c('aeo', 'not_applicable'),
      c('geo', 'not_tested'),
    ];
    const b = scoreChecks(checks, flat);
    // technical 0.35 -> 0.35/0.6, onpage 0.25 -> 0.25/0.6 ; score = 100 * 0.35/0.6 = 58.33
    expect(b.overall.score).toBe(58);
    expect(b.overall.excludedCategories).toEqual(['aeo', 'geo']);
    expect(b.overall.parts.map((p) => p.normalizedWeight.toFixed(4))).toEqual(['0.5833', '0.4167']);
    expect(b.overall.parts.reduce((a, p) => a + p.normalizedWeight, 0)).toBeCloseTo(1);
  });

  it('is null when nothing is applicable anywhere', () => {
    const b = scoreChecks([c('technical', 'not_applicable'), c('aeo', 'not_tested')], flat);
    expect(b.overall.score).toBeNull();
    expect(b.overall.parts).toEqual([]);
    expect(scoreChecks([]).overall.score).toBeNull();
  });

  it('uses unrounded category scores and rounds once', () => {
    // technical 33.33, onpage 66.67 -> 0.35*33.33+0.25*66.67 over 0.6 = 47.22 -> 47
    const checks = [
      c('technical', 'passed'),
      c('technical', 'failed'),
      c('technical', 'failed'),
      c('onpage', 'passed'),
      c('onpage', 'passed'),
      c('onpage', 'failed'),
    ];
    expect(scoreChecks(checks, flat).overall.score).toBe(47);
  });

  it('category weights are configurable (zero weight removes a category)', () => {
    const cfg = { ...flat, categoryWeights: { technical: 1, onpage: 0, aeo: 0, geo: 0 } };
    expect(
      scoreChecks(all({ technical: 'passed', onpage: 'failed', aeo: 'failed', geo: 'failed' }), cfg)
        .overall.score,
    ).toBe(100);
  });

  it('breakdown lets the UI reproduce the score exactly', () => {
    const checks = [
      c('technical', 'passed', 7, 'high'),
      c('technical', 'warning', 3, 'low'),
      c('onpage', 'failed', 4, 'critical'),
    ];
    const b = scoreChecks(checks);
    for (const cat of Object.values(b.categories)) {
      const earned = cat.contributions.reduce((a, x) => a + x.effectiveWeight * x.statusValue, 0);
      const total = cat.contributions.reduce((a, x) => a + x.effectiveWeight, 0);
      expect(cat.earnedPoints).toBeCloseTo(earned);
      expect(cat.totalEffectiveWeight).toBeCloseTo(total);
    }
    expect(b.config).toEqual(DEFAULT_SCORING);
  });
});

describe('summarize', () => {
  it('counts statuses and critical issues (failed critical/high only)', () => {
    const s = summarize([
      c('technical', 'failed', 5, 'critical'),
      c('technical', 'failed', 5, 'high'),
      c('technical', 'failed', 5, 'low'),
      c('aeo', 'warning'),
      c('aeo', 'passed'),
      c('geo', 'not_tested'),
      c('geo', 'not_applicable'),
    ]);
    expect(s).toMatchObject({ total: 7, criticalIssues: 2, warnings: 1, passed: 1 });
    expect(s.byStatus).toEqual({
      passed: 1,
      warning: 1,
      failed: 3,
      not_applicable: 1,
      not_tested: 1,
    });
  });
});

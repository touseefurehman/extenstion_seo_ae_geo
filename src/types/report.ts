import type { SchemaReport } from '../analyzers/schema/inspect';
import type { Category, CheckResult, Severity, Status } from './check';
import type { PageSnapshot } from './snapshot';

export type ScoredStatus = 'passed' | 'warning' | 'failed';

export interface ScoringConfig {
  /** Share of the overall score per category (re-normalized when a category has no applicable checks). */
  categoryWeights: Record<Category, number>;
  /** Credit per status: passed 1, warning 0.5, failed 0 by default. */
  statusValues: Record<ScoredStatus, number>;
  /** Multiplies a check's weight by its severity. */
  severityMultipliers: Record<Severity, number>;
}

export interface CheckContribution {
  id: string;
  status: ScoredStatus;
  weight: number;
  severityMultiplier: number;
  effectiveWeight: number;
  statusValue: number;
  /** effectiveWeight x statusValue */
  points: number;
}

export interface CategoryBreakdown {
  category: Category;
  /** 0-100 rounded, or null when no check was applicable. */
  score: number | null;
  /** Unrounded 0-100 value used for the overall score. */
  rawScore: number | null;
  applicableChecks: number;
  excluded: { not_applicable: number; not_tested: number };
  totalEffectiveWeight: number;
  earnedPoints: number;
  contributions: CheckContribution[];
}

export interface OverallBreakdown {
  score: number | null;
  parts: {
    category: Category;
    configuredWeight: number;
    normalizedWeight: number;
    rawScore: number;
  }[];
  /** Categories left out because they had no applicable checks. */
  excludedCategories: Category[];
}

export interface ScoreBreakdown {
  categories: Record<Category, CategoryBreakdown>;
  overall: OverallBreakdown;
  config: ScoringConfig;
}

export interface CategoryScore {
  score: number | null;
  applicableChecks: number;
}

export interface ReportSummary {
  total: number;
  byStatus: Record<Status, number>;
  /** Failed checks of critical or high severity. */
  criticalIssues: number;
  warnings: number;
  passed: number;
}

export interface AuditReport {
  id: string;
  version: 1;
  url: string;
  title: string | null;
  createdAt: string;
  /** Version of the scoring/check configuration that produced this report. */
  configVersion: string;
  overall: number | null;
  categories: Record<Category, CategoryScore>;
  breakdown: ScoreBreakdown;
  summary: ReportSummary;
  checks: CheckResult[];
  schema: SchemaReport;
  /** Size-reduced copy of the extracted snapshot (no page HTML). */
  page: PageSnapshot;
}

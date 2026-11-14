import type { Category, CheckResult } from './check';

export interface CategoryScore {
  /** 0-100, or null when the category has no applicable checks. */
  score: number | null;
  applicableChecks: number;
}

export interface AuditReport {
  id: string;
  version: 1;
  url: string;
  title: string | null;
  createdAt: string;
  overall: number | null;
  categories: Record<Category, CategoryScore>;
  checks: CheckResult[];
}

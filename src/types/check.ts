export type Category = 'technical' | 'onpage' | 'aeo' | 'geo';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Status = 'passed' | 'warning' | 'failed' | 'not_applicable' | 'not_tested';

export interface Evidence {
  label: string;
  value: string | number | boolean | null;
}

export interface CheckResult {
  /** Stable ID, e.g. `seo.title.length`. */
  id: string;
  category: Category;
  severity: Severity;
  status: Status;
  weight: number;
  /** Real extracted values only. */
  evidence: Evidence[];
  /** AEO/GEO: whether the finding is directly detected or inferred from signals. */
  evidenceKind?: 'detected' | 'inferred';
  /** Required when status is `not_tested`. */
  notTestedReason?: string;
  explanation: string;
  recommendation: string;
}

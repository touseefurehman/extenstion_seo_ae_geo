import type { CheckResult, Severity, Status } from '../types/check';
import { SEVERITY_LABELS, STATUS_LABELS } from '../utils/labels';

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`nr-badge nr-status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`nr-badge nr-sev-${severity}`}>{SEVERITY_LABELS[severity]}</span>;
}

export function EvidenceKindBadge({ kind }: { kind: CheckResult['evidenceKind'] }) {
  if (!kind) return null;
  return (
    <span
      className={`nr-badge nr-kind-${kind}`}
      title={
        kind === 'detected' ? 'Found directly on the page' : 'Inferred from signals on the page'
      }
    >
      {kind === 'detected' ? 'Detected' : 'Inferred'}
    </span>
  );
}

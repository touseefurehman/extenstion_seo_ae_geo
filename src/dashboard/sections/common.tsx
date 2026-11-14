import type { ReactNode } from 'react';

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`h-${title.replace(/\W+/g, '-')}`} className="nr-section">
      <h2 id={`h-${title.replace(/\W+/g, '-')}`} className="h4 mb-1">
        {title}
      </h2>
      {subtitle && <p className="nr-muted mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="nr-card nr-stat">
      <div className="nr-stat-value">{value}</div>
      <div className="nr-stat-label">{label}</div>
      {hint && <div className="nr-muted small">{hint}</div>}
    </div>
  );
}

export function Panel({
  title,
  children,
  note,
}: {
  title: string;
  children: ReactNode;
  note?: string;
}) {
  return (
    <div className="nr-card mb-3">
      <h3 className="h6 mb-2">{title}</h3>
      {children}
      {note && <div className="nr-muted small mt-2">{note}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="nr-muted small">{children}</div>;
}

export const LIMITATION_NOTE =
  'NexusRank analyzes the rendered page locally in your browser. Results are indicators based on measurable page signals. They do not measure search rankings, AI-engine citations, backlinks, keyword volume or Core Web Vitals.';

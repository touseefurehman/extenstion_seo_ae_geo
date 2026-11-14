import type { Status } from '../types/check';
import { STATUS_LABELS, STATUSES } from '../utils/labels';

const STATUS_COLOR: Record<Status, string> = {
  passed: 'var(--nr-good)',
  warning: 'var(--nr-warn)',
  failed: 'var(--nr-bad)',
  not_applicable: 'var(--nr-none)',
  not_tested: '#8b5cf6',
};

/** Stacked horizontal bar of check statuses. */
export function StatusBar({
  counts,
  width = 520,
}: {
  counts: Record<Status, number>;
  width?: number;
}) {
  const total = STATUSES.reduce((n, s) => n + counts[s], 0);
  let x = 0;
  return (
    <figure className="nr-figure">
      <svg
        viewBox={`0 0 ${width} 22`}
        width="100%"
        height="22"
        role="img"
        aria-label={`Check results: ${STATUSES.map((s) => `${counts[s]} ${STATUS_LABELS[s]}`).join(', ')}`}
        preserveAspectRatio="none"
      >
        {total === 0 ? (
          <rect x="0" y="0" width={width} height="22" rx="6" fill="var(--nr-surface-2)" />
        ) : (
          STATUSES.map((s) => {
            const w = (counts[s] / total) * width;
            const rect =
              counts[s] > 0 ? (
                <rect key={s} x={x} y="0" width={w} height="22" fill={STATUS_COLOR[s]} />
              ) : null;
            x += w;
            return rect;
          })
        )}
      </svg>
      <figcaption className="nr-legend">
        {STATUSES.map((s) => (
          <span key={s}>
            <i style={{ background: STATUS_COLOR[s] }} aria-hidden /> {STATUS_LABELS[s]} {counts[s]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export interface TrendPoint {
  label: string;
  value: number | null;
}

/** Line chart (0-100) of scores over time. Points without a score are skipped. */
export function TrendChart({ points, title }: { points: TrendPoint[]; title: string }) {
  const W = 520;
  const H = 140;
  const pad = 24;
  const valid = points
    .map((p, i) => ({ ...p, i }))
    .filter((p): p is TrendPoint & { i: number; value: number } => p.value !== null);
  if (valid.length < 2) {
    return <div className="nr-muted small">Analyze this page at least twice to see a trend.</div>;
  }
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / 100) * (H - pad * 2);
  const path = valid
    .map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}>
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line
            x1={pad}
            x2={W - pad}
            y1={y(g)}
            y2={y(g)}
            stroke="var(--nr-border)"
            strokeDasharray="3 3"
          />
          <text
            x={pad - 6}
            y={y(g)}
            textAnchor="end"
            dominantBaseline="central"
            fontSize="10"
            fill="var(--nr-muted)"
          >
            {g}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--nr-blue)" strokeWidth="2" />
      {valid.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.value)} r="3.5" fill="var(--nr-purple)">
          <title>{`${p.label}: ${p.value}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Histogram of integer values grouped into buckets. */
export function Histogram({
  values,
  buckets,
  title,
}: {
  values: number[];
  buckets: { label: string; max: number }[];
  title: string;
}) {
  const counts = buckets.map(() => 0);
  for (const v of values) {
    const i = buckets.findIndex((b) => v <= b.max);
    counts[i === -1 ? buckets.length - 1 : i]!++;
  }
  const max = Math.max(1, ...counts);
  const W = 520;
  const H = 120;
  const bw = W / buckets.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" role="img" aria-label={title}>
      {buckets.map((b, i) => {
        const h = (counts[i]! / max) * (H - 18);
        return (
          <g key={b.label}>
            <rect
              x={i * bw + 6}
              y={H - h}
              width={bw - 12}
              height={h}
              rx="3"
              fill="var(--nr-blue)"
              opacity="0.85"
            />
            <text
              x={i * bw + bw / 2}
              y={H - h - 4}
              textAnchor="middle"
              fontSize="11"
              fill="var(--nr-text)"
            >
              {counts[i]}
            </text>
            <text
              x={i * bw + bw / 2}
              y={H + 14}
              textAnchor="middle"
              fontSize="11"
              fill="var(--nr-muted)"
            >
              {b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

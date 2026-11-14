import { scoreTone } from '../utils/labels';

interface Props {
  score: number | null;
  size?: number;
  label?: string;
}

/** SVG donut showing a 0-100 score; `null` renders "n/a" (no applicable checks). */
export function ScoreRing({ score, size = 96, label }: Props) {
  const stroke = Math.max(6, Math.round(size / 10));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const tone = scoreTone(score);
  const offset = score === null ? c : c * (1 - score / 100);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label ?? 'Score'}: ${score === null ? 'not available' : `${score} out of 100`}`}
      className={`nr-ring nr-tone-${tone}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="nr-ring-track"
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="nr-ring-value"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="nr-ring-text"
        fontSize={size * 0.3}
      >
        {score === null ? 'n/a' : score}
      </text>
    </svg>
  );
}

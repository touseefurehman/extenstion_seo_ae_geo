import { scoreTone } from '../utils/labels';

/** Horizontal score bar. */
export function ScoreBar({ label, score }: { label: string; score: number | null }) {
  const tone = scoreTone(score);
  return (
    <div className="nr-bar-row">
      <div className="nr-bar-label">{label}</div>
      <div
        className="nr-bar-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(score !== null ? { 'aria-valuenow': score } : {})}
      >
        <div className={`nr-bar-fill nr-bg-${tone}`} style={{ width: `${score ?? 0}%` }} />
      </div>
      <div className="nr-bar-value">{score === null ? 'n/a' : score}</div>
    </div>
  );
}

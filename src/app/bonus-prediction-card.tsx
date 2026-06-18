import { formatFinishPosition } from "@/lib/bonus-predictions";

type BonusPredictionCardProps = {
  questionText: string;
  selectedPosition?: number | null;
  actualPosition?: number | null;
  points?: number | null;
  showActual?: boolean;
  showPoints?: boolean;
  pointsAvailable?: number | null;
  className?: string;
};

const formatPoints = (points: number | null | undefined) =>
  typeof points === "number" ? (points > 0 ? `+${points}` : "0") : "Nog niet bekend";

export function BonusPredictionCard({
  questionText,
  selectedPosition,
  actualPosition,
  points,
  showActual = false,
  showPoints = false,
  pointsAvailable = null,
  className,
}: BonusPredictionCardProps) {
  return (
    <div className={["fastest-pitstop-card", className].filter(Boolean).join(" ")}>
      <div className="fastest-pitstop-card-header">
        <div className="fastest-pitstop-card-icon" aria-hidden="true">🎯</div>
        <div>
          <h3>Bonusvraag</h3>
          <p>{questionText}</p>
        </div>
      </div>
      {pointsAvailable !== null ? (
        <p className="fastest-pitstop-helper">Goed voorspeld: {pointsAvailable} punten.</p>
      ) : null}
      <dl className="fastest-pitstop-summary">
        <div>
          <dt>Jouw voorspelling</dt>
          <dd>{formatFinishPosition(selectedPosition)}</dd>
        </div>
        {showActual ? (
          <div>
            <dt>Werkelijke plek</dt>
            <dd>{formatFinishPosition(actualPosition)}</dd>
          </div>
        ) : null}
        {showPoints ? (
          <div className="fastest-pitstop-points-row">
            <dt>Punten</dt>
            <dd>{formatPoints(points)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

import type { ReactNode } from "react";

type FastestPitstopBonusCardProps = {
  title?: string;
  subtitle?: string;
  selectedTeam?: string | null;
  actualTeam?: string | null;
  points?: number | null;
  showActual?: boolean;
  showPoints?: boolean;
  selectControl?: ReactNode;
  helperText?: string;
  className?: string;
};

const formatPoints = (points: number | null | undefined) =>
  typeof points === "number" ? (points > 0 ? `+${points}` : "0") : "Nog niet bekend";

export function FastestPitstopBonusCard({
  title = "Snelste pitstop",
  subtitle = "Welk team maakt de snelste pitstop?",
  selectedTeam,
  actualTeam,
  points,
  showActual = false,
  showPoints = false,
  selectControl,
  helperText,
  className,
}: FastestPitstopBonusCardProps) {
  const rootClassName = ["fastest-pitstop-card", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName}>
      <div className="fastest-pitstop-card-header">
        <div className="fastest-pitstop-card-icon" aria-hidden="true">
          ⚡
        </div>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      {helperText ? <p className="fastest-pitstop-helper">{helperText}</p> : null}

      {selectControl ? (
        <div className="fastest-pitstop-control">{selectControl}</div>
      ) : null}

      <dl className="fastest-pitstop-summary">
        <div>
          <dt>Jouw voorspelling</dt>
          <dd>{selectedTeam || "Nog geen team gekozen"}</dd>
        </div>
        {showActual ? (
          <div>
            <dt>Werkelijk snelste team</dt>
            <dd>{actualTeam || "Nog niet bekend"}</dd>
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

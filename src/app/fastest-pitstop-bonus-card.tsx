"use client";

import Image from "next/image";

import { getTeamSideImageSize } from "@/lib/team-side-view-images";
import { resolveTeamSelectionTeam } from "@/lib/team-selection-teams";

type FastestPitstopBonusCardProps = {
  title?: string;
  subtitle?: string;
  selectedTeam?: string | null;
  actualTeam?: string | null;
  points?: number | null;
  showActual?: boolean;
  showPoints?: boolean;
  helperText?: string;
  className?: string;
  disabled?: boolean;
  onOpenPicker?: () => void;
};

const formatPoints = (points: number | null | undefined) =>
  typeof points === "number"
    ? points > 0
      ? `+${points}`
      : "0"
    : "Nog niet bekend";

export function FastestPitstopBonusCard({
  title = "Snelste pitstop",
  subtitle = "Welk team maakt de snelste pitstop?",
  selectedTeam,
  actualTeam,
  points,
  showActual = false,
  showPoints = false,
  helperText,
  className,
  disabled = false,
  onOpenPicker,
}: FastestPitstopBonusCardProps) {
  const rootClassName = ["fastest-pitstop-card", className]
    .filter(Boolean)
    .join(" ");
  const selectedTeamDetails = selectedTeam
    ? resolveTeamSelectionTeam(selectedTeam)
    : null;
  const selectedCardImageSize = getTeamSideImageSize("selectedCard");
  const isInteractive = Boolean(onOpenPicker) && !disabled;
  const pickCardClassName = [
    "gp-team-slot",
    "fastest-pitstop-pick-card",
    selectedTeamDetails ? "filled" : "empty",
    isInteractive ? "interactive" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const pickCardContent = selectedTeamDetails ? (
    <>
      <div className="gp-team-slot-car fastest-pitstop-pick-car">
        <Image
          src={selectedTeamDetails.image}
          alt={`${selectedTeamDetails.name} wagen`}
          width={selectedCardImageSize.width}
          height={selectedCardImageSize.height}
          className={selectedCardImageSize.className}
        />
      </div>
      <p className="gp-team-slot-copy fastest-pitstop-pick-copy">
        <strong>{selectedTeamDetails.name}</strong>
        <span>Geselecteerd team</span>
      </p>
    </>
  ) : (
    <div className="gp-team-slot-empty fastest-pitstop-empty-state">
      <strong>Kies een team</strong>
      <span>Nog geen snelste pitstop voorspeld</span>
    </div>
  );

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

      {onOpenPicker ? (
        <button
          type="button"
          className={pickCardClassName}
          onClick={onOpenPicker}
          disabled={disabled}
        >
          {pickCardContent}
        </button>
      ) : (
        <div className={pickCardClassName}>{pickCardContent}</div>
      )}

      {showActual || showPoints ? (
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
      ) : null}
    </div>
  );
}

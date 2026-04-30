"use client";

import Image from "next/image";
import { type CSSProperties, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { saveTeamSelection, type TeamSelectionActionState } from "@/app/actions/team-selection";
import { compareDriverStandings } from "@/lib/driver-pricing";
import { getConstructorTeamColors } from "@/lib/team-colors";
import { getTeamSideImageSize } from "@/lib/team-side-view-images";
import { resolveTeamSelectionTeam } from "@/lib/team-selection-teams";

type DriverWithPrice = {
  id: string;
  name: string;
  constructorTeam: string;
  price: number;
  seasonScore: number;
  racePoints: number;
  mostRecentRacePosition: number;
  performanceRank: number;
};

type TeamSelectionCompactFormProps = {
  leagueId: string;
  grandPrixId: string;
  drivers: DriverWithPrice[];
  initialSelectedDriverIds: string[];
  publishedDriverScores?: Record<
    string,
    {
      sprintQualiPoints: number | null;
      sprintRacePoints: number | null;
      qualiPoints: number | null;
      racePoints: number | null;
      totalPoints: number | null;
    }
  >;
  hasPublishedQualiPoints?: boolean;
  hasPublishedRacePoints?: boolean;
  hasPublishedSprintQualiPoints?: boolean;
  hasPublishedSprintRacePoints?: boolean;
  savingDisabled?: boolean;
  readOnly?: boolean;
  showFallbackNotice?: boolean;
};

const MAX_BUDGET = 1000;
const REQUIRED_DRIVERS = 4;
const INITIAL_STATE: TeamSelectionActionState = { status: "idle" };

const formatPrice = (price: number) => `${(price / 10).toFixed(1)}M`;

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return <button type="submit" disabled={disabled || pending}>{pending ? "Bezig met opslaan..." : "Team opslaan"}</button>;
}

const slotIndexes = [0, 1, 2, 3] as const;

export function TeamSelectionCompactForm({
  leagueId,
  grandPrixId,
  drivers,
  initialSelectedDriverIds,
  publishedDriverScores = {},
  hasPublishedQualiPoints = false,
  hasPublishedRacePoints = false,
  hasPublishedSprintQualiPoints = false,
  hasPublishedSprintRacePoints = false,
  savingDisabled = false,
  readOnly = false,
  showFallbackNotice = false,
}: TeamSelectionCompactFormProps) {
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>(initialSelectedDriverIds);
  const [state, formAction] = useFormState(saveTeamSelection, INITIAL_STATE);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);

  const selectedDrivers = useMemo(
    () => drivers.filter((driver) => selectedDriverIds.includes(driver.id)),
    [drivers, selectedDriverIds],
  );

  const selectedDriversForDisplay = useMemo(
    () =>
      [...selectedDrivers].sort((left, right) =>
        compareDriverStandings(
          {
            driverId: left.id,
            name: left.name,
            racePoints: left.racePoints,
            qualifyingBonus: left.seasonScore - left.racePoints,
            seasonScore: left.seasonScore,
            mostRecentRacePosition: left.mostRecentRacePosition,
          },
          {
            driverId: right.id,
            name: right.name,
            racePoints: right.racePoints,
            qualifyingBonus: right.seasonScore - right.racePoints,
            seasonScore: right.seasonScore,
            mostRecentRacePosition: right.mostRecentRacePosition,
          },
        ),
      ),
    [selectedDrivers],
  );

  const driversById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);

  const driversByTeam = useMemo(() => {
    const grouped = new Map<string, DriverWithPrice[]>();

    drivers.forEach((driver) => {
      const teamDrivers = grouped.get(driver.constructorTeam) ?? [];
      teamDrivers.push(driver);
      grouped.set(driver.constructorTeam, teamDrivers);
    });

    return Array.from(grouped.entries())
      .map(([teamName, teamDrivers]) => {
        const teamConfig = resolveTeamSelectionTeam(teamName);

        return {
          teamName,
          ...teamConfig,
          drivers: [...teamDrivers].sort((left, right) => {
            if (left.performanceRank !== right.performanceRank) {
              return left.performanceRank - right.performanceRank;
            }

            return left.name.localeCompare(right.name, "nl-NL");
          }),
          teamScore: teamDrivers.reduce((total, driver) => total + (driver.seasonScore ?? 0), 0),
        };
      })
      .sort((left, right) => {
        if (right.teamScore !== left.teamScore) {
          return right.teamScore - left.teamScore;
        }

        return left.teamName.localeCompare(right.teamName, "nl-NL");
      });
  }, [drivers]);

  const sortedDrivers = useMemo(() => driversByTeam.flatMap((team) => team.drivers), [driversByTeam]);

  const totalPrice = selectedDrivers.reduce((sum, driver) => sum + driver.price, 0);
  const remainingBudget = MAX_BUDGET - totalPrice;
  const constructorCount = new Set(selectedDrivers.map((driver) => driver.constructorTeam)).size;

  const validationErrors: string[] = [];

  if (totalPrice > MAX_BUDGET) {
    validationErrors.push("Je team mag maximaal 100 miljoen kosten");
  }

  if (selectedDrivers.length !== REQUIRED_DRIVERS) {
    validationErrors.push("Je moet precies 4 coureurs kiezen");
  }

  if (constructorCount !== selectedDrivers.length) {
    validationErrors.push("Je mag geen twee coureurs uit hetzelfde team kiezen");
  }

  const canSave = validationErrors.length === 0 && !savingDisabled && !readOnly;

  const slots = slotIndexes.map((index) => selectedDriversForDisplay[index] ?? null);
  const activeSlotDriverId = activeSlotIndex === null ? null : slots[activeSlotIndex]?.id ?? null;

  const candidateSelection = (slotDriverId: string | null, nextDriverId: string) => {
    const withoutNext = selectedDriverIds.filter((id) => id !== nextDriverId);

    if (slotDriverId) {
      const replaceIndex = withoutNext.indexOf(slotDriverId);

      if (replaceIndex >= 0) {
        withoutNext[replaceIndex] = nextDriverId;
        return withoutNext;
      }

      return [...withoutNext, nextDriverId].slice(0, REQUIRED_DRIVERS);
    }

    if (withoutNext.length >= REQUIRED_DRIVERS) {
      return withoutNext;
    }

    return [...withoutNext, nextDriverId];
  };

  const isCandidateValid = (candidateIds: string[]) => {
    const candidateDrivers = candidateIds.map((driverId) => driversById.get(driverId)).filter(Boolean) as DriverWithPrice[];
    const candidateTotalPrice = candidateDrivers.reduce((sum, driver) => sum + driver.price, 0);

    if (candidateTotalPrice > MAX_BUDGET) {
      return false;
    }

    const candidateConstructorCount = new Set(candidateDrivers.map((driver) => driver.constructorTeam)).size;
    if (candidateConstructorCount !== candidateDrivers.length) {
      return false;
    }

    return candidateIds.length <= REQUIRED_DRIVERS;
  };

  const isDriverSelectableForActiveSlot = (driverId: string) => {
    if (readOnly) {
      return false;
    }

    if (driverId === activeSlotDriverId) {
      return true;
    }

    const candidateIds = candidateSelection(activeSlotDriverId, driverId);
    return isCandidateValid(candidateIds);
  };

  const chooseDriverForSlot = (driverId: string) => {
    if (!isDriverSelectableForActiveSlot(driverId)) {
      return;
    }

    const nextSelectedDriverIds = candidateSelection(activeSlotDriverId, driverId);
    setSelectedDriverIds(nextSelectedDriverIds);
    setActiveSlotIndex(null);
  };

  const clearSlot = () => {
    if (!activeSlotDriverId || readOnly) {
      return;
    }

    setSelectedDriverIds((current) => current.filter((driverId) => driverId !== activeSlotDriverId));
    setActiveSlotIndex(null);
  };

  return (
    <form action={formAction} className="team-selection-form compact-team-selection-form">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="grand_prix_id" value={grandPrixId} />
      <input type="hidden" name="selected_driver_ids" value={selectedDriverIds.join(",")} />

      <section className="team-selection-summary compact-team-selection-summary">
        <h3>{selectedDrivers.length === REQUIRED_DRIVERS ? "Geselecteerde coureurs" : "Kies 4 coureurs"}</h3>

        <div className="gp-team-slot-grid" role="list" aria-label="Geselecteerde coureurs">
          {slots.map((slotDriver, index) => {
            const slotTeam = slotDriver ? resolveTeamSelectionTeam(slotDriver.constructorTeam) : null;
            const slotImageSize = getTeamSideImageSize("slot");
            const slotScore = slotDriver ? publishedDriverScores[slotDriver.id] : null;
            const hasPublishedScore = Boolean(
              slotScore &&
                (hasPublishedSprintQualiPoints ||
                  hasPublishedSprintRacePoints ||
                  hasPublishedQualiPoints ||
                  hasPublishedRacePoints),
            );
            const slotTotalPoints =
              slotScore?.totalPoints ??
              ((slotScore?.sprintQualiPoints ?? 0) +
                (slotScore?.sprintRacePoints ?? 0) +
                (slotScore?.qualiPoints ?? 0) +
                (slotScore?.racePoints ?? 0));
            const pointRows = [
              { label: "Sprint kwali", value: hasPublishedSprintQualiPoints ? (slotScore?.sprintQualiPoints ?? null) : null },
              { label: "Sprint race", value: hasPublishedSprintRacePoints ? (slotScore?.sprintRacePoints ?? null) : null },
              { label: "Kwali", value: hasPublishedQualiPoints ? (slotScore?.qualiPoints ?? null) : null },
              { label: "Race", value: hasPublishedRacePoints ? (slotScore?.racePoints ?? null) : null },
              { label: "Totaal", value: hasPublishedScore ? slotTotalPoints : null },
            ].filter((row) => row.value !== null);
            const shouldRenderPointRows = hasPublishedScore && pointRows.length > 0;

            return (
              <button
                key={index}
                type="button"
                className={`gp-team-slot ${slotDriver ? "filled" : "empty"}`}
                onClick={() => setActiveSlotIndex(index)}
                disabled={readOnly}
              >
                {slotDriver && slotTeam ? (
                  <>
                    <div className="gp-team-slot-car">
                      <Image
                        src={slotTeam.image}
                        alt={`${slotTeam.name} wagen`}
                        width={slotImageSize.width}
                        height={slotImageSize.height}
                        className={slotImageSize.className}
                      />
                    </div>
                    <p className="gp-team-slot-copy">
                      <strong>{slotDriver.name}</strong>
                      <span className="gp-team-slot-team-name">{slotDriver.constructorTeam}</span>
                      <span>{formatPrice(slotDriver.price)}</span>
                    </p>
                    {shouldRenderPointRows ? (
                      <dl className="gp-team-slot-points">
                        {pointRows.map((row) => (
                          <div key={`${slotDriver.id}-${row.label}`}>
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </>
                ) : (
                  <div className="gp-team-slot-empty">
                    <strong>Vrije plek</strong>
                    <span>Kies coureur</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {showFallbackNotice ? (
          <p className="form-message">Deze prijzen zijn onder voorbehoud en gebaseerd op de vorige Grand Prix.</p>
        ) : null}

        <p>
          Totale prijs: <strong>{formatPrice(totalPrice)}</strong>
        </p>
        <p>
          Overgebleven budget: <strong>{formatPrice(remainingBudget)}</strong>
        </p>

        {validationErrors.length > 0 && (
          <div className="form-message error" role="alert">
            <ul>
              {validationErrors.map((errorMessage) => (
                <li key={errorMessage}>{errorMessage}</li>
              ))}
            </ul>
          </div>
        )}

        {state.status !== "idle" && state.message && (
          <p className={`form-message ${state.status === "success" ? "success" : "error"}`}>{state.message}</p>
        )}

        {readOnly ? <p className="league-list-empty">Deze Grand Prix is gesloten. Je team is alleen-lezen.</p> : <SaveButton disabled={!canSave} />}
      </section>

      {activeSlotIndex !== null ? (
        <div
          className="podium-selection-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setActiveSlotIndex(null);
            }
          }}
        >
          <div className="podium-selection-panel gp-team-selection-panel" role="dialog" aria-modal="true" aria-label="Coureur kiezen">
            <div className="podium-selection-panel-header">
              <div>
                <h3>Kies coureur</h3>
                <p>Team kiezen · 4 coureurs · Maximaal 100 miljoen</p>
              </div>
              <button type="button" onClick={() => setActiveSlotIndex(null)} className="podium-selection-close">
                Sluiten
              </button>
            </div>

            {activeSlotDriverId ? (
              <button type="button" className="podium-selection-close gp-team-clear-button" onClick={clearSlot}>
                Slot leegmaken
              </button>
            ) : null}

            <div className="podium-driver-options gp-team-driver-options">
              {sortedDrivers.map((driver) => {
                const team = resolveTeamSelectionTeam(driver.constructorTeam);
                const teamColors = getConstructorTeamColors(driver.constructorTeam);
                const imageSize = getTeamSideImageSize("modalOption");
                const isSelected = selectedDriverIds.includes(driver.id);
                const canSelect = isDriverSelectableForActiveSlot(driver.id);
                const isUnavailable = !canSelect && !isSelected;

                return (
                  <button
                    key={driver.id}
                    type="button"
                    className={`podium-driver-option gp-team-driver-option ${isSelected ? "selected" : ""}`}
                    disabled={!canSelect}
                    onClick={() => chooseDriverForSlot(driver.id)}
                    style={
                      {
                        "--team-accent": teamColors.accent,
                      } as CSSProperties
                    }
                  >
                    <div className="podium-driver-option-image">
                      <Image
                        src={team.image}
                        alt={`${team.name} wagen`}
                        width={imageSize.width}
                        height={imageSize.height}
                        className={imageSize.className}
                      />
                    </div>
                    <div className="podium-driver-option-copy">
                      <strong>{driver.name}</strong>
                      <span>{driver.constructorTeam}</span>
                      <span className="gp-team-driver-option-price">{formatPrice(driver.price)}</span>
                      {isUnavailable ? <span className="gp-team-driver-option-state">Niet beschikbaar binnen je huidige team</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

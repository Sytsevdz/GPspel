"use client";

import Image from "next/image";
import { type CSSProperties, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { saveTeamSelection, type TeamSelectionActionState } from "@/app/actions/team-selection";
import { compareDriverStandings } from "@/lib/driver-pricing";
import { getConstructorTeamColors } from "@/lib/team-colors";
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
        <h3>Kies 4 coureurs</h3>

        <div className="gp-team-slot-grid" role="list" aria-label="Geselecteerde coureurs">
          {slots.map((slotDriver, index) => {
            const slotTeam = slotDriver ? resolveTeamSelectionTeam(slotDriver.constructorTeam) : null;

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
                      <Image src={slotTeam.image} alt={`${slotTeam.name} wagen`} width={240} height={96} className="gp-team-slot-image" />
                    </div>
                    <p>
                      <strong>{slotDriver.name}</strong>
                      <span>{formatPrice(slotDriver.price)}</span>
                    </p>
                  </>
                ) : (
                  <span className="gp-team-slot-empty">Kies coureur</span>
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
        <div className="gp-team-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Coureur kiezen">
          <div className="gp-team-dialog">
            <div className="gp-team-dialog-header">
              <h3>Kies coureur</h3>
              <button type="button" onClick={() => setActiveSlotIndex(null)} className="league-back-link">
                Sluiten
              </button>
            </div>

            {activeSlotDriverId ? (
              <button type="button" className="league-back-link gp-team-clear-button" onClick={clearSlot}>
                Slot leegmaken
              </button>
            ) : null}

            <div className="driver-team-grid gp-team-dialog-grid">
              {driversByTeam.map((team) => {
                const teamColors = getConstructorTeamColors(team.teamName);

                return (
                  <section
                    key={team.teamName}
                    className="driver-team-card"
                    aria-label={`Team ${team.teamName}`}
                    style={
                      {
                        "--team-accent": teamColors.accent,
                        "--team-accent-secondary": teamColors.accentSecondary,
                        "--team-bg-from": teamColors.backgroundFrom,
                        "--team-bg-to": teamColors.backgroundTo,
                      } as CSSProperties
                    }
                  >
                    <div className="driver-team-card-header">
                      <div className="driver-team-card-image">
                        <Image src={team.image} alt={`${team.name} wagen`} width={220} height={88} className="driver-team-card-image-asset" />
                      </div>
                      <h4>{team.teamName}</h4>
                    </div>
                    <ul>
                      {team.drivers.map((driver) => {
                        const isSelected = selectedDriverIds.includes(driver.id);
                        const canSelect = isDriverSelectableForActiveSlot(driver.id);

                        return (
                          <li key={driver.id} className={isSelected ? "selected-driver" : undefined}>
                            <button
                              type="button"
                              className={`gp-team-option ${canSelect ? "" : "disabled"}`.trim()}
                              disabled={!canSelect}
                              onClick={() => chooseDriverForSlot(driver.id)}
                            >
                              <span className="driver-grid">
                                <span>
                                  <strong>Coureur:</strong> {driver.name}
                                </span>
                                <span>
                                  <strong>Team:</strong> {driver.constructorTeam}
                                </span>
                                <span>
                                  <strong>Prijs:</strong> {formatPrice(driver.price)}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

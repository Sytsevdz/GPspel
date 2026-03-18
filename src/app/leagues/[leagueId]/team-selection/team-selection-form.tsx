"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { saveTeamSelection, type TeamSelectionActionState } from "@/app/actions/team-selection";
import { compareDriverStandings } from "@/lib/driver-pricing";
import { getConstructorTeamColors } from "@/lib/team-colors";
import { getTeamSelectionTeam } from "@/lib/team-selection-teams";
import { RaceCar } from "./race-car";

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

type TeamSelectionFormProps = {
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

const getDriverInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={disabled || pending}>
      {pending ? "Bezig met opslaan..." : "Team opslaan"}
    </button>
  );
}

export function TeamSelectionForm({
  leagueId,
  grandPrixId,
  drivers,
  initialSelectedDriverIds,
  savingDisabled = false,
  readOnly = false,
  showFallbackNotice = false,
}: TeamSelectionFormProps) {
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>(initialSelectedDriverIds);
  const [state, formAction] = useFormState(saveTeamSelection, INITIAL_STATE);

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

  const driversByTeam = useMemo(() => {
    const grouped = new Map<string, DriverWithPrice[]>();

    drivers.forEach((driver) => {
      const teamDrivers = grouped.get(driver.constructorTeam) ?? [];
      teamDrivers.push(driver);
      grouped.set(driver.constructorTeam, teamDrivers);
    });

    return Array.from(grouped.entries())
      .map(([teamName, teamDrivers]) => {
        const teamConfig = getTeamSelectionTeam(teamName);

        return {
          teamName,
          ...(teamConfig ?? {
            id: teamName.toLowerCase().replace(/\s+/g, ""),
            name: teamName,
            image: `/images/teams/${teamName} - car-side.png`,
          }),
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

  const toggleDriverSelection = (driverId: string) => {
    if (readOnly) {
      return;
    }
    setSelectedDriverIds((current) => {
      if (current.includes(driverId)) {
        return current.filter((id) => id !== driverId);
      }

      if (current.length >= REQUIRED_DRIVERS) {
        return current;
      }

      return [...current, driverId];
    });
  };

  return (
    <form action={formAction} className="team-selection-form">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="grand_prix_id" value={grandPrixId} />
      <input type="hidden" name="selected_driver_ids" value={selectedDriverIds.join(",")} />

      <section className="team-selection-summary">
        <h2>Geselecteerde coureurs</h2>
        {selectedDrivers.length > 0 ? (
          <ul className="selected-driver-cars" aria-label="Geselecteerde coureurs als racewagens">
            {selectedDriversForDisplay.map((driver) => {
              const teamColors = getConstructorTeamColors(driver.constructorTeam);

              return (
                <li key={driver.id}>
                  <div className="selected-driver-car">
                    <RaceCar
                      color={teamColors.accent}
                      accentColor={teamColors.accentSecondary}
                      label={getDriverInitials(driver.name)}
                    />
                  </div>
                  <p>
                    <strong>{driver.name}</strong>
                    <span>{driver.constructorTeam}</span>
                    <span>{formatPrice(driver.price)}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="league-list-empty">Nog geen coureurs geselecteerd.</p>
        )}

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

      <section className="team-selection-driver-list" aria-label="Coureurs">
        <h2>Coureurs</h2>
        <div className="driver-team-grid">
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
                <img src={team.image} alt={team.name} />
                <h3>{team.teamName}</h3>
                <ul>
                  {team.drivers.map((driver) => {
                    const isChecked = selectedDriverIds.includes(driver.id);
                    const limitReached = selectedDriverIds.length >= REQUIRED_DRIVERS;

                    return (
                      <li key={driver.id} className={isChecked ? "selected-driver" : undefined}>
                        <label>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleDriverSelection(driver.id)}
                            disabled={readOnly || (!isChecked && limitReached)}
                          />
                          <span className="driver-grid">
                            <span>
                              <strong>Coureur:</strong> {driver.name}
                            </span>
                            <span>
                              <strong>Prijs:</strong> {formatPrice(driver.price)}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </section>
    </form>
  );
}

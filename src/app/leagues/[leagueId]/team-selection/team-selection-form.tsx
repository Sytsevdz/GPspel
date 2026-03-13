"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { saveTeamSelection, type TeamSelectionActionState } from "@/app/actions/team-selection";

type DriverWithPrice = {
  id: string;
  name: string;
  constructorTeam: string;
  price: number;
};

type TeamSelectionFormProps = {
  leagueId: string;
  grandPrixId: string;
  drivers: DriverWithPrice[];
  initialSelectedDriverIds: string[];
};

const MAX_BUDGET = 1000;
const REQUIRED_DRIVERS = 4;
const INITIAL_STATE: TeamSelectionActionState = { status: "idle" };

const formatPrice = (price: number) => `${(price / 10).toFixed(1)}M`;

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={disabled || pending}>
      {pending ? "Bezig met opslaan..." : "Team opslaan"}
    </button>
  );
}

export function TeamSelectionForm({ leagueId, grandPrixId, drivers, initialSelectedDriverIds }: TeamSelectionFormProps) {
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>(initialSelectedDriverIds);
  const [state, formAction] = useFormState(saveTeamSelection, INITIAL_STATE);

  const selectedDrivers = useMemo(
    () => drivers.filter((driver) => selectedDriverIds.includes(driver.id)),
    [drivers, selectedDriverIds],
  );

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

  const canSave = validationErrors.length === 0;

  const toggleDriverSelection = (driverId: string) => {
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
          <ul className="selected-driver-list">
            {selectedDrivers.map((driver) => (
              <li key={driver.id}>
                <span>{driver.name}</span>
                <span>{formatPrice(driver.price)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="league-list-empty">Nog geen coureurs gekozen.</p>
        )}

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

        <SaveButton disabled={!canSave} />
      </section>

      <section className="team-selection-driver-list" aria-label="Beschikbare coureurs">
        <h2>Beschikbare coureurs</h2>
        <ul>
          {drivers.map((driver) => {
            const isChecked = selectedDriverIds.includes(driver.id);
            const limitReached = selectedDriverIds.length >= REQUIRED_DRIVERS;

            return (
              <li key={driver.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleDriverSelection(driver.id)}
                    disabled={!isChecked && limitReached}
                  />
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
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </form>
  );
}

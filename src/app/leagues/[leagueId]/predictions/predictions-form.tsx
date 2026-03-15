"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { savePrediction, type PredictionsActionState } from "@/app/actions/predictions";

type DriverOption = {
  id: string;
  name: string;
  constructorTeam: string;
};

type PredictionValues = {
  qualiP1: string;
  qualiP2: string;
  qualiP3: string;
  raceP1: string;
  raceP2: string;
  raceP3: string;
};

type PredictionsFormProps = {
  leagueId: string;
  grandPrixId: string;
  drivers: DriverOption[];
  initialValues: PredictionValues;
  readOnly?: boolean;
};

const INITIAL_STATE: PredictionsActionState = { status: "idle" };

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={disabled || pending}>
      {pending ? "Bezig met opslaan..." : "Voorspelling opslaan"}
    </button>
  );
}

const buildDriverLabel = (driver: DriverOption) => `${driver.name} (${driver.constructorTeam})`;

export function PredictionsForm({ leagueId, grandPrixId, drivers, initialValues, readOnly = false }: PredictionsFormProps) {
  const [state, formAction] = useFormState(savePrediction, INITIAL_STATE);

  const [values, setValues] = useState<PredictionValues>(initialValues);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (new Set([values.qualiP1, values.qualiP2, values.qualiP3]).size !== 3) {
      errors.push("Je mag binnen kwalificatie geen coureur dubbel kiezen");
    }

    if (new Set([values.raceP1, values.raceP2, values.raceP3]).size !== 3) {
      errors.push("Je mag binnen race geen coureur dubbel kiezen");
    }

    return errors;
  }, [values]);

  const canSave = validationErrors.length === 0 && !readOnly;

  const onChangeValue = (field: keyof PredictionValues, value: string) => {
    if (readOnly) {
      return;
    }

    setValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <form action={formAction} className="predictions-form">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="grand_prix_id" value={grandPrixId} />

      <section className="predictions-section">
        <h2>Kwalificatie</h2>

        <label className="predictions-field">
          Kwalificatie P1
          <select
            name="quali_p1"
            value={values.qualiP1}
            onChange={(event) => onChangeValue("qualiP1", event.target.value)}
            disabled={readOnly}
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {buildDriverLabel(driver)}
              </option>
            ))}
          </select>
        </label>

        <label className="predictions-field">
          Kwalificatie P2
          <select
            name="quali_p2"
            value={values.qualiP2}
            onChange={(event) => onChangeValue("qualiP2", event.target.value)}
            disabled={readOnly}
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {buildDriverLabel(driver)}
              </option>
            ))}
          </select>
        </label>

        <label className="predictions-field">
          Kwalificatie P3
          <select
            name="quali_p3"
            value={values.qualiP3}
            onChange={(event) => onChangeValue("qualiP3", event.target.value)}
            disabled={readOnly}
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {buildDriverLabel(driver)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="predictions-section">
        <h2>Race</h2>

        <label className="predictions-field">
          Race P1
          <select
            name="race_p1"
            value={values.raceP1}
            onChange={(event) => onChangeValue("raceP1", event.target.value)}
            disabled={readOnly}
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {buildDriverLabel(driver)}
              </option>
            ))}
          </select>
        </label>

        <label className="predictions-field">
          Race P2
          <select
            name="race_p2"
            value={values.raceP2}
            onChange={(event) => onChangeValue("raceP2", event.target.value)}
            disabled={readOnly}
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {buildDriverLabel(driver)}
              </option>
            ))}
          </select>
        </label>

        <label className="predictions-field">
          Race P3
          <select
            name="race_p3"
            value={values.raceP3}
            onChange={(event) => onChangeValue("raceP3", event.target.value)}
            disabled={readOnly}
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {buildDriverLabel(driver)}
              </option>
            ))}
          </select>
        </label>
      </section>

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

      {readOnly ? <p className="league-list-empty">Deze Grand Prix is gesloten. Je voorspelling is alleen-lezen.</p> : <SaveButton disabled={!canSave} />}
    </form>
  );
}

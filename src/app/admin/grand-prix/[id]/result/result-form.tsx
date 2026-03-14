"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { saveGrandPrixResult, type GrandPrixResultActionState } from "@/app/actions/grand-prix-results";

type DriverOption = {
  id: string;
  name: string;
  constructorTeam: string;
};

type ResultValues = {
  qualiP1: string;
  qualiP2: string;
  qualiP3: string;
  raceP1: string;
  raceP2: string;
  raceP3: string;
};

type ResultFormProps = {
  grandPrixId: string;
  drivers: DriverOption[];
  initialValues: ResultValues;
};

const INITIAL_STATE: GrandPrixResultActionState = { status: "idle" };

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return <button type="submit" disabled={disabled || pending}>{pending ? "Bezig met opslaan..." : "Uitslag opslaan"}</button>;
}

const buildDriverLabel = (driver: DriverOption) => `${driver.name} (${driver.constructorTeam})`;

export function ResultForm({ grandPrixId, drivers, initialValues }: ResultFormProps) {
  const [state, formAction] = useFormState(saveGrandPrixResult, INITIAL_STATE);
  const [values, setValues] = useState<ResultValues>(initialValues);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (new Set([values.qualiP1, values.qualiP2, values.qualiP3]).size !== 3) {
      errors.push("Binnen kwalificatie mag je geen coureur dubbel kiezen");
    }

    if (new Set([values.raceP1, values.raceP2, values.raceP3]).size !== 3) {
      errors.push("Binnen race mag je geen coureur dubbel kiezen");
    }

    return errors;
  }, [values]);

  const canSave = validationErrors.length === 0;

  const onChangeValue = (field: keyof ResultValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <form action={formAction} className="predictions-form">
      <input type="hidden" name="grand_prix_id" value={grandPrixId} />

      <section className="predictions-section">
        <h2>Kwalificatie</h2>

        <label className="predictions-field">
          P1
          <select name="quali_p1" value={values.qualiP1} onChange={(event) => onChangeValue("qualiP1", event.target.value)}>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {buildDriverLabel(driver)}
              </option>
            ))}
          </select>
        </label>

        <label className="predictions-field">
          P2
          <select name="quali_p2" value={values.qualiP2} onChange={(event) => onChangeValue("qualiP2", event.target.value)}>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {buildDriverLabel(driver)}
              </option>
            ))}
          </select>
        </label>

        <label className="predictions-field">
          P3
          <select name="quali_p3" value={values.qualiP3} onChange={(event) => onChangeValue("qualiP3", event.target.value)}>
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
          P1
          <select name="race_p1" value={values.raceP1} onChange={(event) => onChangeValue("raceP1", event.target.value)}>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {buildDriverLabel(driver)}
              </option>
            ))}
          </select>
        </label>

        <label className="predictions-field">
          P2
          <select name="race_p2" value={values.raceP2} onChange={(event) => onChangeValue("raceP2", event.target.value)}>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {buildDriverLabel(driver)}
              </option>
            ))}
          </select>
        </label>

        <label className="predictions-field">
          P3
          <select name="race_p3" value={values.raceP3} onChange={(event) => onChangeValue("raceP3", event.target.value)}>
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

      <SaveButton disabled={!canSave} />
    </form>
  );
}

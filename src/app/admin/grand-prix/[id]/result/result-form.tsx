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
  qualificationOrder: string[];
  raceOrder: string[];
};

type ResultField = keyof ResultValues;

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

function ReorderList({
  title,
  pasteLabel,
  pasteButtonLabel,
  order,
  driversById,
  pasteValue,
  pasteError,
  onPasteChange,
  onImport,
  onMove,
}: {
  title: string;
  pasteLabel: string;
  pasteButtonLabel: string;
  order: string[];
  driversById: Map<string, DriverOption>;
  pasteValue: string;
  pasteError: string | null;
  onPasteChange: (value: string) => void;
  onImport: () => void;
  onMove: (fromIndex: number, toIndex: number) => void;
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  return (
    <section className="predictions-section">
      <h2>{title}</h2>

      <div className="result-import">
        <label className="predictions-field">
          <span>{pasteLabel}</span>
          <textarea value={pasteValue} onChange={(event) => onPasteChange(event.target.value)} rows={6} />
        </label>
        <button type="button" onClick={onImport}>
          {pasteButtonLabel}
        </button>
        {pasteError && (
          <p className="form-message error" role="alert">
            {pasteError}
          </p>
        )}
      </div>

      <ol className="result-rankings-list">
        {order.map((driverId, index) => {
          const driver = driversById.get(driverId);

          if (!driver) {
            return null;
          }

          return (
            <li
              key={driverId}
              className="result-rankings-item"
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedIndex === null) {
                  return;
                }

                onMove(draggedIndex, index);
                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
            >
              <span className="result-position">{index + 1}</span>
              <span>{buildDriverLabel(driver)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function ResultForm({ grandPrixId, drivers, initialValues }: ResultFormProps) {
  const [state, formAction] = useFormState(saveGrandPrixResult, INITIAL_STATE);
  const [values, setValues] = useState<ResultValues>(initialValues);
  const [pasteValues, setPasteValues] = useState<Record<ResultField, string>>({
    qualificationOrder: "",
    raceOrder: "",
  });
  const [pasteErrors, setPasteErrors] = useState<Record<ResultField, string | null>>({
    qualificationOrder: null,
    raceOrder: null,
  });

  const driversById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (values.qualificationOrder.length !== drivers.length || new Set(values.qualificationOrder).size !== drivers.length) {
      errors.push("Binnen kwalificatie moet elke actieve coureur precies één positie hebben");
    }

    if (values.raceOrder.length !== drivers.length || new Set(values.raceOrder).size !== drivers.length) {
      errors.push("Binnen race moet elke actieve coureur precies één positie hebben");
    }

    return errors;
  }, [drivers.length, values]);

  const canSave = validationErrors.length === 0;

  const moveInList = (field: ResultField, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return;
    }

    setValues((current) => {
      const next = [...current[field]];
      const [moved] = next.splice(fromIndex, 1);

      if (!moved) {
        return current;
      }

      next.splice(toIndex, 0, moved);

      return {
        ...current,
        [field]: next,
      };
    });
  };

  const normalizeDriverName = (name: string) =>
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("nl-NL")
      .trim();

  const cleanPastedLine = (line: string) => line.replace(/^\s*(?:(?:\d+\s*[.):-]?\s*)|(?:[-–—•*]\s*))+/u, "").trim();

  const importOrder = (field: ResultField) => {
    const pastedLines = pasteValues[field]
      .split("\n")
      .map(cleanPastedLine)
      .filter((line) => line.length > 0);

    if (pastedLines.length !== 22 || pastedLines.length !== drivers.length) {
      setPasteErrors((current) => ({
        ...current,
        [field]: "Niet exact 22 coureurs gevonden in de geplakte lijst.",
      }));
      return;
    }

    const driverIdsByName = new Map(drivers.map((driver) => [normalizeDriverName(driver.name), driver.id]));
    const nextOrder: string[] = [];
    const seenDrivers = new Set<string>();

    for (const pastedLine of pastedLines) {
      const driverId = driverIdsByName.get(normalizeDriverName(pastedLine));

      if (!driverId) {
        setPasteErrors((current) => ({
          ...current,
          [field]: `Onbekende coureur in de lijst: \"${pastedLine}\".`,
        }));
        return;
      }

      if (seenDrivers.has(driverId)) {
        setPasteErrors((current) => ({
          ...current,
          [field]: `Dubbele coureur gevonden in de lijst: \"${pastedLine}\".`,
        }));
        return;
      }

      seenDrivers.add(driverId);
      nextOrder.push(driverId);
    }

    setValues((current) => ({
      ...current,
      [field]: nextOrder,
    }));
    setPasteErrors((current) => ({
      ...current,
      [field]: null,
    }));
  };

  return (
    <form action={formAction} className="predictions-form">
      <input type="hidden" name="grand_prix_id" value={grandPrixId} />
      <input type="hidden" name="qualification_order" value={values.qualificationOrder.join(",")} />
      <input type="hidden" name="race_order" value={values.raceOrder.join(",")} />

      <ReorderList
        title="Kwalificatie"
        pasteLabel="Plak kwalificatievolgorde"
        pasteButtonLabel="Verwerk kwalificatie"
        order={values.qualificationOrder}
        driversById={driversById}
        pasteValue={pasteValues.qualificationOrder}
        pasteError={pasteErrors.qualificationOrder}
        onPasteChange={(value) =>
          setPasteValues((current) => ({
            ...current,
            qualificationOrder: value,
          }))
        }
        onImport={() => importOrder("qualificationOrder")}
        onMove={(from, to) => moveInList("qualificationOrder", from, to)}
      />

      <ReorderList
        title="Race"
        pasteLabel="Plak racevolgorde"
        pasteButtonLabel="Verwerk race"
        order={values.raceOrder}
        driversById={driversById}
        pasteValue={pasteValues.raceOrder}
        pasteError={pasteErrors.raceOrder}
        onPasteChange={(value) =>
          setPasteValues((current) => ({
            ...current,
            raceOrder: value,
          }))
        }
        onImport={() => importOrder("raceOrder")}
        onMove={(from, to) => moveInList("raceOrder", from, to)}
      />

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

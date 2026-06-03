"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import {
  saveGrandPrixResult,
  type GrandPrixResultActionState,
} from "@/app/actions/grand-prix-results";
import { FastestPitstopBonusCard } from "@/app/fastest-pitstop-bonus-card";
import { getTeamSideImageSize } from "@/lib/team-side-view-images";
import { resolveTeamSelectionTeam } from "@/lib/team-selection-teams";

type DriverOption = {
  id: string;
  name: string;
  constructorTeam: string;
};

type ResultValues = {
  qualificationOrder: string[];
  sprintQualificationOrder: string[];
  sprintRaceOrder: string[];
  raceOrder: string[];
  fastestPitstopTeam: string;
};

type ResultField = Exclude<keyof ResultValues, "fastestPitstopTeam">;

type ResultFormProps = {
  grandPrixId: string;
  isSprintWeekend: boolean;
  drivers: DriverOption[];
  initialValues: ResultValues;
  constructorTeams: string[];
};

const INITIAL_STATE: GrandPrixResultActionState = { status: "idle" };

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={disabled || pending}>
      {pending ? "Bezig met opslaan..." : "Uitslag opslaan"}
    </button>
  );
}

const buildDriverLabel = (driver: DriverOption) =>
  `${driver.name} (${driver.constructorTeam})`;

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
          <textarea
            value={pasteValue}
            onChange={(event) => onPasteChange(event.target.value)}
            rows={6}
          />
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

export function ResultForm({
  grandPrixId,
  isSprintWeekend,
  drivers,
  initialValues,
  constructorTeams,
}: ResultFormProps) {
  const [state, formAction] = useFormState(saveGrandPrixResult, INITIAL_STATE);
  const [values, setValues] = useState<ResultValues>(initialValues);
  const [pasteValues, setPasteValues] = useState<Record<ResultField, string>>({
    qualificationOrder: "",
    sprintQualificationOrder: "",
    sprintRaceOrder: "",
    raceOrder: "",
  });
  const [pasteErrors, setPasteErrors] = useState<
    Record<ResultField, string | null>
  >({
    qualificationOrder: null,
    sprintQualificationOrder: null,
    sprintRaceOrder: null,
    raceOrder: null,
  });

  const [isFastestPitstopPickerOpen, setIsFastestPitstopPickerOpen] =
    useState(false);

  const driversById = useMemo(
    () => new Map(drivers.map((driver) => [driver.id, driver])),
    [drivers],
  );

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (
      values.qualificationOrder.length !== drivers.length ||
      new Set(values.qualificationOrder).size !== drivers.length
    ) {
      errors.push(
        "Binnen kwalificatie moet elke actieve coureur precies één positie hebben",
      );
    }

    if (
      values.raceOrder.length !== drivers.length ||
      new Set(values.raceOrder).size !== drivers.length
    ) {
      errors.push(
        "Binnen race moet elke actieve coureur precies één positie hebben",
      );
    }
    if (
      isSprintWeekend &&
      (values.sprintQualificationOrder.length !== drivers.length ||
        new Set(values.sprintQualificationOrder).size !== drivers.length)
    ) {
      errors.push(
        "Binnen sprint kwalificatie moet elke actieve coureur precies één positie hebben",
      );
    }
    if (
      isSprintWeekend &&
      (values.sprintRaceOrder.length !== drivers.length ||
        new Set(values.sprintRaceOrder).size !== drivers.length)
    ) {
      errors.push(
        "Binnen sprint race moet elke actieve coureur precies één positie hebben",
      );
    }

    return errors;
  }, [drivers.length, isSprintWeekend, values]);

  const canSave = validationErrors.length === 0;

  const moveInList = (
    field: ResultField,
    fromIndex: number,
    toIndex: number,
  ) => {
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

  const cleanPastedLine = (line: string) =>
    line.replace(/^\s*(?:(?:\d+\s*[.):-]?\s*)|(?:[-–—•*]\s*))+/u, "").trim();

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

    const driverIdsByName = new Map(
      drivers.map((driver) => [normalizeDriverName(driver.name), driver.id]),
    );
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
      <input
        type="hidden"
        name="qualification_order"
        value={values.qualificationOrder.join(",")}
      />
      <input
        type="hidden"
        name="sprint_qualification_order"
        value={isSprintWeekend ? values.sprintQualificationOrder.join(",") : ""}
      />
      <input
        type="hidden"
        name="sprint_race_order"
        value={isSprintWeekend ? values.sprintRaceOrder.join(",") : ""}
      />
      <input
        type="hidden"
        name="race_order"
        value={values.raceOrder.join(",")}
      />

      <section className="predictions-section bonus-results-section">
        <div className="predictions-section-header">
          <h2>Bonusresultaten</h2>
          <p>
            Leg het constructorteam vast dat officieel de snelste pitstop reed.
          </p>
        </div>
        <input
          type="hidden"
          name="fastest_pitstop_team"
          value={values.fastestPitstopTeam}
        />
        <FastestPitstopBonusCard
          title="Snelste pitstop-team"
          subtitle="Selecteer het team dat de bonusuitslag bepaalt."
          selectedTeam={values.fastestPitstopTeam}
          helperText="Dit veld gebruikt dezelfde teamlijst als de voorspelling en wijzigt geen scoringslogica."
          onOpenPicker={() => setIsFastestPitstopPickerOpen(true)}
        />
      </section>

      {isFastestPitstopPickerOpen ? (
        <div
          className="podium-selection-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsFastestPitstopPickerOpen(false);
            }
          }}
        >
          <div
            className="podium-selection-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Kies team voor snelste pitstop"
          >
            <div className="podium-selection-panel-header">
              <div>
                <h3>Kies snelste pitstop-team</h3>
                <p>Bonusresultaten</p>
              </div>
              <button
                type="button"
                className="podium-selection-close"
                onClick={() => setIsFastestPitstopPickerOpen(false)}
              >
                Sluiten
              </button>
            </div>

            <div className="podium-driver-options fastest-pitstop-team-options">
              {constructorTeams.map((teamName) => {
                const team = resolveTeamSelectionTeam(teamName);
                const imageSize = getTeamSideImageSize("modalOption");
                const isSelected = values.fastestPitstopTeam === teamName;

                return (
                  <button
                    key={teamName}
                    type="button"
                    className={`podium-driver-option fastest-pitstop-team-option ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setValues((current) => ({
                        ...current,
                        fastestPitstopTeam: teamName,
                      }));
                      setIsFastestPitstopPickerOpen(false);
                    }}
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
                      <strong>{team.name}</strong>
                      <span>{isSelected ? "Geselecteerd" : "Kies dit team"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

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

      {isSprintWeekend ? (
        <ReorderList
          title="Sprint kwalificatie"
          pasteLabel="Plak sprint kwalificatievolgorde"
          pasteButtonLabel="Verwerk sprint kwalificatie"
          order={values.sprintQualificationOrder}
          driversById={driversById}
          pasteValue={pasteValues.sprintQualificationOrder}
          pasteError={pasteErrors.sprintQualificationOrder}
          onPasteChange={(value) =>
            setPasteValues((current) => ({
              ...current,
              sprintQualificationOrder: value,
            }))
          }
          onImport={() => importOrder("sprintQualificationOrder")}
          onMove={(from, to) =>
            moveInList("sprintQualificationOrder", from, to)
          }
        />
      ) : null}

      {isSprintWeekend ? (
        <ReorderList
          title="Sprint race"
          pasteLabel="Plak sprint racevolgorde"
          pasteButtonLabel="Verwerk sprint race"
          order={values.sprintRaceOrder}
          driversById={driversById}
          pasteValue={pasteValues.sprintRaceOrder}
          pasteError={pasteErrors.sprintRaceOrder}
          onPasteChange={(value) =>
            setPasteValues((current) => ({
              ...current,
              sprintRaceOrder: value,
            }))
          }
          onImport={() => importOrder("sprintRaceOrder")}
          onMove={(from, to) => moveInList("sprintRaceOrder", from, to)}
        />
      ) : null}

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
        <p
          className={`form-message ${state.status === "success" ? "success" : "error"}`}
        >
          {state.message}
        </p>
      )}

      <SaveButton disabled={!canSave} />
    </form>
  );
}

"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { savePrediction, type PredictionsActionState } from "@/app/actions/predictions";
import { resolveTeamSelectionTeam } from "@/lib/team-selection-teams";

type DriverOption = {
  id: string;
  name: string;
  constructorTeam: string;
  seasonScore?: number;
  performanceRank?: number;
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

type PredictionField = keyof PredictionValues;

type PodiumSlotConfig = {
  field: PredictionField;
  inputName: string;
  label: string;
  position: "P1" | "P2" | "P3";
  rankLabel: string;
  heightClassName: string;
  slotClassName: string;
};

type PodiumSectionConfig = {
  id: "quali" | "race";
  title: string;
  slots: PodiumSlotConfig[];
};

const INITIAL_STATE: PredictionsActionState = { status: "idle" };

const PODIUM_SECTIONS: PodiumSectionConfig[] = [
  {
    id: "quali",
    title: "Kwalificatie",
    slots: [
      {
        field: "qualiP2",
        inputName: "quali_p2",
        label: "Kwalificatie P2",
        position: "P2",
        rankLabel: "Tweede plek",
        heightClassName: "podium-step-p2",
        slotClassName: "podium-slot--p2",
      },
      {
        field: "qualiP1",
        inputName: "quali_p1",
        label: "Kwalificatie P1",
        position: "P1",
        rankLabel: "Pole position",
        heightClassName: "podium-step-p1",
        slotClassName: "podium-slot--p1",
      },
      {
        field: "qualiP3",
        inputName: "quali_p3",
        label: "Kwalificatie P3",
        position: "P3",
        rankLabel: "Derde plek",
        heightClassName: "podium-step-p3",
        slotClassName: "podium-slot--p3",
      },
    ],
  },
  {
    id: "race",
    title: "Race",
    slots: [
      {
        field: "raceP2",
        inputName: "race_p2",
        label: "Race P2",
        position: "P2",
        rankLabel: "Tweede plek",
        heightClassName: "podium-step-p2",
        slotClassName: "podium-slot--p2",
      },
      {
        field: "raceP1",
        inputName: "race_p1",
        label: "Race P1",
        position: "P1",
        rankLabel: "Winnaar",
        heightClassName: "podium-step-p1",
        slotClassName: "podium-slot--p1",
      },
      {
        field: "raceP3",
        inputName: "race_p3",
        label: "Race P3",
        position: "P3",
        rankLabel: "Derde plek",
        heightClassName: "podium-step-p3",
        slotClassName: "podium-slot--p3",
      },
    ],
  },
];

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="predictions-submit-button" disabled={disabled || pending}>
      {pending ? "Bezig met opslaan..." : "Voorspelling opslaan"}
    </button>
  );
}

const getSectionSelections = (values: PredictionValues, sectionId: PodiumSectionConfig["id"]) =>
  sectionId === "quali" ? [values.qualiP1, values.qualiP2, values.qualiP3] : [values.raceP1, values.raceP2, values.raceP3];

export function PredictionsForm({ leagueId, grandPrixId, drivers, initialValues, readOnly = false }: PredictionsFormProps) {
  const [state, formAction] = useFormState(savePrediction, INITIAL_STATE);
  const [values, setValues] = useState<PredictionValues>(initialValues);
  const [activeField, setActiveField] = useState<PredictionField | null>(null);

  const driversById = useMemo(() => new Map(drivers.map((driver) => [driver.id, driver])), [drivers]);
  const sortedDrivers = useMemo(() => {
    const groupedDrivers = new Map<string, DriverOption[]>();

    drivers.forEach((driver) => {
      const teamDrivers = groupedDrivers.get(driver.constructorTeam) ?? [];
      teamDrivers.push(driver);
      groupedDrivers.set(driver.constructorTeam, teamDrivers);
    });

    return Array.from(groupedDrivers.entries())
      .map(([teamName, teamDrivers]) => ({
        teamName,
        drivers: [...teamDrivers].sort((left, right) => {
          const leftRank = left.performanceRank ?? Number.POSITIVE_INFINITY;
          const rightRank = right.performanceRank ?? Number.POSITIVE_INFINITY;

          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }

          return left.name.localeCompare(right.name, "nl-NL");
        }),
        teamScore: teamDrivers.reduce((total, driver) => total + (driver.seasonScore ?? 0), 0),
      }))
      .sort((left, right) => {
        if (right.teamScore !== left.teamScore) {
          return right.teamScore - left.teamScore;
        }

        return left.teamName.localeCompare(right.teamName, "nl-NL");
      })
      .flatMap((team) => team.drivers);
  }, [drivers]);

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    const qualificationSelections = [values.qualiP1, values.qualiP2, values.qualiP3];
    const raceSelections = [values.raceP1, values.raceP2, values.raceP3];

    const filledQualificationSelections = qualificationSelections.filter(Boolean);
    if (new Set(filledQualificationSelections).size !== filledQualificationSelections.length) {
      errors.push("Je mag binnen kwalificatie geen coureur dubbel kiezen");
    }

    const filledRaceSelections = raceSelections.filter(Boolean);
    if (new Set(filledRaceSelections).size !== filledRaceSelections.length) {
      errors.push("Je mag binnen race geen coureur dubbel kiezen");
    }

    return errors;
  }, [values]);

  const hasAllSelections = Object.values(values).every(Boolean);
  const canSave = hasAllSelections && validationErrors.length === 0 && !readOnly;

  const onChangeValue = (field: PredictionField, value: string) => {
    if (readOnly) {
      return;
    }

    setValues((current) => ({ ...current, [field]: value }));
  };

  return (
    <form action={formAction} className="predictions-form">
      <input type="hidden" name="league_id" value={leagueId} />
      <input type="hidden" name="grand_prix_id" value={grandPrixId} />

      {PODIUM_SECTIONS.map((section) => {
        const sectionSelections = getSectionSelections(values, section.id);
        const activeSlot = section.slots.find((slot) => slot.field === activeField);

        return (
          <section key={section.id} className="predictions-section">
            <div className="predictions-section-header">
              <h2>{section.title}</h2>
              {!readOnly ? <p>Klik op een podiumplek om een coureur te kiezen of aan te passen.</p> : null}
            </div>

            <div className="podium-grid" aria-label={`${section.title} podium`}>
              {section.slots.map((slot) => {
                const selectedDriverId = values[slot.field];
                const selectedDriver = selectedDriverId ? driversById.get(selectedDriverId) : null;
                const selectedTeam = selectedDriver ? resolveTeamSelectionTeam(selectedDriver.constructorTeam) : null;
                const isActive = activeField === slot.field;
                const slotClasses = [
                  "podium-slot",
                  slot.heightClassName,
                  slot.slotClassName,
                  selectedDriver ? "filled" : "empty",
                  isActive ? "active" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                const slotContent = (
                  <>
                    <div className="podium-slot-content">
                      <div className="podium-slot-heading">
                        <span className="podium-slot-position">{slot.position}</span>
                        <span className="podium-slot-rank-label">{slot.rankLabel}</span>
                      </div>
                      <div className="podium-slot-visual">
                        {selectedDriver && selectedTeam ? (
                          <>
                            <div className="podium-car-image-wrapper">
                              <Image
                                src={selectedTeam.image}
                                alt={`${selectedTeam.name} wagen`}
                                width={260}
                                height={104}
                                className="podium-car-image"
                              />
                            </div>
                            <div className="podium-slot-copy">
                              <strong>{selectedDriver.name}</strong>
                              <span>{selectedDriver.constructorTeam}</span>
                            </div>
                          </>
                        ) : (
                          <div className="podium-slot-placeholder">
                            <strong>{slot.label}</strong>
                            <span>Nog geen coureur gekozen</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="podium-step-label">{slot.label}</div>
                  </>
                );

                return readOnly ? (
                  <div key={slot.field} className={slotClasses}>
                    {slotContent}
                    <input type="hidden" name={slot.inputName} value={selectedDriverId} />
                  </div>
                ) : (
                  <button
                    key={slot.field}
                    type="button"
                    className={slotClasses}
                    onClick={() => setActiveField(slot.field)}
                    aria-pressed={isActive}
                  >
                    {slotContent}
                    <input type="hidden" name={slot.inputName} value={selectedDriverId} />
                  </button>
                );
              })}
            </div>

            {!readOnly && activeSlot ? (
              <div className="podium-selection-panel" role="group" aria-label={`${activeSlot.label} kiezen`}>
                <div className="podium-selection-panel-header">
                  <div>
                    <h3>{activeSlot.label}</h3>
                    <p>Kies een coureur voor deze podiumplek.</p>
                  </div>
                  <button type="button" className="podium-selection-close" onClick={() => setActiveField(null)}>
                    Sluiten
                  </button>
                </div>

                <div className="podium-driver-options">
                  {sortedDrivers.map((driver) => {
                    const team = resolveTeamSelectionTeam(driver.constructorTeam);
                    const currentSelection = values[activeSlot.field];
                    const selectedElsewhere =
                      sectionSelections.includes(driver.id) && currentSelection !== driver.id;
                    const isSelected = currentSelection === driver.id;

                    return (
                      <button
                        key={`${activeSlot.field}-${driver.id}`}
                        type="button"
                        className={`podium-driver-option ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          onChangeValue(activeSlot.field, driver.id);
                          setActiveField(null);
                        }}
                        disabled={selectedElsewhere}
                      >
                        <div className="podium-driver-option-image">
                          <Image src={team.image} alt={`${team.name} wagen`} width={220} height={88} className="podium-driver-option-car" />
                        </div>
                        <div className="podium-driver-option-copy">
                          <strong>{driver.name}</strong>
                          <span>{driver.constructorTeam}</span>
                          {selectedElsewhere ? <span>Al gekozen in dit podium</span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        );
      })}

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

      {!readOnly && !hasAllSelections ? <p className="league-list-empty">Vul alle podiumplekken in om je voorspelling op te slaan.</p> : null}

      {readOnly ? <p className="league-list-empty">Deze Grand Prix is gesloten. Je voorspelling is alleen-lezen.</p> : <SaveButton disabled={!canSave} />}
    </form>
  );
}

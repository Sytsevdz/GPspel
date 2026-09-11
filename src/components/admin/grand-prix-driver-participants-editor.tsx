"use client";

import { useState } from "react";

type DriverOption = {
  id: string;
  name: string;
};

type ParticipantAssignment = {
  constructorTeam: string;
  driverIds: [string, string];
};

type GrandPrixDriverParticipantsEditorProps = {
  action: (formData: FormData) => void;
  assignments: ParticipantAssignment[];
  drivers: DriverOption[];
};

const getSlotKey = (constructorTeam: string, slot: number) =>
  `${constructorTeam}:${slot}`;

export function GrandPrixDriverParticipantsEditor({
  action,
  assignments,
  drivers,
}: GrandPrixDriverParticipantsEditorProps) {
  const [slotValues, setSlotValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      assignments.flatMap((assignment) =>
        assignment.driverIds.map((driverId, index) => [
          getSlotKey(assignment.constructorTeam, index + 1),
          driverId,
        ]),
      ),
    ),
  );

  const selectDriver = (slotKey: string, driverId: string) => {
    setSlotValues((current) => {
      const next = { ...current };

      if (driverId) {
        Object.entries(next).forEach(([otherSlotKey, selectedDriverId]) => {
          if (otherSlotKey !== slotKey && selectedDriverId === driverId) {
            next[otherSlotKey] = "";
          }
        });
      }

      next[slotKey] = driverId;
      return next;
    });
  };

  return (
    <form action={action} className="predictions-form" noValidate>
      {assignments.map((assignment) => (
        <fieldset key={assignment.constructorTeam} className="predictions-section">
          <input
            type="hidden"
            name="constructor_team"
            value={assignment.constructorTeam}
          />
          <legend>
            <strong>{assignment.constructorTeam}</strong>
          </legend>
          {[1, 2].map((slot) => {
            const slotKey = getSlotKey(assignment.constructorTeam, slot);
            return (
              <label key={slot} className="predictions-field">
                <span>Driver {slot}</span>
                <select
                  name={`driver_${assignment.constructorTeam}_${slot}`}
                  value={slotValues[slotKey] ?? ""}
                  onChange={(event) => selectDriver(slotKey, event.target.value)}
                  required
                >
                  <option value="">Kies coureur</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.name}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </fieldset>
      ))}
      <div className="admin-action-stack">
        <button type="submit" name="intent" value="save">
          GP-deelnemers opslaan
        </button>
        <button type="submit" name="intent" value="clear" formNoValidate>
          Automatische standaard herstellen
        </button>
      </div>
    </form>
  );
}

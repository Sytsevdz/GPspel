"use client";

import { useFormState, useFormStatus } from "react-dom";

import {
  publishGrandPrixFinalScores,
  publishGrandPrixQualificationScores,
  type GrandPrixResultActionState,
} from "@/app/actions/grand-prix-results";

const INITIAL_STATE: GrandPrixResultActionState = { status: "idle" };

function PublishButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return <button type="submit">{pending ? pendingLabel : label}</button>;
}

export function PublishScoreActions({ grandPrixId }: { grandPrixId: string }) {
  const [qualificationState, qualificationAction] = useFormState(publishGrandPrixQualificationScores, INITIAL_STATE);
  const [finalState, finalAction] = useFormState(publishGrandPrixFinalScores, INITIAL_STATE);

  return (
    <section className="predictions-section">
      <h2>Punten publiceren</h2>
      <p>Publiceer eerst kwalificatiepunten en later de volledige racepunten.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", alignItems: "flex-start" }}>
        <form action={qualificationAction}>
          <input type="hidden" name="grand_prix_id" value={grandPrixId} />
          <PublishButton label="Publiceer kwalificatiepunten" pendingLabel="Publiceren..." />
        </form>
        {qualificationState.status !== "idle" && qualificationState.message && (
          <p className={`form-message ${qualificationState.status === "success" ? "success" : "error"}`}>
            {qualificationState.message}
          </p>
        )}

        <form action={finalAction}>
          <input type="hidden" name="grand_prix_id" value={grandPrixId} />
          <PublishButton label="Publiceer eindscore" pendingLabel="Publiceren..." />
        </form>
        {finalState.status !== "idle" && finalState.message && (
          <p className={`form-message ${finalState.status === "success" ? "success" : "error"}`}>{finalState.message}</p>
        )}
      </div>
    </section>
  );
}

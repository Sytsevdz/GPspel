"use client";

import { useFormState, useFormStatus } from "react-dom";

import { ConfirmSubmitButton } from "@/app/admin/confirm-submit-button";
import {
  publishGrandPrixFinalScores,
  publishGrandPrixQualificationScores,
  publishGrandPrixSprintQualificationScores,
  publishGrandPrixSprintRaceScores,
  resetGrandPrixPlayerScores,
  type GrandPrixResultActionState,
} from "@/app/actions/grand-prix-results";

const INITIAL_STATE: GrandPrixResultActionState = { status: "idle" };

function PublishButton({ label, pendingLabel, disabled = false }: { label: string; pendingLabel: string; disabled?: boolean }) {
  const { pending } = useFormStatus();

  return <button type="submit" disabled={disabled || pending}>{pending ? pendingLabel : label}</button>;
}

function ActionFeedback({ status, message }: GrandPrixResultActionState) {
  if (status === "idle" || !message) {
    return null;
  }

  return <p className={`form-message ${status === "success" ? "success" : "error"}`}>{message}</p>;
}

export function PublishScoreActions({ grandPrixId, disabled = false }: { grandPrixId: string; disabled?: boolean }) {
  const [qualificationState, qualificationAction] = useFormState(publishGrandPrixQualificationScores, INITIAL_STATE);
  const [sprintQualificationState, sprintQualificationAction] = useFormState(
    publishGrandPrixSprintQualificationScores,
    INITIAL_STATE,
  );
  const [sprintRaceState, sprintRaceAction] = useFormState(publishGrandPrixSprintRaceScores, INITIAL_STATE);
  const [finalState, finalAction] = useFormState(publishGrandPrixFinalScores, INITIAL_STATE);
  const [resetState, resetAction] = useFormState(resetGrandPrixPlayerScores, INITIAL_STATE);

  return (
    <section className="predictions-section">
      <h2>Scores spelers</h2>
      <p>Publiceer de spelerspunten in fases. Elke fase blijft een aparte handeling.</p>
      {disabled ? <p className="league-list-empty">Deze GP is geannuleerd. Publicatie van scores is uitgeschakeld.</p> : null}

      <div className="admin-action-stack">
        <form action={sprintQualificationAction}>
          <input type="hidden" name="grand_prix_id" value={grandPrixId} />
          <PublishButton label="Sprint kwalificatie publiceren" pendingLabel="Publiceren..." disabled={disabled} />
        </form>
        <ActionFeedback {...sprintQualificationState} />

        <form action={sprintRaceAction}>
          <input type="hidden" name="grand_prix_id" value={grandPrixId} />
          <PublishButton label="Sprint race publiceren" pendingLabel="Publiceren..." disabled={disabled} />
        </form>
        <ActionFeedback {...sprintRaceState} />

        <form action={qualificationAction}>
          <input type="hidden" name="grand_prix_id" value={grandPrixId} />
          <PublishButton label="Kwalificatie publiceren" pendingLabel="Publiceren..." disabled={disabled} />
        </form>
        <ActionFeedback {...qualificationState} />

        <form action={finalAction}>
          <input type="hidden" name="grand_prix_id" value={grandPrixId} />
          <PublishButton label="Race publiceren" pendingLabel="Publiceren..." disabled={disabled} />
        </form>
        <ActionFeedback {...finalState} />

        <form action={resetAction}>
          <input type="hidden" name="grand_prix_id" value={grandPrixId} />
          <ConfirmSubmitButton
            confirmMessage="Weet je zeker dat je alle spelerspunten voor deze Grand Prix wilt resetten?"
            label="Punten resetten voor spelers"
            disabled={disabled}
          />
        </form>
        <ActionFeedback {...resetState} />
      </div>
    </section>
  );
}

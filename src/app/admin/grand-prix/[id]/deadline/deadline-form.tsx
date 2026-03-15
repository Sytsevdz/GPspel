"use client";

import { useFormState, useFormStatus } from "react-dom";

import { updateGrandPrixDeadline, type DeadlineActionState } from "@/app/actions/grand-prix-deadlines";

type DeadlineFormProps = {
  grandPrixId: string;
  initialDeadline: string;
  initialQualificationStart: string;
};

const INITIAL_STATE: DeadlineActionState = {
  status: "idle",
};

function SaveButton() {
  const { pending } = useFormStatus();

  return <button type="submit" disabled={pending}>{pending ? "Bezig met opslaan..." : "Opslaan"}</button>;
}

export function DeadlineForm({ grandPrixId, initialDeadline, initialQualificationStart }: DeadlineFormProps) {
  const [state, formAction] = useFormState(updateGrandPrixDeadline, INITIAL_STATE);

  return (
    <form action={formAction} className="predictions-form">
      <input type="hidden" name="grand_prix_id" value={grandPrixId} />

      <label className="predictions-field">
        <span>Deadline</span>
        <input type="datetime-local" name="deadline" defaultValue={initialDeadline} required />
      </label>

      <label className="predictions-field">
        <span>Kwalificatie start</span>
        <input type="datetime-local" name="qualification_start" defaultValue={initialQualificationStart} required />
      </label>

      {state.status !== "idle" && state.message ? (
        <p className={`form-message ${state.status === "success" ? "success" : "error"}`}>{state.message}</p>
      ) : null}

      <SaveButton />
    </form>
  );
}

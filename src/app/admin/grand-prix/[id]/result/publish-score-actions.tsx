"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { reportResultWorkflow } from "../workflow-controller";
import { ConfirmSubmitButton } from "@/app/admin/confirm-submit-button";
import {
  publishGrandPrixFinalScores,
  publishGrandPrixQualificationScores,
  publishGrandPrixSprintQualificationScores,
  publishGrandPrixSprintRaceScores,
  resetGrandPrixPlayerScores,
  type GrandPrixResultActionState,
} from "@/app/actions/grand-prix-results";

const actions = {
  qualification: { action: publishGrandPrixQualificationScores, label: "Kwalificatie publiceren" },
  sprintQualification: { action: publishGrandPrixSprintQualificationScores, label: "Sprint kwalificatie publiceren" },
  sprintRace: { action: publishGrandPrixSprintRaceScores, label: "Sprint race publiceren" },
  final: { action: publishGrandPrixFinalScores, label: "Race publiceren" },
  reset: { action: resetGrandPrixPlayerScores, label: "Punten resetten voor spelers" },
};
type Phase = keyof typeof actions;
type Props = {
  grandPrixId: string;
  isSprintWeekend: boolean;
  disabled?: boolean;
  phase?: Phase;
  onPublished?: (phase: Phase) => void;
  onFailed?: (phase: Phase) => void;
};
const INITIAL_STATE: GrandPrixResultActionState = { status: "idle" };

function PublishButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={disabled || pending}>{pending ? "Publiceren..." : label}</button>;
}

function PhaseAction({ grandPrixId, isSprintWeekend, disabled, phase, onPublished, onFailed }: Props & { phase: Phase }) {
  const [state, action] = useFormState(async (previous: GrandPrixResultActionState, data: FormData): Promise<GrandPrixResultActionState> => {
    try {
      return await actions[phase].action(previous, data);
    } catch {
      // Score actions can throw when a database request fails. Keep the editor
      // mounted and expose a retry, without treating a partial write as success.
      return { status: "error", message: phase === "reset" ? "Punten resetten mislukt. Probeer opnieuw." : "Publiceren mislukt. Probeer opnieuw." };
    }
  }, INITIAL_STATE);
  useEffect(() => {
    if (state.status === "success") {
      reportResultWorkflow(grandPrixId, phase, isSprintWeekend);
      onPublished?.(phase);
    } else if (state.status === "error") {
      onFailed?.(phase);
    }
  }, [state, grandPrixId, phase, isSprintWeekend, onPublished, onFailed]);
  return <div className="admin-action-stack">
    <form action={action}>
      <input type="hidden" name="grand_prix_id" value={grandPrixId} />
      <input type="hidden" name="expected_grand_prix_id" value={grandPrixId} />
      {phase === "reset" ? <ConfirmSubmitButton
        confirmMessage="Weet je zeker dat je alle spelerspunten voor deze Grand Prix wilt resetten?"
        label={actions[phase].label} disabled={disabled} />
        : <PublishButton label={actions[phase].label} disabled={disabled} />}
    </form>
    {state.status !== "idle" && state.message ? <p role={state.status === "error" ? "alert" : "status"} className={`form-message ${state.status === "success" ? "success" : "error"}`}>{state.message}</p> : null}
  </div>;
}

export function PublishScoreActions(props: Props) {
  const phases: Phase[] = props.phase ? [props.phase] : [
    ...(props.isSprintWeekend ? ["sprintQualification", "sprintRace"] as Phase[] : []),
    "qualification", "final", "reset",
  ];
  return <section className="predictions-section">
    {!props.phase ? <><h2>Scores spelers</h2><p>Publiceer de spelerspunten in fases. Elke fase blijft een aparte handeling.</p></> : null}
    {props.disabled ? <p className="league-list-empty">Deze GP is geannuleerd. Publicatie van scores is uitgeschakeld.</p> : null}
    {phases.filter(phase => props.isSprintWeekend || !phase.startsWith("sprint")).map(phase => <PhaseAction key={phase} {...props} phase={phase} />)}
  </section>;
}

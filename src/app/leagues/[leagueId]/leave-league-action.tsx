"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { leaveLeague } from "@/app/actions/leagues";

type LeaveLeagueActionProps = {
  leagueId: string;
};

function LeaveLeagueSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="league-delete-confirm" disabled={pending}>
      {pending ? "Bezig met verlaten..." : "Verlaten"}
    </button>
  );
}

export function LeaveLeagueAction({ leagueId }: LeaveLeagueActionProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  return (
    <div className="league-danger-zone">
      <button type="button" className="league-delete-trigger" onClick={() => setIsConfirmOpen(true)}>
        League verlaten
      </button>

      {isConfirmOpen ? (
        <div className="league-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-league-title">
          <div className="league-delete-dialog-content">
            <h2 id="leave-league-title">League verlaten</h2>
            <p>Weet je zeker dat je deze league wilt verlaten?</p>
            <div className="league-delete-dialog-actions">
              <button type="button" className="league-delete-cancel" onClick={() => setIsConfirmOpen(false)}>
                Annuleren
              </button>
              <form action={leaveLeague}>
                <input type="hidden" name="league_id" value={leagueId} />
                <LeaveLeagueSubmitButton />
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

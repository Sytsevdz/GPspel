"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteLeague } from "@/app/actions/leagues";

type DeleteLeagueActionProps = {
  leagueId: string;
};

function DeleteLeagueSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="league-delete-confirm" disabled={pending}>
      {pending ? "Bezig met verwijderen..." : "Verwijderen"}
    </button>
  );
}

export function DeleteLeagueAction({ leagueId }: DeleteLeagueActionProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  return (
    <div className="league-danger-zone">
      <button type="button" className="league-delete-trigger" onClick={() => setIsConfirmOpen(true)}>
        League verwijderen
      </button>

      {isConfirmOpen ? (
        <div className="league-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-league-title">
          <div className="league-delete-dialog-content">
            <h2 id="delete-league-title">League verwijderen</h2>
            <p>Weet je zeker dat je deze league wilt verwijderen? Dit kan niet ongedaan worden gemaakt.</p>
            <div className="league-delete-dialog-actions">
              <button type="button" className="league-delete-cancel" onClick={() => setIsConfirmOpen(false)}>
                Annuleren
              </button>
              <form action={deleteLeague}>
                <input type="hidden" name="league_id" value={leagueId} />
                <DeleteLeagueSubmitButton />
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

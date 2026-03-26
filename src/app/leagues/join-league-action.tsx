"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { joinLeague } from "@/app/actions/leagues";

type JoinLeagueActionProps = {
  leagueName: string;
};

function JoinLeagueSubmitButton() {
  const { pending } = useFormStatus();

  return <button type="submit">{pending ? "Bezig met deelnemen..." : "Deelnemen aan league"}</button>;
}

export function JoinLeagueAction({ leagueName }: JoinLeagueActionProps) {
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const joinCodeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isJoinOpen) {
      joinCodeInputRef.current?.focus();
    }
  }, [isJoinOpen]);

  return (
    <>
      <button type="button" className="league-join-trigger" onClick={() => setIsJoinOpen(true)}>
        Join league
      </button>

      {isJoinOpen ? (
        <div className="league-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="join-league-title">
          <div className="league-delete-dialog-content">
            <h2 id="join-league-title">Join league</h2>
            <p>Voer de deelnemingscode in om deel te nemen aan {leagueName}.</p>
            <form className="join-form" action={joinLeague}>
              <label htmlFor="join_code_modal">Deelnemingscode</label>
              <div className="join-form-row">
                <input
                  ref={joinCodeInputRef}
                  id="join_code_modal"
                  name="join_code"
                  type="text"
                  required
                  placeholder="Voer een deelnemingscode in"
                  autoComplete="off"
                  maxLength={64}
                />
                <JoinLeagueSubmitButton />
              </div>
            </form>
            <div className="league-delete-dialog-actions">
              <button type="button" className="league-delete-cancel" onClick={() => setIsJoinOpen(false)}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type ConfirmReactivateSubmitButtonProps = {
  label: string;
  pendingLabel?: string;
  confirmMessage: string;
  confirmLabel: string;
  cancelLabel: string;
};

export function ConfirmReactivateSubmitButton({
  label,
  pendingLabel = "Bezig...",
  confirmMessage,
  confirmLabel,
  cancelLabel,
}: ConfirmReactivateSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" disabled={pending} onClick={() => setOpen(true)}>
        {pending ? pendingLabel : label}
      </button>
      {open ? (
        <div className="league-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="reactivate-gp-title">
          <div className="league-delete-dialog-content">
            <h2 id="reactivate-gp-title">Grand Prix activeren</h2>
            <p>{confirmMessage}</p>
            <div className="league-delete-dialog-actions">
              <button type="button" className="league-delete-cancel" onClick={() => setOpen(false)}>
                {cancelLabel}
              </button>
              <button type="submit" className="league-delete-confirm" disabled={pending}>
                {pending ? pendingLabel : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

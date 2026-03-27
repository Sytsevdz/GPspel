"use client";

import type { MouseEvent } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  confirmMessage: string;
  label: string;
  pendingLabel?: string;
};

export function ConfirmSubmitButton({ confirmMessage, label, pendingLabel = "Bezig..." }: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) {
      return;
    }

    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) {
      event.preventDefault();
    }
  };

  return (
    <button type="submit" onClick={handleClick} disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

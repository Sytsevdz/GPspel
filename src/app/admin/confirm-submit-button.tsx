"use client";

import type { MouseEvent } from "react";
import { useFormStatus } from "react-dom";

type ConfirmSubmitButtonProps = {
  confirmMessage: string;
  label: string;
  pendingLabel?: string;
  disabled?: boolean;
};

export function ConfirmSubmitButton({
  confirmMessage,
  label,
  pendingLabel = "Bezig...",
  disabled = false,
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending || disabled) {
      return;
    }

    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) {
      event.preventDefault();
    }
  };

  return (
    <button type="submit" onClick={handleClick} disabled={disabled || pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

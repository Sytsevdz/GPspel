"use client";

import type { MouseEvent } from "react";
import { useFormStatus } from "react-dom";

export function ResetPricesSubmitButton() {
  const { pending } = useFormStatus();

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) {
      return;
    }

    const confirmed = window.confirm(
      "Weet je zeker dat je alle prijzen voor deze Grand Prix wilt verwijderen?",
    );

    if (!confirmed) {
      event.preventDefault();
    }
  };

  return (
    <button type="submit" onClick={handleClick} disabled={pending}>
      {pending ? "Bezig..." : "Prijzen resetten"}
    </button>
  );
}

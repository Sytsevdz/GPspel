"use client";

import { useFormStatus } from "react-dom";

export function RegisterSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? "Registering..." : "Register"}
    </button>
  );
}

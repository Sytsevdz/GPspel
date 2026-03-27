"use client";

import { ConfirmSubmitButton } from "@/app/admin/confirm-submit-button";

export function ResetPricesSubmitButton() {
  return (
    <ConfirmSubmitButton
      confirmMessage="Weet je zeker dat je alle prijzen voor deze Grand Prix wilt verwijderen?"
      label="Prijzen resetten"
    />
  );
}

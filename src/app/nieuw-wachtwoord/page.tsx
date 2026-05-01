"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase";

export default function NewPasswordPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!password || !confirmPassword) {
      setError("Vul beide wachtwoordvelden in.");
      return;
    }

    if (password !== confirmPassword) {
      setError("De wachtwoorden komen niet overeen.");
      return;
    }

    setIsSaving(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setIsSaving(false);

    if (updateError) {
      setError("Kon wachtwoord niet opslaan. Vraag opnieuw een resetlink aan.");
      return;
    }

    setMessage("Je wachtwoord is bijgewerkt. Je wordt doorgestuurd naar inloggen.");
    window.setTimeout(() => {
      router.push("/login?message=Je+wachtwoord+is+succesvol+gewijzigd.");
    }, 1200);
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Nieuw wachtwoord</h1>
        <p>Kies een nieuw wachtwoord voor je account.</p>

        {error ? <p className="form-message error">{error}</p> : null}
        {message ? <p className="form-message success">{message}</p> : null}

        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="password">Nieuw wachtwoord</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <label htmlFor="confirm-password">Bevestig wachtwoord</label>
          <input
            id="confirm-password"
            name="confirm_password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />

          <button type="submit" disabled={isSaving}>
            {isSaving ? "Opslaan..." : "Wachtwoord opslaan"}
          </button>
        </form>
      </section>
    </main>
  );
}

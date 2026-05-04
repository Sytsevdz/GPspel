"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const NO_SESSION_ERROR = "Deze resetlink is ongeldig of verlopen. Vraag een nieuwe resetlink aan.";

export default function NewPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadSession = async () => {
      setIsCheckingSession(true);
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (sessionError || !session) {
        setError(NO_SESSION_ERROR);
        setHasSession(false);
        setIsCheckingSession(false);
        return;
      }

      setError(null);
      setHasSession(true);
      setIsCheckingSession(false);
    };

    void loadSession();

    return () => {
      isActive = false;
    };
  }, [supabase]);

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

        {isCheckingSession ? <p className="form-message">Resetlink controleren...</p> : null}
        {!isCheckingSession && error ? (
          <>
            <p className="form-message error">{error}</p>
            <p>
              <Link href="/wachtwoord-vergeten">Vraag een nieuwe resetlink aan</Link>
            </p>
          </>
        ) : null}
        {message ? <p className="form-message success">{message}</p> : null}

        {hasSession ? (
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
        ) : null}
      </section>
    </main>
  );
}

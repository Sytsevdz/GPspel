"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function NewPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingLink, setIsCheckingLink] = useState(true);
  const [isRecoverySessionReady, setIsRecoverySessionReady] = useState(false);

  useEffect(() => {
    let isActive = true;

    const handleRecovery = async () => {
      if (!isActive) {
        return;
      }

      setError(null);
      setIsCheckingLink(true);
      setIsRecoverySessionReady(false);

      try {
        const code = searchParams.get("code");
        const hash = window.location.hash ?? "";
        const hashParams = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
        const hasHash = hash.length > 0;
        const hashKeys = Array.from(hashParams.keys());
        const hasAccessTokenInHash = hashParams.has("access_token");
        const hasRefreshTokenInHash = hashParams.has("refresh_token");
        const hashError = hashParams.get("error");
        const hashErrorCode = hashParams.get("error_code");
        const searchParamKeys = Array.from(searchParams.keys());

        console.info("[nieuw-wachtwoord] location diagnostics", {
          href: window.location.href,
          searchParamKeys,
          hasHash,
          hashKeys,
          hasAccessTokenInHash,
          hasRefreshTokenInHash,
          hasCodeParam: Boolean(code),
          hashError,
          hashErrorCode,
        });

        if (code) {
          console.info("[nieuw-wachtwoord] exchangeCodeForSession start", { hasCodeParam: true });
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            if (!isActive) {
              return;
            }

            setError("Deze resetlink is ongeldig of verlopen.");
            setIsCheckingLink(false);
            return;
          }
        }

        if (!code && hasAccessTokenInHash && hasRefreshTokenInHash) {
          console.info("[nieuw-wachtwoord] recovery hash-token flow detected");
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (setSessionError) {
              setError("Deze resetlink is ongeldig of verlopen.");
              setIsCheckingLink(false);
              return;
            }

            if (window.location.hash) {
              window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
            }
          }
        }

        if (!code && hashErrorCode === "otp_expired") {
          setError("Deze resetlink is verlopen. Vraag een nieuwe resetlink aan.");
          setIsCheckingLink(false);
          return;
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (!isActive) {
          return;
        }

        if (sessionError || !session) {
          setError(code ? "Deze resetlink is ongeldig of verlopen." : "Geen geldige resetlink gevonden. Vraag een nieuwe resetlink aan.");
          setIsCheckingLink(false);
          return;
        }

        setIsRecoverySessionReady(true);
        setIsCheckingLink(false);
      } catch {
        if (!isActive) {
          return;
        }

        setError("Er ging iets mis bij het verwerken van je resetlink. Vraag een nieuwe resetlink aan.");
        setIsCheckingLink(false);
      }
    };

    void handleRecovery();

    return () => {
      isActive = false;
    };
  }, [searchParams, supabase]);

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

        {isCheckingLink ? <p className="form-message">Resetlink controleren...</p> : null}
        {!isCheckingLink && error ? (
          <>
            <p className="form-message error">{error}</p>
            <p>
              <Link href="/wachtwoord-vergeten">Vraag een nieuwe resetlink aan</Link>
            </p>
          </>
        ) : null}
        {message ? <p className="form-message success">{message}</p> : null}

        {isRecoverySessionReady ? (
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

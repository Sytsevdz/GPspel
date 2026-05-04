"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ForgotPasswordPageProps = {
  searchParams: {
    error?: string;
    message?: string;
  };
};

const getPasswordResetErrorMessage = (message?: string) => {
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (!normalizedMessage) {
    return "Kon geen resetlink versturen. Probeer het opnieuw.";
  }

  if (normalizedMessage.includes("for security purposes")) {
    return "Te veel pogingen in korte tijd. Wacht even en probeer opnieuw.";
  }

  if (normalizedMessage.includes("invalid email")) {
    return "Voer een geldig e-mailadres in.";
  }

  return "Kon geen resetlink versturen door een technische fout. Probeer het opnieuw.";
};

export default function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [status, setStatus] = useState<{ error?: string; message?: string }>({
    error: searchParams.error,
    message: searchParams.message,
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    if (!email) {
      setStatus({ error: "Vul een e-mailadres in.", message: undefined });
      return;
    }

    const origin = window.location.origin || "http://localhost:3000";
    const redirectTo = `${origin}/nieuw-wachtwoord`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      console.error("[requestPasswordReset] Supabase fout", {
        message: error.message,
        status: error.status,
        code: error.code,
      });

      setStatus({
        error: getPasswordResetErrorMessage(error.message),
        message: undefined,
      });
      return;
    }

    setStatus({
      error: undefined,
      message: "Als het e-mailadres bekend is, is er een resetlink verstuurd.",
    });
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Wachtwoord vergeten</h1>
        <p>Vul je e-mailadres in. Je ontvangt een link om een nieuw wachtwoord in te stellen.</p>

        {status.error ? <p className="form-message error">{status.error}</p> : null}
        {status.message ? <p className="form-message success">{status.message}</p> : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">E-mailadres</label>
          <input id="email" name="email" type="email" required autoComplete="email" />

          <button type="submit">Resetlink versturen</button>
        </form>

        <p className="auth-link">
          Weet je je wachtwoord weer? <Link href="/login">Inloggen</Link>
        </p>
      </section>
    </main>
  );
}

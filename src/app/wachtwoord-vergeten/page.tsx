import Link from "next/link";

import { requestPasswordReset } from "@/app/actions/auth";

type ForgotPasswordPageProps = {
  searchParams: {
    error?: string;
    message?: string;
  };
};

export default function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Wachtwoord vergeten</h1>
        <p>Vul je e-mailadres in. Je ontvangt een link om een nieuw wachtwoord in te stellen.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}
        {searchParams.message ? <p className="form-message success">{searchParams.message}</p> : null}

        <form className="auth-form" action={requestPasswordReset}>
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

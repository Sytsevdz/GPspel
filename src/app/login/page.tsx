import Link from "next/link";
import { redirect } from "next/navigation";

import { login } from "@/app/actions/auth";
import { createServerSupabaseClient } from "@/lib/supabase";

type LoginPageProps = {
  searchParams: {
    error?: string;
    message?: string;
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Inloggen</h1>
        <p>Welkom terug. Log in om verder te gaan.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}
        {searchParams.message ? <p className="form-message success">{searchParams.message}</p> : null}

        <form className="auth-form" action={login}>
          <label htmlFor="email">E-mailadres</label>
          <input id="email" name="email" type="email" required autoComplete="email" />

          <label htmlFor="password">Wachtwoord</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />

          <button type="submit">Inloggen</button>
        </form>

        <p className="auth-link">
          <Link href="/wachtwoord-vergeten">Wachtwoord vergeten?</Link>
        </p>

        <p className="auth-link">
          Heb je nog geen account? <Link href="/register">Meld je aan</Link>
        </p>
      </section>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { register } from "@/app/actions/auth";
import { createServerSupabaseClient } from "@/lib/supabase";

import { RegisterSubmitButton } from "./register-submit-button";

type RegisterPageProps = {
  searchParams: {
    error?: string;
  };
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Account aanmaken</h1>
        <p>Meld je aan om toegang te krijgen tot je dashboard.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}

        <form className="auth-form" action={register}>
          <label htmlFor="display_name">Weergavenaam</label>
          <input id="display_name" name="display_name" type="text" autoComplete="nickname" maxLength={50} />

          <label htmlFor="email">E-mailadres</label>
          <input id="email" name="email" type="email" required autoComplete="email" />

          <label htmlFor="password">Wachtwoord</label>
          <input id="password" name="password" type="password" required autoComplete="new-password" minLength={6} />

          <RegisterSubmitButton />
        </form>

        <p className="auth-link">
          Heb je al een account? <Link href="/login">Inloggen</Link>
        </p>
      </section>
    </main>
  );
}

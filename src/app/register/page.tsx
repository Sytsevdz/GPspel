import Link from "next/link";
import { redirect } from "next/navigation";

import { register } from "@/app/actions/auth";
import { createServerSupabaseClient } from "@/lib/supabase";

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
        <h1>Create account</h1>
        <p>Register to access your dashboard.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}

        <form className="auth-form" action={register}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="new-password" minLength={6} />

          <button type="submit">Register</button>
        </form>

        <p className="auth-link">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}

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
        <h1>Log in</h1>
        <p>Welcome back. Sign in to continue.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}
        {searchParams.message ? <p className="form-message success">{searchParams.message}</p> : null}

        <form className="auth-form" action={login}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" />

          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />

          <button type="submit">Log in</button>
        </form>

        <p className="auth-link">
          Don&apos;t have an account? <Link href="/register">Create one</Link>
        </p>
      </section>
    </main>
  );
}

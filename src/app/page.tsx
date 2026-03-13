import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

export default async function HomePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="home">
      <section className="home-card">
        <h1>Het betere GP spel</h1>
        <p>Log in or register to access your protected dashboard.</p>
        <div className="home-actions">
          <Link href="/login">Log in</Link>
          <Link href="/register">Register</Link>
        </div>
      </section>
    </main>
  );
}

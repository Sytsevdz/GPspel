import { redirect } from "next/navigation";

import { logout } from "@/app/actions/auth";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-card">
        <h1>Dashboard</h1>
        <p>You are logged in as {user.email}.</p>

        <form action={logout}>
          <button type="submit">Log out</button>
        </form>
      </section>
    </main>
  );
}

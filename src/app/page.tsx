import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

export default async function HomePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: memberships } = await supabase
      .from("league_members")
      .select("league_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .limit(1);

    const firstLeagueId = memberships?.[0]?.league_id;

    if (firstLeagueId) {
      redirect(`/leagues/${firstLeagueId}`);
    }

    return (
      <main className="dashboard-page">
        <section className="dashboard-card">
          <h1>Welkom</h1>
          <p>
            Je zit nog niet in een competitie. Ga naar Competities om er een te bekijken of met een code deel te
            nemen.
          </p>
          <Link href="/leagues">Naar competities</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="home">
      <section className="home-card">
        <h1>Het betere GP spel</h1>
        <p>Log in of registreer om mee te doen.</p>
        <div className="home-actions">
          <Link href="/login">Log in</Link>
          <Link href="/register">Registreren</Link>
        </div>
      </section>
    </main>
  );
}

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
    <main className="home hero-home">
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-overlay" />
        <div className="hero-content">
          <span className="hero-kicker">Het betere GP spel</span>
          <h1 id="hero-title">Ben jij de ultieme GP-kenner?</h1>
          <p>
            Stel je team samen, voorspel de uitslagen en versla je vrienden gedurende het hele seizoen.
          </p>
          <div className="hero-actions">
            <Link className="hero-cta" href="/register">
              Speel mee
            </Link>
            <Link className="hero-secondary" href="/login">
              Ik heb al een account
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

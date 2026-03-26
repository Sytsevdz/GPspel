import Link from "next/link";
import { redirect } from "next/navigation";

import { createLeague, joinLeague } from "@/app/actions/leagues";
import { createServerSupabaseClient } from "@/lib/supabase";

type LeaguesPageProps = {
  searchParams: {
    error?: string;
    message?: string;
  };
};

export default async function LeaguesPage({ searchParams }: LeaguesPageProps) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, name")
    .order("name", { ascending: true });
  const { data: memberships, error: membershipsError } = await supabase
    .from("league_members")
    .select("league_id")
    .eq("user_id", user.id);

  const membershipLeagueIds = new Set((memberships ?? []).map((membership) => membership.league_id));

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <h1>Jouw leagues</h1>
        <p>Bekijk je leagues en neem deel met een deelnemingscode.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}
        {searchParams.message ? <p className="form-message success">{searchParams.message}</p> : null}

        <details className="create-league-panel">
          <summary className="create-league-toggle">League aanmaken</summary>
          <form className="join-form create-league-form" action={createLeague}>
            <label htmlFor="name">Naam van de league</label>
            <div className="join-form-row">
              <input id="name" name="name" type="text" required placeholder="Bijv. Vrienden League" maxLength={80} />
              <button type="submit">League maken</button>
            </div>
          </form>
        </details>

        <form id="join-league-form" className="join-form" action={joinLeague}>
          <label htmlFor="join_code">Deelnemingscode</label>
          <div className="join-form-row">
            <input
              id="join_code"
              name="join_code"
              type="text"
              required
              placeholder="Voer een deelnemingscode in"
              autoComplete="off"
              maxLength={64}
            />
            <button type="submit">Deelnemen aan league</button>
          </div>
        </form>

        {error || membershipsError ? <p className="form-message error">Kon leagues nu niet laden.</p> : null}

        <ul className="league-list" aria-label="Leagues">
          {leagues && leagues.length > 0 ? (
            leagues.map((league) => (
              <li key={league.id} className="league-list-item">
                <div>
                  <h2>{league.name}</h2>
                </div>
                {membershipLeagueIds.has(league.id) ? (
                  <Link href={`/leagues/${league.id}`}>Open league</Link>
                ) : (
                  <Link href="#join-league-form">Join league</Link>
                )}
              </li>
            ))
          ) : (
            <li className="league-list-empty">Je bent nog niet deelnemer van een league.</li>
          )}
        </ul>
      </section>
    </main>
  );
}

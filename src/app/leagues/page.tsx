import Link from "next/link";
import { redirect } from "next/navigation";

import { joinLeague } from "@/app/actions/leagues";
import { createServerSupabaseClient } from "@/lib/supabase";

type CompetitiesPageProps = {
  searchParams: {
    error?: string;
    message?: string;
  };
};

export default async function CompetitiesPage({ searchParams }: CompetitiesPageProps) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: leagues, error } = await supabase
    .from("leagues")
    .select("id, name, join_code")
    .order("name", { ascending: true });

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <h1>Jouw leagues</h1>
        <p>Bekijk je leagues en neem deel met een deelnemingscode.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}
        {searchParams.message ? <p className="form-message success">{searchParams.message}</p> : null}

        <form className="join-form" action={joinLeague}>
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

        {error ? <p className="form-message error">Kon leagues nu niet laden.</p> : null}

        <ul className="league-list" aria-label="Leagues">
          {leagues && leagues.length > 0 ? (
            leagues.map((league) => (
              <li key={league.id} className="league-list-item">
                <div>
                  <h2>{league.name}</h2>
                  <p>
                    Deelnemingscode: <span>{league.join_code}</span>
                  </p>
                </div>
                <Link href={`/leagues/${league.id}`}>Open league</Link>
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

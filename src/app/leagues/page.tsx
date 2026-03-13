import Link from "next/link";
import { redirect } from "next/navigation";

import { joinLeague } from "@/app/actions/leagues";
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
    .select("id, name, join_code")
    .order("name", { ascending: true });

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <h1>Your leagues</h1>
        <p>View your leagues and join a new one with a join code.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}
        {searchParams.message ? <p className="form-message success">{searchParams.message}</p> : null}

        <form className="join-form" action={joinLeague}>
          <label htmlFor="join_code">Join code</label>
          <div className="join-form-row">
            <input
              id="join_code"
              name="join_code"
              type="text"
              required
              placeholder="Enter league join code"
              autoComplete="off"
              maxLength={64}
            />
            <button type="submit">Join league</button>
          </div>
        </form>

        {error ? <p className="form-message error">Unable to load leagues right now.</p> : null}

        <ul className="league-list" aria-label="Leagues">
          {leagues && leagues.length > 0 ? (
            leagues.map((league) => (
              <li key={league.id} className="league-list-item">
                <div>
                  <h2>{league.name}</h2>
                  <p>
                    Join code: <span>{league.join_code}</span>
                  </p>
                </div>
                <Link href={`/leagues/${league.id}`}>Open league</Link>
              </li>
            ))
          ) : (
            <li className="league-list-empty">You have not joined any leagues yet.</li>
          )}
        </ul>
      </section>
    </main>
  );
}

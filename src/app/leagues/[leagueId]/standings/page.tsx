import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase";

import { getAccessibleLeague } from "../league-access";

type StandingsPageProps = {
  params: {
    leagueId: string;
  };
};

export default async function StandingsPage({ params }: StandingsPageProps) {
  const league = await getAccessibleLeague(params.leagueId);

  if (!league) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>Access denied</h1>
          <p>This page is only available to members of this league.</p>
          <Link href="/leagues" className="league-back-link">
            ← Back to your leagues
          </Link>
        </section>
      </main>
    );
  }

  const supabase = createServerSupabaseClient();

  const { data: members, error: membersError } = await supabase
    .from("league_members")
    .select("user_id, profiles(display_name)")
    .eq("league_id", league.id)
    .returns<Array<{ user_id: string; profiles: { display_name: string } | null }>>();

  const memberIds = (members ?? []).map((member) => member.user_id);

  const { data: scoreRows, error: scoresError } = memberIds.length
    ? await supabase
        .from("grand_prix_scores")
        .select("user_id, total_points")
        .in("user_id", memberIds)
        .returns<Array<{ user_id: string; total_points: number }>>()
    : { data: [], error: null };

  const totalPointsByUserId = new Map<string, number>();

  (scoreRows ?? []).forEach((scoreRow) => {
    const existingTotal = totalPointsByUserId.get(scoreRow.user_id) ?? 0;
    totalPointsByUserId.set(scoreRow.user_id, existingTotal + (scoreRow.total_points ?? 0));
  });

  const standings = (members ?? [])
    .map((member) => ({
      userId: member.user_id,
      spelerNaam: member.profiles?.display_name ?? "Speler",
      totaalPunten: totalPointsByUserId.get(member.user_id) ?? 0,
    }))
    .sort((left, right) => right.totaalPunten - left.totaalPunten || left.spelerNaam.localeCompare(right.spelerNaam));

  return (
    <main className="leagues-page">
      <section className="leagues-card league-standings-card">
        <h1>Klassement</h1>
        <p>{league.name}</p>
        {membersError || scoresError ? (
          <p className="form-message error">Het klassement kon nu niet worden geladen.</p>
        ) : standings.length === 0 ? (
          <p className="league-list-empty">Er zijn nog geen punten berekend.</p>
        ) : (
          <div className="standings-table-wrapper">
            <table className="standings-table" aria-label="Klassement">
              <thead>
                <tr>
                  <th scope="col">Positie</th>
                  <th scope="col">Speler</th>
                  <th scope="col">Totaal punten</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((entry, index) => (
                  <tr key={entry.userId}>
                    <td>{index + 1}</td>
                    <td>{entry.spelerNaam}</td>
                    <td>{entry.totaalPunten}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link href={`/leagues/${league.id}`} className="league-back-link">
          ← Terug naar league
        </Link>
      </section>
    </main>
  );
}

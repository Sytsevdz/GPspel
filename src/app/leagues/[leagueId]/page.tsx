import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";

import { getCurrentSelectableGrandPrix } from "@/lib/team-selection-data";
import { getAccessibleLeague } from "./league-access";

type LeaguePageProps = {
  params: {
    leagueId: string;
  };
};

type LeagueStandingsMemberRow = {
  user_id: string;
  profiles: {
    display_name: string;
  } | null;
};

type LeagueScoreRow = {
  user_id: string;
  total_points: number | null;
};

export default async function LeaguePage({ params }: LeaguePageProps) {
  const league = await getAccessibleLeague(params.leagueId);

  if (!league) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>Competitie niet beschikbaar</h1>
          <p>Je hebt geen toegang tot deze competitie, of deze bestaat niet.</p>
          <Link href="/leagues" className="league-back-link">
            ← Terug naar je competities
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
    .returns<LeagueStandingsMemberRow[]>();

  const memberIds = (members ?? []).map((member) => member.user_id);

  const { data: scoreRows, error: scoresError } = memberIds.length
    ? await supabase
        .from("grand_prix_scores")
        .select("user_id, total_points")
        .in("user_id", memberIds)
        .returns<LeagueScoreRow[]>()
    : { data: [], error: null };

  const totalPointsByUserId = new Map<string, number>();

  (scoreRows ?? []).forEach((scoreRow) => {
    const currentPoints = totalPointsByUserId.get(scoreRow.user_id) ?? 0;
    totalPointsByUserId.set(scoreRow.user_id, currentPoints + (scoreRow.total_points ?? 0));
  });

  const standingsPreview = (members ?? [])
    .map((member) => ({
      userId: member.user_id,
      spelerNaam: member.profiles?.display_name ?? "Speler",
      totaalPunten: totalPointsByUserId.get(member.user_id) ?? 0,
    }))
    .sort((left, right) => right.totaalPunten - left.totaalPunten || left.spelerNaam.localeCompare(right.spelerNaam))
    .slice(0, 5);

  const currentOrUpcomingGrandPrix = await getCurrentSelectableGrandPrix(supabase).catch(() => null);

  const nowIso = new Date().toISOString();
  const isGrandPrixSelectable =
    currentOrUpcomingGrandPrix ? currentOrUpcomingGrandPrix.deadline > nowIso : false;

  return (
    <main className="leagues-page">
      <section className="leagues-card league-detail-card">
        <div className="league-detail-header">
          <div>
            <h1>{league.name}</h1>
            <p>
              Deelnemingscode: <span>{league.join_code}</span>
            </p>
          </div>
          <Link href="/leagues" className="league-back-link">
            ← Alle competities
          </Link>
        </div>

        <nav className="league-actions" aria-label="Competitie-acties">
          <Link href={`/leagues/${league.id}/team-selection`}>Team kiezen</Link>
          <Link href={`/leagues/${league.id}/predictions`}>Voorspellingen</Link>
          <Link href={`/leagues/${league.id}/standings`}>Bekijk klassement</Link>
        </nav>

        <section className="league-section">
          <div className="league-detail-header">
            <h2>Klassement</h2>
            <Link href={`/leagues/${league.id}/standings`}>Bekijk klassement</Link>
          </div>
          {membersError || scoresError ? (
            <p className="form-message error">Het klassement kon nu niet worden geladen.</p>
          ) : standingsPreview.length > 0 ? (
            <div className="standings-table-wrapper">
              <table className="standings-table" aria-label="Klassement voorbeeld">
                <thead>
                  <tr>
                    <th scope="col">Positie</th>
                    <th scope="col">Speler</th>
                    <th scope="col">Totaal punten</th>
                  </tr>
                </thead>
                <tbody>
                  {standingsPreview.map((entry, index) => (
                    <tr key={entry.userId}>
                      <td>{index + 1}</td>
                      <td>{entry.spelerNaam}</td>
                      <td>{entry.totaalPunten}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="league-list-empty">Er zijn nog geen punten berekend.</p>
          )}
        </section>

        <section className="league-section">
          <h2>Huidige of komende Grand Prix</h2>
          {currentOrUpcomingGrandPrix ? (
            <div className="gp-highlight">
              <p className="gp-highlight-title">{currentOrUpcomingGrandPrix.name}</p>
              <p>
                Status: <strong>{isGrandPrixSelectable ? "Open voor keuzes" : "Meest recente Grand Prix"}</strong>
              </p>
              <p>
                Deadline: {new Date(currentOrUpcomingGrandPrix.deadline).toLocaleString("nl-NL", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ) : (
            <div className="league-list-empty">
              <p>Er is nog geen Grand Prix beschikbaar.</p>
              <p>Kom later terug zodra de racekalender is bijgewerkt.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";

import { getCurrentSelectableGrandPrix } from "@/lib/team-selection-data";
import { getAccessibleLeague } from "./league-access";
import { LeagueResultsPanel } from "./league-results-panel";

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
  grand_prix_id: string;
  user_id: string;
  total_points: number | null;
};

export default async function LeaguePage({ params }: LeaguePageProps) {
  const league = await getAccessibleLeague(params.leagueId);

  if (!league) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>League niet beschikbaar</h1>
          <p>Je hebt geen toegang tot deze league, of deze bestaat niet.</p>
          <Link href="/leagues" className="league-back-link">
            ← Terug naar je leagues
          </Link>
        </section>
      </main>
    );
  }

  const supabase = createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  const { data: members, error: membersError } = await supabase
    .from("league_members")
    .select("user_id, profiles(display_name)")
    .eq("league_id", league.id)
    .returns<LeagueStandingsMemberRow[]>();

  const memberIds = (members ?? []).map((member) => member.user_id);

  const { data: scoreRows, error: scoresError } = memberIds.length
    ? await supabase
        .from("grand_prix_scores")
        .select("grand_prix_id, user_id, total_points")
        .in("user_id", memberIds)
        .returns<LeagueScoreRow[]>()
    : { data: [], error: null };

  const totalPointsByUserId = new Map<string, number>();

  (scoreRows ?? []).forEach((scoreRow) => {
    const currentPoints = totalPointsByUserId.get(scoreRow.user_id) ?? 0;
    totalPointsByUserId.set(scoreRow.user_id, currentPoints + (scoreRow.total_points ?? 0));
  });

  const standings = (members ?? [])
    .map((member) => ({
      userId: member.user_id,
      spelerNaam: member.profiles?.display_name ?? "Speler",
      totaalPunten: totalPointsByUserId.get(member.user_id) ?? 0,
    }))
    .sort((left, right) => right.totaalPunten - left.totaalPunten || left.spelerNaam.localeCompare(right.spelerNaam));

  const { data: latestCompletedGrandPrix } = await supabase
    .from("grand_prix")
    .select("id, name, deadline")
    .lte("deadline", nowIso)
    .order("deadline", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; name: string; deadline: string }>();

  const latestGrandPrixPointsByUserId = new Map<string, number>();

  if (latestCompletedGrandPrix && scoreRows) {
    scoreRows
      .filter((scoreRow) => scoreRow.grand_prix_id === latestCompletedGrandPrix.id)
      .forEach((scoreRow) => {
        latestGrandPrixPointsByUserId.set(scoreRow.user_id, scoreRow.total_points ?? 0);
      });
  }

  const latestGrandPrixStandings = latestCompletedGrandPrix
    ? (members ?? [])
        .map((member) => ({
          userId: member.user_id,
          spelerNaam: member.profiles?.display_name ?? "Speler",
          punten: latestGrandPrixPointsByUserId.get(member.user_id) ?? 0,
        }))
        .sort((left, right) => right.punten - left.punten || left.spelerNaam.localeCompare(right.spelerNaam))
    : [];
  const currentOrUpcomingGrandPrix = await getCurrentSelectableGrandPrix(supabase).catch(() => null);
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
            ← Alle leagues
          </Link>
        </div>

        {membersError || scoresError ? (
          <section className="league-section">
            <h2>League resultaten</h2>
            <p className="form-message error">De league-resultaten konden nu niet worden geladen.</p>
          </section>
        ) : (
          <LeagueResultsPanel
            leagueId={league.id}
            latestCompletedGrandPrix={
              latestCompletedGrandPrix
                ? {
                    id: latestCompletedGrandPrix.id,
                    name: latestCompletedGrandPrix.name,
                  }
                : null
            }
            members={(members ?? []).map((member) => ({
              userId: member.user_id,
              displayName: member.profiles?.display_name ?? "Speler",
            }))}
            latestGrandPrixStandings={latestGrandPrixStandings}
            standings={standings}
          />
        )}

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

        <Link href={`/leagues/${league.id}/gp-spel`} className="league-primary-cta">
          Naar het GP spel
        </Link>
      </section>
    </main>
  );
}

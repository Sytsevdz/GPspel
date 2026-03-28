import Link from "next/link";
import Image from "next/image";

import { formatUtcIsoInAmsterdamShort } from "@/lib/datetime";
import { createServerSupabaseClient } from "@/lib/supabase";
import { resolveTeamSelectionTeam } from "@/lib/team-selection-teams";
import { getCurrentSelectableGrandPrix } from "@/lib/team-selection-data";

type LeagueMembershipRow = {
  league_id: string;
  joined_at: string;
  leagues: {
    id: string;
    name: string;
  } | null;
};

type LatestGrandPrixRow = {
  id: string;
  name: string;
  deadline: string;
};

type UserGrandPrixScoreRow = {
  team_points: number | null;
  prediction_points: number | null;
  total_points: number | null;
};

type GrandPrixScoreDetailRow = {
  driver_id: string;
  team_quali_points: number | null;
  team_race_points: number | null;
  total_points: number | null;
  drivers: {
    name: string;
    constructor_team: string;
  } | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type ScoreRow = {
  grand_prix_id: string;
  user_id: string;
  total_points: number | null;
};

export default async function HomePage() {
  const supabase = createServerSupabaseClient();
  const nowIso = new Date().toISOString();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="home hero-home">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-overlay" />
          <div className="hero-content">
            <span className="hero-kicker">Het betere GP spel</span>
            <h1 id="hero-title">Ben jij de ultieme GP-kenner?</h1>
            <p>Stel je team samen, voorspel de uitslagen en versla je vrienden gedurende het hele seizoen.</p>
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

  const [
    { data: memberships },
    { data: profiles },
    { data: allScoreRows },
    { data: activeGrandPrixRows },
    { data: currentOrRecentGrandPrix },
  ] =
    await Promise.all([
      supabase
        .from("league_members")
        .select("league_id, joined_at, leagues(id, name)")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .returns<LeagueMembershipRow[]>(),
      supabase.from("profiles").select("id, display_name").returns<ProfileRow[]>(),
      supabase.from("grand_prix_scores").select("grand_prix_id, user_id, total_points").returns<ScoreRow[]>(),
      supabase.from("grand_prix").select("id").neq("status", "cancelled").returns<Array<{ id: string }>>(),
      supabase
        .from("grand_prix")
        .select("id, name, deadline")
        .neq("status", "cancelled")
        .lte("deadline", nowIso)
        .order("deadline", { ascending: false })
        .limit(1)
        .maybeSingle<LatestGrandPrixRow>(),
    ]);

  const firstLeagueId = memberships?.[0]?.league_id ?? null;
  const myLeagues =
    memberships
      ?.filter((membership) => membership.leagues)
      .map((membership) => ({
        id: membership.leagues!.id,
        name: membership.leagues!.name,
      })) ?? [];

  const nextGrandPrix = await getCurrentSelectableGrandPrix(supabase).catch(() => null);
  const hasSelectableGrandPrix = nextGrandPrix ? nextGrandPrix.deadline > nowIso : false;
  const activeGrandPrixIds = new Set((activeGrandPrixRows ?? []).map((grandPrix) => grandPrix.id));
  const scoredActiveGrandPrixIds = [...new Set((allScoreRows ?? []).map((row) => row.grand_prix_id))]
    .filter((grandPrixId) => activeGrandPrixIds.has(grandPrixId));
  const { data: fallbackScoredGrandPrix } = scoredActiveGrandPrixIds.length
    ? await supabase
        .from("grand_prix")
        .select("id, name, deadline")
        .in("id", scoredActiveGrandPrixIds)
        .neq("status", "cancelled")
        .order("deadline", { ascending: false })
        .limit(1)
        .maybeSingle<LatestGrandPrixRow>()
    : { data: null };
  const latestGrandPrix = currentOrRecentGrandPrix ?? fallbackScoredGrandPrix;

  const userLatestScore = latestGrandPrix
    ? (
        await supabase
          .from("grand_prix_scores")
          .select("team_points, prediction_points, total_points")
          .eq("grand_prix_id", latestGrandPrix.id)
          .eq("user_id", user.id)
          .maybeSingle<UserGrandPrixScoreRow>()
      ).data
    : null;

  const userLatestScoreDetails = latestGrandPrix
    ? (
        await supabase
          .from("grand_prix_score_details")
          .select("driver_id, team_quali_points, team_race_points, total_points, drivers(name, constructor_team)")
          .eq("grand_prix_id", latestGrandPrix.id)
          .eq("user_id", user.id)
          .order("total_points", { ascending: false })
          .returns<GrandPrixScoreDetailRow[]>()
      ).data ?? []
    : [];

  const totalPointsByUserId = new Map<string, number>();

  (allScoreRows ?? [])
    .filter((scoreRow) => activeGrandPrixIds.has(scoreRow.grand_prix_id))
    .forEach((scoreRow) => {
      const currentTotal = totalPointsByUserId.get(scoreRow.user_id) ?? 0;
      totalPointsByUserId.set(scoreRow.user_id, currentTotal + (scoreRow.total_points ?? 0));
    });

  const globalStandings = (profiles ?? [])
    .map((profile) => ({
      userId: profile.id,
      spelerNaam: profile.display_name ?? "Speler",
      totaalPunten: totalPointsByUserId.get(profile.id) ?? 0,
    }))
    .sort((left, right) => right.totaalPunten - left.totaalPunten || left.spelerNaam.localeCompare(right.spelerNaam));

  return (
    <main className="dashboard-page dashboard-home-page">
      <section className="dashboard-home-header">
        <div>
          <h1>Dashboard</h1>
          <p>Jouw snelle overzicht van het GP Spel.</p>
        </div>
        <Link className="dashboard-primary-cta" href={firstLeagueId ? `/leagues/${firstLeagueId}/gp-spel` : "/leagues"}>
          Ga naar GP Spel
        </Link>
      </section>

      <section className="dashboard-grid" aria-label="Dashboard-overzicht">
        <article className="dashboard-card dashboard-home-card dashboard-home-card--latest">
          <h2>Laatste Grand Prix</h2>
          {!latestGrandPrix ? (
            <p className="league-list-empty">Er is nog geen afgeronde Grand Prix beschikbaar.</p>
          ) : (
            <div className="dashboard-latest-result-card">
              <p className="dashboard-result-kicker">Jouw resultaat</p>
              <p className="dashboard-data-title">{latestGrandPrix.name}</p>
              {userLatestScore ? (
                <>
                  {userLatestScoreDetails.length > 0 ? (
                    <ul className="dashboard-result-driver-grid" aria-label="Teampunten per coureur">
                      {userLatestScoreDetails.map((detail) => {
                        const driverName = detail.drivers?.name ?? "Onbekende coureur";
                        const constructorTeam = detail.drivers?.constructor_team ?? "Onbekend team";
                        const team = resolveTeamSelectionTeam(constructorTeam);

                        return (
                          <li key={detail.driver_id} className="dashboard-result-driver-card">
                            <Image
                              src={team.image}
                              alt={`${constructorTeam} wagen`}
                              width={140}
                              height={56}
                              className="dashboard-result-driver-image"
                            />
                            <p className="dashboard-result-driver-name">{driverName}</p>
                            <dl className="dashboard-result-driver-points">
                              <div>
                                <dt>Kwalificatie</dt>
                                <dd>{detail.team_quali_points ?? 0}</dd>
                              </div>
                              <div>
                                <dt>Race</dt>
                                <dd>{detail.team_race_points ?? 0}</dd>
                              </div>
                              <div>
                                <dt>Totaal</dt>
                                <dd>{detail.total_points ?? 0}</dd>
                              </div>
                            </dl>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  <dl className="dashboard-result-summary">
                    <div className="dashboard-result-stat">
                      <dt>Team punten</dt>
                      <dd>{userLatestScore.team_points ?? 0}</dd>
                    </div>
                    <div className="dashboard-result-stat">
                      <dt>Voorspelling punten</dt>
                      <dd>{userLatestScore.prediction_points ?? 0}</dd>
                    </div>
                    <div className="dashboard-result-stat dashboard-result-total-stat">
                      <dt>Totaal</dt>
                      <dd>{userLatestScore.total_points ?? 0}</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="league-list-empty">Je hebt voor deze Grand Prix nog geen score.</p>
              )}
            </div>
          )}
        </article>

        <article className="dashboard-card dashboard-home-card dashboard-home-card--standings">
          <h2>Algemeen klassement</h2>
          {globalStandings.length === 0 ? (
            <p className="league-list-empty">Er zijn nog geen spelers om te tonen.</p>
          ) : (
            <div className="standings-table-wrapper dashboard-compact-table">
              <table className="standings-table dashboard-standings-table" aria-label="Algemeen klassement">
                <thead>
                  <tr>
                    <th scope="col" className="standings-position-column">Positie</th>
                    <th scope="col">Speler</th>
                    <th scope="col" className="standings-score-column standings-points-column">Punten</th>
                  </tr>
                </thead>
                <tbody>
                  {globalStandings.map((entry, index) => {
                    const position = index + 1;
                    const topRankClass =
                      position === 1
                        ? " standings-row-p1"
                        : position === 2
                          ? " standings-row-p2"
                          : position === 3
                            ? " standings-row-p3"
                            : "";

                    return (
                      <tr key={entry.userId} className={topRankClass.trim()}>
                        <td className="standings-position-cell">
                          <span className="standings-position-pill">{position}</span>
                        </td>
                        <td className="standings-name-cell" title={entry.spelerNaam}>{entry.spelerNaam}</td>
                        <td className="standings-score-cell standings-points-cell">{entry.totaalPunten}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="dashboard-card dashboard-home-card">
          <h2>Jouw Leagues</h2>
          {myLeagues.length === 0 ? (
            <div className="dashboard-empty-state">
              <p className="league-list-empty">Je zit nog niet in een league.</p>
              <Link className="dashboard-secondary-cta" href="/leagues">
                Ga naar Leagues
              </Link>
            </div>
          ) : (
            <ul className="dashboard-league-list" aria-label="Jouw Leagues">
              {myLeagues.map((league) => (
                <li key={league.id}>
                  <Link href={`/leagues/${league.id}`}>{league.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dashboard-card dashboard-home-card">
          <h2>Volgende Grand Prix</h2>
          {nextGrandPrix ? (
            <div className="dashboard-data-list">
              <p className="dashboard-data-title">{nextGrandPrix.name}</p>
              <p>
                {hasSelectableGrandPrix ? "Deadline" : "Kwalificatie start"}:{" "}
                {formatUtcIsoInAmsterdamShort(
                  hasSelectableGrandPrix ? nextGrandPrix.deadline : nextGrandPrix.qualification_start,
                )}
              </p>
              <Link
                className="dashboard-secondary-cta"
                href={firstLeagueId ? `/leagues/${firstLeagueId}/gp-spel` : "/leagues"}
              >
                Ga naar GP Spel
              </Link>
            </div>
          ) : (
            <p className="league-list-empty">Er is nog geen aankomende Grand Prix beschikbaar.</p>
          )}
        </article>
      </section>
    </main>
  );
}

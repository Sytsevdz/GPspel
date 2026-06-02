import Link from "next/link";
import Image from "next/image";

import { formatUtcIsoInAmsterdamShort } from "@/lib/datetime";
import { createServerSupabaseClient } from "@/lib/supabase";
import { resolveTeamSelectionTeam } from "@/lib/team-selection-teams";
import {
  getActiveGrandPrixDisplayLabel,
  getActiveGrandPrixDisplayState,
  getCurrentSelectableGrandPrix,
  getGrandPrixTimeline,
  getLatestFinishedGrandPrixFromTimeline,
  getNextGrandPrixFromTimeline,
} from "@/lib/team-selection-data";
import { isSessionPublished } from "@/lib/session-publication";
import { GlobalStandingsPanel } from "./dashboard/global-standings-panel";
import { DriverScoreCard } from "./driver-score-card";

type LeagueMembershipRow = {
  league_id: string;
  joined_at: string;
  leagues: {
    id: string;
    name: string;
  } | null;
};

type UserGrandPrixScoreRow = {
  team_points: number | null;
  prediction_points: number | null;
  total_points: number | null;
  team_sprint_quali_points: number | null;
  team_sprint_race_points: number | null;
  team_quali_points: number | null;
  team_race_points: number | null;
  sprint_quali_prediction_points: number | null;
  sprint_race_prediction_points: number | null;
  quali_prediction_points: number | null;
  race_prediction_points: number | null;
  fastest_pitstop_prediction_points: number | null;
};

type LatestPredictionRow = {
  fastest_pitstop_team: string | null;
};

type LatestBonusResultRow = {
  fastest_pitstop_team: string | null;
};

type GrandPrixScoreDetailRow = {
  driver_id: string;
  team_sprint_quali_points: number | null;
  team_sprint_race_points: number | null;
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
            <p>
              Stel je team samen, voorspel de uitslagen en versla je vrienden
              gedurende het hele seizoen.
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

  const [
    { data: memberships },
    { data: profiles },
    { data: allScoreRows },
    { data: activeGrandPrixRows },
  ] = await Promise.all([
    supabase
      .from("league_members")
      .select("league_id, joined_at, leagues(id, name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true })
      .returns<LeagueMembershipRow[]>(),
    supabase
      .from("profiles")
      .select("id, display_name")
      .returns<ProfileRow[]>(),
    supabase
      .from("grand_prix_scores")
      .select("grand_prix_id, user_id, total_points")
      .returns<ScoreRow[]>(),
    supabase
      .from("grand_prix")
      .select("id")
      .neq("status", "cancelled")
      .returns<Array<{ id: string }>>(),
  ]);

  const firstLeagueId = memberships?.[0]?.league_id ?? null;
  const myLeagues =
    memberships
      ?.filter((membership) => membership.leagues)
      .map((membership) => ({
        id: membership.leagues!.id,
        name: membership.leagues!.name,
      })) ?? [];

  const timeline = await getGrandPrixTimeline(supabase).catch(() => []);
  const currentGrandPrix = await getCurrentSelectableGrandPrix(supabase).catch(
    () => null,
  );
  const nextGrandPrix = currentGrandPrix
    ? getNextGrandPrixFromTimeline(timeline, currentGrandPrix.id)
    : null;
  const currentGrandPrixState = currentGrandPrix
    ? getActiveGrandPrixDisplayState(currentGrandPrix, nowIso)
    : null;
  const currentGrandPrixLabel = currentGrandPrixState
    ? getActiveGrandPrixDisplayLabel(currentGrandPrixState)
    : null;
  const activeGrandPrixIds = new Set(
    (activeGrandPrixRows ?? []).map((grandPrix) => grandPrix.id),
  );
  const latestGrandPrix = getLatestFinishedGrandPrixFromTimeline(timeline);
  const isLatestGrandPrixFinished = latestGrandPrix
    ? latestGrandPrix.status === "finished"
    : false;
  const latestGrandPrixStatusLabel = isLatestGrandPrixFinished
    ? "Afgelopen"
    : "Bezig";
  const userLatestScore = latestGrandPrix
    ? (
        await supabase
          .from("grand_prix_scores")
          .select(
            "team_points, prediction_points, total_points, team_sprint_quali_points, team_sprint_race_points, team_quali_points, team_race_points, sprint_quali_prediction_points, sprint_race_prediction_points, quali_prediction_points, race_prediction_points, fastest_pitstop_prediction_points",
          )
          .eq("grand_prix_id", latestGrandPrix.id)
          .eq("user_id", user.id)
          .maybeSingle<UserGrandPrixScoreRow>()
      ).data
    : null;

  const userLatestPrediction = latestGrandPrix
    ? (
        await supabase
          .from("predictions")
          .select("fastest_pitstop_team")
          .eq("grand_prix_id", latestGrandPrix.id)
          .eq("user_id", user.id)
          .maybeSingle<LatestPredictionRow>()
      ).data
    : null;

  const latestBonusResult = latestGrandPrix
    ? (
        await supabase
          .from("grand_prix_bonus_results")
          .select("fastest_pitstop_team")
          .eq("grand_prix_id", latestGrandPrix.id)
          .maybeSingle<LatestBonusResultRow>()
      ).data
    : null;

  const userLatestScoreDetails = latestGrandPrix
    ? ((
        await supabase
          .from("grand_prix_score_details")
          .select(
            "driver_id, team_sprint_quali_points, team_sprint_race_points, team_quali_points, team_race_points, total_points, drivers(name, constructor_team)",
          )
          .eq("grand_prix_id", latestGrandPrix.id)
          .eq("user_id", user.id)
          .order("total_points", { ascending: false })
          .returns<GrandPrixScoreDetailRow[]>()
      ).data ?? [])
    : [];

  const totalPointsByUserId = new Map<string, number>();
  const isSprintWeekend = latestGrandPrix?.is_sprint_weekend ?? false;
  const hasPublishedSprintQualiTeamPoints = isSessionPublished(
    userLatestScore,
    "team_sprint_quali_points",
  );
  const hasPublishedSprintRaceTeamPoints = isSessionPublished(
    userLatestScore,
    "team_sprint_race_points",
  );
  const hasPublishedQualiTeamPoints = isSessionPublished(
    userLatestScore,
    "team_quali_points",
  );
  const hasPublishedRaceTeamPoints = isSessionPublished(
    userLatestScore,
    "team_race_points",
  );
  const hasPublishedSprintQualiPredictionPoints = isSessionPublished(
    userLatestScore,
    "sprint_quali_prediction_points",
  );
  const hasPublishedSprintRacePredictionPoints = isSessionPublished(
    userLatestScore,
    "sprint_race_prediction_points",
  );
  const hasPublishedQualiPredictionPoints = isSessionPublished(
    userLatestScore,
    "quali_prediction_points",
  );
  const hasPublishedRacePredictionPoints = isSessionPublished(
    userLatestScore,
    "race_prediction_points",
  );
  const hasPublishedFastestPitstopPoints = isSessionPublished(
    userLatestScore,
    "fastest_pitstop_prediction_points",
  );

  (allScoreRows ?? [])
    .filter((scoreRow) => activeGrandPrixIds.has(scoreRow.grand_prix_id))
    .forEach((scoreRow) => {
      const currentTotal = totalPointsByUserId.get(scoreRow.user_id) ?? 0;
      totalPointsByUserId.set(
        scoreRow.user_id,
        currentTotal + (scoreRow.total_points ?? 0),
      );
    });

  const globalStandings = (profiles ?? [])
    .map((profile) => ({
      userId: profile.id,
      spelerNaam: profile.display_name ?? "Speler",
      totaalPunten: totalPointsByUserId.get(profile.id) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.totaalPunten - left.totaalPunten ||
        left.spelerNaam.localeCompare(right.spelerNaam),
    );

  return (
    <main className="dashboard-page dashboard-home-page">
      <section className="dashboard-home-header">
        <div>
          <h1>Dashboard</h1>
          <p>Jouw snelle overzicht van het GP Spel.</p>
        </div>
        <Link
          className="dashboard-primary-cta"
          href={
            firstLeagueId ? `/leagues/${firstLeagueId}/gp-spel` : "/leagues"
          }
        >
          Ga naar GP Spel
        </Link>
      </section>

      <section className="dashboard-grid" aria-label="Dashboard-overzicht">
        <article className="dashboard-card dashboard-home-card dashboard-home-card--latest">
          <div className="dashboard-card-heading">
            <h2>Laatste Grand Prix</h2>
            {latestGrandPrix ? (
              <span
                className={`dashboard-gp-status-badge ${
                  isLatestGrandPrixFinished
                    ? "dashboard-gp-status-badge--finished"
                    : "dashboard-gp-status-badge--ongoing"
                }`}
              >
                {latestGrandPrixStatusLabel}
              </span>
            ) : null}
          </div>
          {!latestGrandPrix ? (
            <p className="league-list-empty">
              Er is nog geen afgeronde Grand Prix beschikbaar.
            </p>
          ) : (
            <div className="dashboard-latest-result-card">
              <p className="dashboard-result-kicker">Jouw resultaat</p>
              <p className="dashboard-data-title">{latestGrandPrix.name}</p>
              {userLatestScore ? (
                <>
                  {userLatestScoreDetails.length > 0 ? (
                    <ul
                      className="dashboard-result-driver-grid"
                      aria-label="Teampunten per coureur"
                    >
                      {userLatestScoreDetails.map((detail) => {
                        const driverName =
                          detail.drivers?.name ?? "Onbekende coureur";
                        const constructorTeam =
                          detail.drivers?.constructor_team ?? "Onbekend team";
                        const team = resolveTeamSelectionTeam(constructorTeam);
                        const pointRows = [
                          ...(isSprintWeekend &&
                          hasPublishedSprintQualiTeamPoints
                            ? [
                                {
                                  label: "Sprint kwali",
                                  value: detail.team_sprint_quali_points ?? 0,
                                },
                              ]
                            : []),
                          ...(isSprintWeekend &&
                          hasPublishedSprintRaceTeamPoints
                            ? [
                                {
                                  label: "Sprint race",
                                  value: detail.team_sprint_race_points ?? 0,
                                },
                              ]
                            : []),
                          ...(hasPublishedQualiTeamPoints
                            ? [
                                {
                                  label: "Kwalificatie",
                                  value: detail.team_quali_points ?? 0,
                                },
                              ]
                            : []),
                          ...(hasPublishedRaceTeamPoints
                            ? [
                                {
                                  label: "Race",
                                  value: detail.team_race_points ?? 0,
                                },
                              ]
                            : []),
                        ];

                        return (
                          <DriverScoreCard
                            key={detail.driver_id}
                            teamImage={team.image}
                            teamName={team.name}
                            driverName={driverName}
                            constructorTeam={constructorTeam}
                            rows={[
                              ...pointRows,
                              {
                                label: "Totaal",
                                value: detail.total_points ?? 0,
                              },
                            ]}
                          />
                        );
                      })}
                    </ul>
                  ) : null}

                  <dl className="dashboard-result-summary">
                    <div className="dashboard-result-stat">
                      <dt>Team punten</dt>
                      <dd>{userLatestScore.team_points ?? 0}</dd>
                    </div>
                    {isSprintWeekend &&
                    hasPublishedSprintQualiPredictionPoints ? (
                      <div className="dashboard-result-stat">
                        <dt>Voorspelling sprint kwali</dt>
                        <dd>
                          {userLatestScore.sprint_quali_prediction_points ?? 0}
                        </dd>
                      </div>
                    ) : null}
                    {isSprintWeekend &&
                    hasPublishedSprintRacePredictionPoints ? (
                      <div className="dashboard-result-stat">
                        <dt>Voorspelling sprint race</dt>
                        <dd>
                          {userLatestScore.sprint_race_prediction_points ?? 0}
                        </dd>
                      </div>
                    ) : null}
                    {hasPublishedQualiPredictionPoints ? (
                      <div className="dashboard-result-stat">
                        <dt>Voorspelling kwalificatie</dt>
                        <dd>{userLatestScore.quali_prediction_points ?? 0}</dd>
                      </div>
                    ) : null}
                    {hasPublishedRacePredictionPoints ? (
                      <div className="dashboard-result-stat">
                        <dt>Voorspelling race</dt>
                        <dd>{userLatestScore.race_prediction_points ?? 0}</dd>
                      </div>
                    ) : null}

                    {hasPublishedFastestPitstopPoints ? (
                      <div className="dashboard-result-stat">
                        <dt>Snelste pitstop</dt>
                        <dd>
                          {userLatestPrediction?.fastest_pitstop_team ??
                            "Geen team"}{" "}
                          /{" "}
                          {latestBonusResult?.fastest_pitstop_team ??
                            "Onbekend"}{" "}
                          (
                          {userLatestScore.fastest_pitstop_prediction_points ??
                            0}{" "}
                          pnt)
                        </dd>
                      </div>
                    ) : null}
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
                <p className="league-list-empty">
                  Je hebt voor deze Grand Prix nog geen score.
                </p>
              )}
            </div>
          )}
        </article>

        <article className="dashboard-card dashboard-home-card dashboard-home-card--standings">
          <h2>Algemeen klassement</h2>
          <GlobalStandingsPanel
            grandPrix={
              latestGrandPrix
                ? { id: latestGrandPrix.id, name: latestGrandPrix.name }
                : null
            }
            deadlinePassed={Boolean(latestGrandPrix?.id)}
            standings={globalStandings}
          />
        </article>

        <article className="dashboard-card dashboard-home-card">
          <h2>Jouw Leagues</h2>
          {myLeagues.length === 0 ? (
            <div className="dashboard-empty-state">
              <p className="league-list-empty">
                Je zit nog niet in een league.
              </p>
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
          <h2>Huidige Grand Prix</h2>
          {currentGrandPrix ? (
            <div className="dashboard-data-list">
              <p className="dashboard-data-title">{currentGrandPrix.name}</p>
              <p>
                Status: <strong>{currentGrandPrixLabel}</strong>
              </p>
              <p>
                Deadline:{" "}
                {formatUtcIsoInAmsterdamShort(currentGrandPrix.deadline)}
              </p>
              {nextGrandPrix ? (
                <p>Volgende Grand Prix: {nextGrandPrix.name}</p>
              ) : null}
              <Link
                className="dashboard-secondary-cta"
                href={
                  firstLeagueId
                    ? `/leagues/${firstLeagueId}/gp-spel`
                    : "/leagues"
                }
              >
                Ga naar GP Spel
              </Link>
            </div>
          ) : (
            <p className="league-list-empty">
              Er is nog geen huidige Grand Prix beschikbaar.
            </p>
          )}
        </article>
      </section>
    </main>
  );
}

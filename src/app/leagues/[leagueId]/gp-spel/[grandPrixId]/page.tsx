import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";
import { resolveTeamSelectionTeam } from "@/lib/team-selection-teams";
import {
  getGrandPrixAndDriversById,
  getGrandPrixNavigation,
  getGrandPrixTimeline,
} from "@/lib/team-selection-data";

import { getAccessibleLeague } from "../../league-access";
import { GrandPrixSelector } from "../../grand-prix-selector";
import { PredictionsForm } from "../../predictions/predictions-form";
import { TeamSelectionCompactForm } from "../team-selection-compact-form";

type GPSpelGrandPrixPageProps = {
  params: {
    leagueId: string;
    grandPrixId: string;
  };
};

type ExistingTeamSelection = {
  id: string;
  team_selection_drivers: Array<{
    driver_id: string;
  }>;
};

type ExistingPrediction = {
  quali_p1: string;
  quali_p2: string;
  quali_p3: string;
  race_p1: string;
  race_p2: string;
  race_p3: string;
};

type UserGrandPrixScoreRow = {
  team_points: number | null;
  prediction_points: number | null;
  total_points: number | null;
  quali_prediction_points: number | null;
  sprint_quali_prediction_points: number | null;
  sprint_race_prediction_points: number | null;
  race_prediction_points: number | null;
};

type UserGrandPrixScoreDetailRow = {
  driver_id: string;
  team_quali_points: number | null;
  team_race_points: number | null;
  total_points: number | null;
  drivers: {
    name: string;
    constructor_team: string;
  } | null;
};

export default async function GPSpelGrandPrixPage({ params }: GPSpelGrandPrixPageProps) {
  const league = await getAccessibleLeague(params.leagueId);

  if (!league) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>Geen toegang</h1>
          <p>Deze pagina is alleen beschikbaar voor leden van deze league.</p>
          <Link href="/leagues" className="league-back-link">
            ← Terug naar je leagues
          </Link>
        </section>
      </main>
    );
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  try {
    const [timeline, gpData] = await Promise.all([
      getGrandPrixTimeline(supabase),
      getGrandPrixAndDriversById(supabase, params.grandPrixId),
    ]);

    const { previousGrandPrixId, nextGrandPrixId } = getGrandPrixNavigation(timeline, params.grandPrixId);

    const [{ data: existingTeamSelection }, { data: existingPrediction }, { data: userScore }, { data: userScoreDetails }] =
      await Promise.all([
        supabase
          .from("team_selections")
          .select("id, team_selection_drivers(driver_id)")
          .eq("user_id", user.id)
          .eq("grand_prix_id", gpData.grandPrix.id)
          .maybeSingle<ExistingTeamSelection>(),
        supabase
          .from("predictions")
          .select("quali_p1, quali_p2, quali_p3, race_p1, race_p2, race_p3")
          .eq("user_id", user.id)
          .eq("grand_prix_id", gpData.grandPrix.id)
          .maybeSingle<ExistingPrediction>(),
        supabase
          .from("grand_prix_scores")
          .select(
            "team_points, prediction_points, total_points, quali_prediction_points, sprint_quali_prediction_points, sprint_race_prediction_points, race_prediction_points",
          )
          .eq("user_id", user.id)
          .eq("grand_prix_id", gpData.grandPrix.id)
          .maybeSingle<UserGrandPrixScoreRow>(),
        supabase
          .from("grand_prix_score_details")
          .select("driver_id, team_quali_points, team_race_points, total_points, drivers(name, constructor_team)")
          .eq("user_id", user.id)
          .eq("grand_prix_id", gpData.grandPrix.id)
          .order("total_points", { ascending: false })
          .returns<UserGrandPrixScoreDetailRow[]>(),
      ]);

    const initialSelectedDriverIds =
      existingTeamSelection?.team_selection_drivers.map((teamSelectionDriver) => teamSelectionDriver.driver_id) ?? [];

    const initialPredictionValues = {
      qualiP1: existingPrediction?.quali_p1 ?? "",
      qualiP2: existingPrediction?.quali_p2 ?? "",
      qualiP3: existingPrediction?.quali_p3 ?? "",
      raceP1: existingPrediction?.race_p1 ?? "",
      raceP2: existingPrediction?.race_p2 ?? "",
      raceP3: existingPrediction?.race_p3 ?? "",
    };

    const isReadOnly = gpData.grandPrix.deadline <= new Date().toISOString();

    return (
      <main className="leagues-page">
        <section className="leagues-card gp-spel-card">
          <div className="league-detail-header">
            <div>
              <h1>GP Spel</h1>
              <p>
                Grand Prix: <strong>{gpData.grandPrix.name}</strong>
              </p>
            </div>
            <Link href="/" className="league-back-link">
              ← Terug naar dashboard
            </Link>
          </div>

          <nav className="gp-navigation" aria-label="Grand Prix navigatie">
            <GrandPrixSelector
              timeline={timeline}
              selectedGrandPrixId={gpData.grandPrix.id}
              routeBase={`/leagues/${league.id}/gp-spel`}
            />

            {previousGrandPrixId ? (
              <Link href={`/leagues/${league.id}/gp-spel/${previousGrandPrixId}`} className="league-back-link">
                ← Vorige GP
              </Link>
            ) : (
              <span className="league-back-link disabled-link" aria-disabled="true">
                ← Vorige GP
              </span>
            )}

            {nextGrandPrixId ? (
              <Link href={`/leagues/${league.id}/gp-spel/${nextGrandPrixId}`} className="league-back-link">
                Volgende GP →
              </Link>
            ) : (
              <span className="league-back-link disabled-link" aria-disabled="true">
                Volgende GP →
              </span>
            )}
          </nav>

          <section className="gp-spel-section" aria-labelledby="team-kiezen-title">
            <h2 id="team-kiezen-title">Team kiezen</h2>
            <TeamSelectionCompactForm
              leagueId={league.id}
              grandPrixId={gpData.grandPrix.id}
              drivers={gpData.drivers}
              initialSelectedDriverIds={initialSelectedDriverIds}
              savingDisabled={false}
              readOnly={isReadOnly}
              showFallbackNotice={gpData.usesFallbackPrices}
            />
          </section>

          <section className="gp-spel-section" aria-labelledby="voorspellingen-title">
            <h2 id="voorspellingen-title">Voorspellingen</h2>
            <PredictionsForm
              leagueId={league.id}
              grandPrixId={gpData.grandPrix.id}
              drivers={gpData.drivers}
              initialValues={initialPredictionValues}
              readOnly={isReadOnly}
            />
          </section>

          <section className="gp-spel-section" aria-labelledby="punten-overzicht-title">
            <h2 id="punten-overzicht-title">Puntenoverzicht</h2>

            {!userScore ? (
              <p className="league-list-empty">Nog geen punten gepubliceerd voor deze Grand Prix</p>
            ) : (
              <div className="dashboard-latest-result-card gp-spel-score-card">
                {(userScoreDetails ?? []).length > 0 ? (
                  <ul className="dashboard-result-driver-grid" aria-label="Teampunten per coureur">
                    {userScoreDetails.map((detail) => {
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
                              <dt>Team kwalificatie</dt>
                              <dd>{detail.team_quali_points ?? 0}</dd>
                            </div>
                            <div>
                              <dt>Team race</dt>
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

                <div className="gp-spel-score-breakdown-group">
                  <h3 className="gp-spel-score-breakdown-title">Voorspelling punten</h3>
                  <dl className="dashboard-result-driver-points gp-spel-score-breakdown-list">
                    <div>
                      <dt>Kwalificatie voorspelling</dt>
                      <dd>{userScore.quali_prediction_points ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Race voorspelling</dt>
                      <dd>{userScore.race_prediction_points ?? 0}</dd>
                    </div>
                    {(userScore.sprint_quali_prediction_points ?? 0) > 0 ? (
                      <div className="gp-spel-score-breakdown-subtle">
                        <dt>Sprint kwalificatie</dt>
                        <dd>{userScore.sprint_quali_prediction_points ?? 0}</dd>
                      </div>
                    ) : null}
                    {(userScore.sprint_race_prediction_points ?? 0) > 0 ? (
                      <div className="gp-spel-score-breakdown-subtle">
                        <dt>Sprint race</dt>
                        <dd>{userScore.sprint_race_prediction_points ?? 0}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <dl className="dashboard-result-summary">
                  <div className="dashboard-result-stat">
                    <dt>Team punten</dt>
                    <dd>{userScore.team_points ?? 0}</dd>
                  </div>
                  <div className="dashboard-result-stat">
                    <dt>Voorspelling punten</dt>
                    <dd>{userScore.prediction_points ?? 0}</dd>
                  </div>
                  <div className="dashboard-result-stat dashboard-result-total-stat">
                    <dt>Totaal punten</dt>
                    <dd>{userScore.total_points ?? 0}</dd>
                  </div>
                </dl>
              </div>
            )}
          </section>
        </section>
      </main>
    );
  } catch {
    return (
      <main className="leagues-page">
        <section className="leagues-card">
          <div className="league-detail-header">
            <div>
              <h1>GP Spel</h1>
              <p>Kon de Grand Prix niet laden.</p>
            </div>
            <Link href="/" className="league-back-link">
              ← Terug naar dashboard
            </Link>
          </div>
        </section>
      </main>
    );
  }
}

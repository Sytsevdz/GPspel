import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";
import { getGrandPrixStatusLabel, isGrandPrixCancelled } from "@/lib/grand-prix-status";
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

type UserGrandPrixPredictionScoreDetailRow = {
  prediction_type: "quali" | "race";
  slot_position: 1 | 2 | 3;
  points: number;
};

type PredictionSlotPoints = {
  qualiP1: number | null;
  qualiP2: number | null;
  qualiP3: number | null;
  raceP1: number | null;
  raceP2: number | null;
  raceP3: number | null;
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

    const [
      { data: existingTeamSelection },
      { data: existingPrediction },
      { data: userScore },
      { data: userScoreDetails },
      { data: predictionScoreDetails },
    ] = await Promise.all([
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
          .select("team_points, prediction_points, total_points, quali_prediction_points, race_prediction_points")
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
        supabase
          .from("grand_prix_prediction_score_details")
          .select("prediction_type, slot_position, points")
          .eq("user_id", user.id)
          .eq("grand_prix_id", gpData.grandPrix.id)
          .returns<UserGrandPrixPredictionScoreDetailRow[]>(),
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
    const slotPredictionPointsByField: PredictionSlotPoints = {
      qualiP1: null,
      qualiP2: null,
      qualiP3: null,
      raceP1: null,
      raceP2: null,
      raceP3: null,
    };
    (predictionScoreDetails ?? []).forEach((detail) => {
      const sectionPrefix = detail.prediction_type === "quali" ? "quali" : "race";
      const field = `${sectionPrefix}P${detail.slot_position}` as keyof PredictionSlotPoints;
      slotPredictionPointsByField[field] = detail.points;
    });
    const scoreDetails = userScoreDetails ?? [];
    const publishedDriverScores = Object.fromEntries(
      scoreDetails.map((detail) => [
        detail.driver_id,
        {
          qualiPoints: detail.team_quali_points,
          racePoints: detail.team_race_points,
          totalPoints: detail.total_points,
        },
      ]),
    );
    const hasPublishedQualiTeamPoints = scoreDetails.some((detail) => detail.team_quali_points !== null);
    const hasPublishedRaceTeamPoints = scoreDetails.some((detail) => detail.team_race_points !== null);
    const hasPublishedPredictionQualiPoints = userScore?.quali_prediction_points !== null;
    const hasPublishedPredictionRacePoints = userScore?.race_prediction_points !== null;

    const deadlineTimestamp = new Date(gpData.grandPrix.deadline).getTime();
    const isCancelled = isGrandPrixCancelled(gpData.grandPrix.status);
    const isReadOnly = isCancelled || deadlineTimestamp <= Date.now();

    return (
      <main className="leagues-page">
        <section className="leagues-card gp-spel-card">
          <div className="league-detail-header">
            <div>
              <h1>GP Spel</h1>
              <p>
                Grand Prix: <strong>{gpData.grandPrix.name}</strong>
              </p>
              {isCancelled ? <p className="gp-status-badge">{getGrandPrixStatusLabel(gpData.grandPrix.status)}</p> : null}
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
            <div className="gp-navigation-buttons">
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
            </div>
          </nav>

          {isCancelled ? (
            <section className="gp-spel-section">
              <p className="league-list-empty">
                Deze Grand Prix is geannuleerd. Team kiezen, voorspellingen en scores zijn niet van toepassing.
              </p>
            </section>
          ) : (
            <>
              <section className="gp-spel-section" aria-labelledby="team-kiezen-title">
                <div className="gp-spel-section-header">
                  <h2 id="team-kiezen-title">Team kiezen</h2>
                  {userScore ? <p className="gp-spel-section-points">Team punten: {userScore.team_points ?? 0}</p> : null}
                </div>
                <TeamSelectionCompactForm
                  leagueId={league.id}
                  grandPrixId={gpData.grandPrix.id}
                  drivers={gpData.drivers}
                  initialSelectedDriverIds={initialSelectedDriverIds}
                  publishedDriverScores={publishedDriverScores}
                  hasPublishedQualiPoints={hasPublishedQualiTeamPoints}
                  hasPublishedRacePoints={hasPublishedRaceTeamPoints}
                  savingDisabled={false}
                  readOnly={isReadOnly}
                  showFallbackNotice={gpData.usesFallbackPrices}
                />
              </section>

              <section className="gp-spel-section" aria-labelledby="voorspellingen-title">
                <div className="gp-spel-section-header">
                  <h2 id="voorspellingen-title">Voorspellingen</h2>
                  {userScore ? (
                    <p className="gp-spel-section-points">Voorspelling punten: {userScore.prediction_points ?? 0}</p>
                  ) : null}
                </div>
                <PredictionsForm
                  leagueId={league.id}
                  grandPrixId={gpData.grandPrix.id}
                  drivers={gpData.drivers}
                  initialValues={initialPredictionValues}
                  publishedPoints={{
                    quali: hasPublishedPredictionQualiPoints ? (userScore?.quali_prediction_points ?? 0) : null,
                    race: hasPublishedPredictionRacePoints ? (userScore?.race_prediction_points ?? 0) : null,
                  }}
                  publishedSlotPoints={slotPredictionPointsByField}
                  readOnly={isReadOnly}
                />
              </section>
            </>
          )}
          {!isCancelled && userScore ? (
            <section className="gp-spel-section gp-spel-totals-section" aria-label="Punten totaal">
              <dl className="gp-spel-inline-totals">
                <div>
                  <dt>Team punten</dt>
                  <dd>{userScore.team_points ?? 0}</dd>
                </div>
                <div>
                  <dt>Voorspelling punten</dt>
                  <dd>{userScore.prediction_points ?? 0}</dd>
                </div>
                <div>
                  <dt>Totaal punten</dt>
                  <dd>{userScore.total_points ?? 0}</dd>
                </div>
              </dl>
            </section>
          ) : !isCancelled ? (
            <p className="league-list-empty">Nog geen punten gepubliceerd voor deze Grand Prix</p>
          ) : null}
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

import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";
import {
  getGrandPrixAndDriversById,
  getGrandPrixNavigation,
  getGrandPrixTimeline,
} from "@/lib/team-selection-data";

import { getAccessibleLeague } from "../../league-access";
import { GrandPrixSelector } from "../../grand-prix-selector";
import { PlayerGrandPrixDetail } from "../../player-grand-prix-detail";
import { PredictionsForm } from "../predictions-form";

type PredictionsGrandPrixPageProps = {
  params: {
    leagueId: string;
    grandPrixId: string;
  };
};

type ExistingPrediction = {
  quali_p1: string;
  quali_p2: string;
  quali_p3: string;
  race_p1: string;
  race_p2: string;
  race_p3: string;
};

export default async function PredictionsGrandPrixPage({ params }: PredictionsGrandPrixPageProps) {
  const league = await getAccessibleLeague(params.leagueId);

  if (!league) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>Geen toegang</h1>
          <p>Deze pagina is alleen beschikbaar voor leden van deze competitie.</p>
          <Link href="/leagues" className="league-back-link">
            ← Terug naar je competities
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
    const [timeline, predictionData] = await Promise.all([
      getGrandPrixTimeline(supabase),
      getGrandPrixAndDriversById(supabase, params.grandPrixId),
    ]);

    const { previousGrandPrixId, nextGrandPrixId } = getGrandPrixNavigation(timeline, params.grandPrixId);

    const { data: members } = await supabase
      .from("league_members")
      .select("user_id, profiles(display_name)")
      .eq("league_id", league.id)
      .returns<Array<{ user_id: string; profiles: { display_name: string } | null }>>();

    const { data: existingPrediction } = await supabase
      .from("predictions")
      .select("quali_p1, quali_p2, quali_p3, race_p1, race_p2, race_p3")
      .eq("user_id", user.id)
      .eq("grand_prix_id", predictionData.grandPrix.id)
      .maybeSingle<ExistingPrediction>();

    const initialValues = {
      qualiP1: existingPrediction?.quali_p1 ?? "",
      qualiP2: existingPrediction?.quali_p2 ?? "",
      qualiP3: existingPrediction?.quali_p3 ?? "",
      raceP1: existingPrediction?.race_p1 ?? "",
      raceP2: existingPrediction?.race_p2 ?? "",
      raceP3: existingPrediction?.race_p3 ?? "",
    };

    const isReadOnly = predictionData.grandPrix.deadline <= new Date().toISOString();
    const leagueMembers =
      members?.map((member) => ({
        userId: member.user_id,
        displayName: member.profiles?.display_name ?? "Speler",
      })) ?? [];

    return (
      <main className="leagues-page">
        <section className="leagues-card">
          <div className="league-detail-header">
            <div>
              <h1>Voorspellingen</h1>
              <p>
                Grand Prix: <strong>{predictionData.grandPrix.name}</strong>
              </p>
            </div>
            <Link href={`/leagues/${league.id}`} className="league-back-link">
              ← Terug naar competitie
            </Link>
          </div>

          <nav className="gp-navigation" aria-label="Grand Prix navigatie">
            <GrandPrixSelector
              timeline={timeline}
              selectedGrandPrixId={predictionData.grandPrix.id}
              routeBase={`/leagues/${league.id}/predictions`}
            />

            {previousGrandPrixId ? (
              <Link href={`/leagues/${league.id}/predictions/${previousGrandPrixId}`} className="league-back-link">
                ← Vorige GP
              </Link>
            ) : (
              <span className="league-back-link disabled-link" aria-disabled="true">
                ← Vorige GP
              </span>
            )}

            {nextGrandPrixId ? (
              <Link href={`/leagues/${league.id}/predictions/${nextGrandPrixId}`} className="league-back-link">
                Volgende GP →
              </Link>
            ) : (
              <span className="league-back-link disabled-link" aria-disabled="true">
                Volgende GP →
              </span>
            )}
          </nav>

          <PredictionsForm
            leagueId={league.id}
            grandPrixId={predictionData.grandPrix.id}
            drivers={predictionData.drivers}
            initialValues={initialValues}
            readOnly={isReadOnly}
          />

          {leagueMembers.length > 0 ? (
            <PlayerGrandPrixDetail
              leagueId={league.id}
              grandPrixId={predictionData.grandPrix.id}
              grandPrixName={predictionData.grandPrix.name}
              deadlinePassed={isReadOnly}
              members={leagueMembers}
            />
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
              <h1>Voorspellingen</h1>
              <p>Kon de Grand Prix niet laden.</p>
            </div>
            <Link href={`/leagues/${league.id}`} className="league-back-link">
              ← Terug naar competitie
            </Link>
          </div>
        </section>
      </main>
    );
  }
}

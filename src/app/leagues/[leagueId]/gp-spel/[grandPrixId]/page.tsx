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
import { PredictionsForm } from "../../predictions/predictions-form";
import { TeamSelectionForm } from "../../team-selection/team-selection-form";

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

export default async function GPSpelGrandPrixPage({ params }: GPSpelGrandPrixPageProps) {
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
    const [timeline, gpData] = await Promise.all([
      getGrandPrixTimeline(supabase),
      getGrandPrixAndDriversById(supabase, params.grandPrixId),
    ]);

    const { previousGrandPrixId, nextGrandPrixId } = getGrandPrixNavigation(timeline, params.grandPrixId);

    const [{ data: existingTeamSelection }, { data: existingPrediction }] = await Promise.all([
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
            <Link href={`/leagues/${league.id}`} className="league-back-link">
              ← Terug naar competitie
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
            <TeamSelectionForm
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
            <Link href={`/leagues/${league.id}`} className="league-back-link">
              ← Terug naar competitie
            </Link>
          </div>
        </section>
      </main>
    );
  }
}

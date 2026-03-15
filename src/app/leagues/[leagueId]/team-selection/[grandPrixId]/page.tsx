import Link from "next/link";
import { redirect } from "next/navigation";

import {
  getGrandPrixAndDriversById,
  getGrandPrixNavigation,
  getGrandPrixTimeline,
} from "@/lib/team-selection-data";
import { createServerSupabaseClient } from "@/lib/supabase";

import { getAccessibleLeague } from "../../league-access";
import { TeamSelectionForm } from "../team-selection-form";

type TeamSelectionGrandPrixPageProps = {
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

export default async function TeamSelectionGrandPrixPage({ params }: TeamSelectionGrandPrixPageProps) {
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
    const [timeline, teamSelectionData] = await Promise.all([
      getGrandPrixTimeline(supabase),
      getGrandPrixAndDriversById(supabase, params.grandPrixId),
    ]);

    const { previousGrandPrixId, nextGrandPrixId } = getGrandPrixNavigation(timeline, params.grandPrixId);

    const { data: existingTeamSelection } = await supabase
      .from("team_selections")
      .select("id, team_selection_drivers(driver_id)")
      .eq("user_id", user.id)
      .eq("grand_prix_id", teamSelectionData.grandPrix.id)
      .maybeSingle<ExistingTeamSelection>();

    const initialSelectedDriverIds =
      existingTeamSelection?.team_selection_drivers.map((teamSelectionDriver) => teamSelectionDriver.driver_id) ?? [];

    const isReadOnly = teamSelectionData.grandPrix.deadline <= new Date().toISOString();

    return (
      <main className="leagues-page">
        <section className="leagues-card">
          <div className="league-detail-header">
            <div>
              <h1>Team kiezen</h1>
              <p>
                Grand Prix: <strong>{teamSelectionData.grandPrix.name}</strong>
              </p>
            </div>
            <Link href={`/leagues/${league.id}`} className="league-back-link">
              ← Terug naar competitie
            </Link>
          </div>

          <nav className="gp-navigation" aria-label="Grand Prix navigatie">
            {previousGrandPrixId ? (
              <Link href={`/leagues/${league.id}/team-selection/${previousGrandPrixId}`} className="league-back-link">
                ← Vorige GP
              </Link>
            ) : (
              <span className="league-back-link disabled-link" aria-disabled="true">
                ← Vorige GP
              </span>
            )}

            {nextGrandPrixId ? (
              <Link href={`/leagues/${league.id}/team-selection/${nextGrandPrixId}`} className="league-back-link">
                Volgende GP →
              </Link>
            ) : (
              <span className="league-back-link disabled-link" aria-disabled="true">
                Volgende GP →
              </span>
            )}
          </nav>

          <TeamSelectionForm
            leagueId={league.id}
            grandPrixId={teamSelectionData.grandPrix.id}
            drivers={teamSelectionData.drivers}
            initialSelectedDriverIds={initialSelectedDriverIds}
            savingDisabled={false}
            readOnly={isReadOnly}
          />
        </section>
      </main>
    );
  } catch {
    return (
      <main className="leagues-page">
        <section className="leagues-card">
          <div className="league-detail-header">
            <div>
              <h1>Team kiezen</h1>
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

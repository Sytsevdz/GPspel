import Link from "next/link";
import { redirect } from "next/navigation";

import { getSelectableGrandPrixAndDrivers } from "@/lib/team-selection-data";
import { createServerSupabaseClient } from "@/lib/supabase";

import { getAccessibleLeague } from "../league-access";
import { TeamSelectionForm } from "./team-selection-form";

type TeamSelectionPageProps = {
  params: {
    leagueId: string;
  };
};

type ExistingTeamSelection = {
  id: string;
  team_selection_drivers: Array<{
    driver_id: string;
  }>;
};

export default async function TeamSelectionPage({ params }: TeamSelectionPageProps) {
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

  const teamSelectionData = await getSelectableGrandPrixAndDrivers(supabase);

  const { data: existingTeamSelection } = await supabase
    .from("team_selections")
    .select("id, team_selection_drivers(driver_id)")
    .eq("user_id", user.id)
    .eq("grand_prix_id", teamSelectionData.grandPrix.id)
    .maybeSingle<ExistingTeamSelection>();

  const initialSelectedDriverIds =
    existingTeamSelection?.team_selection_drivers.map((teamSelectionDriver) => teamSelectionDriver.driver_id) ?? [];

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <div className="league-detail-header">
          <div>
            <h1>Team kiezen</h1>
            <p>
              Komende Grand Prix: <strong>{teamSelectionData.grandPrix.name}</strong>
            </p>
          </div>
          <Link href={`/leagues/${league.id}`} className="league-back-link">
            ← Terug naar competitie
          </Link>
        </div>

        <TeamSelectionForm
          leagueId={league.id}
          grandPrixId={teamSelectionData.grandPrix.id}
          drivers={teamSelectionData.drivers}
          initialSelectedDriverIds={initialSelectedDriverIds}
          savingDisabled={false}
        />

        <div style={{ marginTop: "1rem", fontSize: "0.875rem", opacity: 0.85 }}>
          <p>Debug: Databron: query</p>
          <p>
            Debug: Queryfout: geen
          </p>
        </div>
      </section>
    </main>
  );
}

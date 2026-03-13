import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase";

import { getAccessibleLeague } from "../league-access";
import { TeamSelectionForm } from "./team-selection-form";

type TeamSelectionPageProps = {
  params: {
    leagueId: string;
  };
};

type GrandPrix = {
  id: string;
  name: string;
  status: "upcoming" | "open" | "locked" | "finished";
  qualification_start: string;
  deadline: string;
};

type DriverPriceRow = {
  price: number;
  drivers: {
    id: string;
    name: string;
    constructor_team: string;
    active: boolean;
  } | null;
};

type ExistingTeamSelection = {
  id: string;
  team_selection_drivers: Array<{
    driver_id: string;
  }>;
};

const getUpcomingGrandPrix = async (supabase: ReturnType<typeof createServerSupabaseClient>) => {
  const nowIso = new Date().toISOString();

  const { data: selectableGrandPrix, error } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline")
    .in("status", ["upcoming", "open"])
    .gt("deadline", nowIso)
    .order("qualification_start", { ascending: true })
    .limit(1)
    .maybeSingle<GrandPrix>();

  if (error) {
    console.error("[TeamSelection] Grand Prix lookup failed", {
      nowIso,
      error,
    });
    return null;
  }

  return selectableGrandPrix ?? null;
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
    return null;
  }

  const upcomingGrandPrix = await getUpcomingGrandPrix(supabase);

  if (!upcomingGrandPrix) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>Team kiezen</h1>
          <p>Er is momenteel geen komende Grand Prix beschikbaar.</p>
          <Link href={`/leagues/${league.id}`} className="league-back-link">
            ← Terug naar competitie
          </Link>
        </section>
      </main>
    );
  }

  const { data: driverPriceRows, error: driversError } = await supabase
    .from("driver_prices")
    .select("price, drivers!inner(id, name, constructor_team, active)")
    .eq("grand_prix_id", upcomingGrandPrix.id)
    .eq("drivers.active", true)
    .order("price", { ascending: true })
    .returns<DriverPriceRow[]>();

  if (driversError || !driverPriceRows || driverPriceRows.length === 0) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>Team kiezen</h1>
          <p>Coureurs en prijzen konden niet worden geladen.</p>
          <Link href={`/leagues/${league.id}`} className="league-back-link">
            ← Terug naar competitie
          </Link>
        </section>
      </main>
    );
  }

  const { data: existingTeamSelection } = await supabase
    .from("team_selections")
    .select("id, team_selection_drivers(driver_id)")
    .eq("user_id", user.id)
    .eq("grand_prix_id", upcomingGrandPrix.id)
    .maybeSingle<ExistingTeamSelection>();

  const initialSelectedDriverIds =
    existingTeamSelection?.team_selection_drivers.map((teamSelectionDriver) => teamSelectionDriver.driver_id) ?? [];

  const drivers = driverPriceRows
    .filter((row) => row.drivers)
    .map((row) => ({
      id: row.drivers!.id,
      name: row.drivers!.name,
      constructorTeam: row.drivers!.constructor_team,
      price: row.price,
    }));

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <div className="league-detail-header">
          <div>
            <h1>Team kiezen</h1>
            <p>
              Komende Grand Prix: <strong>{upcomingGrandPrix.name}</strong>
            </p>
          </div>
          <Link href={`/leagues/${league.id}`} className="league-back-link">
            ← Terug naar competitie
          </Link>
        </div>

        <TeamSelectionForm
          leagueId={league.id}
          grandPrixId={upcomingGrandPrix.id}
          drivers={drivers}
          initialSelectedDriverIds={initialSelectedDriverIds}
        />
      </section>
    </main>
  );
}

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

const SEEDED_GRAND_PRIX_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const getSeededGrandPrix = async (supabase: ReturnType<typeof createServerSupabaseClient>) => {
  const { data: seededGrandPrix, error } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline")
    .eq("id", SEEDED_GRAND_PRIX_ID)
    .maybeSingle<GrandPrix>();

  console.log("[TeamSelection][TEMP] fetched GP", {
    seededGrandPrixId: SEEDED_GRAND_PRIX_ID,
    data: seededGrandPrix,
  });

  if (error) {
    console.error("[TeamSelection][TEMP] Supabase error while fetching GP", {
      seededGrandPrixId: SEEDED_GRAND_PRIX_ID,
      error,
    });
    return { grandPrix: null, hasError: true };
  }

  return { grandPrix: seededGrandPrix ?? null, hasError: false };
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

  const { grandPrix: seededGrandPrix, hasError: seededGrandPrixLoadFailed } = await getSeededGrandPrix(supabase);

  if (seededGrandPrixLoadFailed) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>Team kiezen</h1>
          <p>Er ging iets mis bij het laden van de test-Grand Prix.</p>
          <Link href={`/leagues/${league.id}`} className="league-back-link">
            ← Terug naar competitie
          </Link>
        </section>
      </main>
    );
  }

  if (!seededGrandPrix) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>Team kiezen</h1>
          <p>De test-Grand Prix kon niet worden geladen.</p>
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
    .eq("grand_prix_id", seededGrandPrix.id)
    .eq("drivers.active", true)
    .order("price", { ascending: true })
    .returns<DriverPriceRow[]>();

  console.log("[TeamSelection][TEMP] fetched driver prices", {
    grandPrixId: seededGrandPrix.id,
    data: driverPriceRows,
  });

  if (driversError) {
    console.error("[TeamSelection][TEMP] Supabase error while fetching driver prices", {
      grandPrixId: seededGrandPrix.id,
      error: driversError,
    });
  }

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
    .eq("grand_prix_id", seededGrandPrix.id)
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

  console.log("[TeamSelection][TEMP] fetched drivers", {
    grandPrixId: seededGrandPrix.id,
    data: drivers,
  });

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <div className="league-detail-header">
          <div>
            <h1>Team kiezen</h1>
            <p>
              Komende Grand Prix: <strong>{seededGrandPrix.name}</strong>
            </p>
          </div>
          <Link href={`/leagues/${league.id}`} className="league-back-link">
            ← Terug naar competitie
          </Link>
        </div>

        <TeamSelectionForm
          leagueId={league.id}
          grandPrixId={seededGrandPrix.id}
          drivers={drivers}
          initialSelectedDriverIds={initialSelectedDriverIds}
        />
      </section>
    </main>
  );
}

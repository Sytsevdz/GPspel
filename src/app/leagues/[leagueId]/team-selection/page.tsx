import Link from "next/link";
import { redirect } from "next/navigation";

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

const SEEDED_GRAND_PRIX: GrandPrix = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  name: "Dutch Grand Prix 2026",
  status: "open",
  qualification_start: "2026-08-29T13:00:00+00:00",
  deadline: "2026-08-29T13:00:00+00:00",
};

const SEEDED_DRIVERS = [
  {
    id: "d1111111-1111-1111-1111-111111111111",
    name: "Max Verstappen",
    constructorTeam: "Red Bull",
    price: 250,
  },
  {
    id: "d2222222-2222-2222-2222-222222222222",
    name: "Lando Norris",
    constructorTeam: "McLaren",
    price: 240,
  },
  {
    id: "d3333333-3333-3333-3333-333333333333",
    name: "Charles Leclerc",
    constructorTeam: "Ferrari",
    price: 230,
  },
  {
    id: "d4444444-4444-4444-4444-444444444444",
    name: "George Russell",
    constructorTeam: "Mercedes",
    price: 220,
  },
];

type DataSource = "query" | "fallback";

const getUpcomingGrandPrix = async (supabase: ReturnType<typeof createServerSupabaseClient>) => {
  const serverNowIso = new Date().toISOString();
  const knownSeededGrandPrixId = SEEDED_GRAND_PRIX.id;
  const primaryQueryDescription = {
    table: "grand_prix",
    select: "id, name, status, qualification_start, deadline",
    filters: {
      statusIn: ["upcoming", "open"],
      deadlineGt: serverNowIso,
    },
    orderBy: "qualification_start asc",
    limit: 1,
  };

  console.log("[TeamSelection] Grand Prix lookup started", {
    serverNowIso,
    query: primaryQueryDescription,
  });

  const { data: selectableGrandPrix, error } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline")
    .in("status", ["upcoming", "open"])
    .gt("deadline", serverNowIso)
    .order("qualification_start", { ascending: true })
    .limit(1)
    .maybeSingle<GrandPrix>();

  console.log("[TeamSelection] Grand Prix primary query result", {
    serverNowIso,
    query: primaryQueryDescription,
    result: selectableGrandPrix,
    error,
  });

  if (error) {
    console.error("[TeamSelection] Grand Prix lookup failed", {
      serverNowIso,
      query: primaryQueryDescription,
      error,
    });
    return {
      grandPrix: SEEDED_GRAND_PRIX,
      source: "fallback" as const,
      errorMessage: error.message,
    };
  }

  if (selectableGrandPrix) {
    return { grandPrix: selectableGrandPrix, source: "query" as const, errorMessage: null };
  }

  const fallbackQueryDescription = {
    table: "grand_prix",
    select: "id, name, status, qualification_start, deadline",
    filters: {
      idEq: knownSeededGrandPrixId,
    },
    limit: 1,
  };

  console.warn("[TeamSelection] No upcoming Grand Prix found, trying seeded fallback", {
    serverNowIso,
    query: fallbackQueryDescription,
  });

  const { data: fallbackGrandPrix, error: fallbackError } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline")
    .eq("id", knownSeededGrandPrixId)
    .maybeSingle<GrandPrix>();

  console.log("[TeamSelection] Grand Prix fallback query result", {
    serverNowIso,
    query: fallbackQueryDescription,
    result: fallbackGrandPrix,
    error: fallbackError,
  });

  if (fallbackError) {
    console.error("[TeamSelection] Seeded Grand Prix fallback failed", {
      serverNowIso,
      query: fallbackQueryDescription,
      error: fallbackError,
    });
    return {
      grandPrix: SEEDED_GRAND_PRIX,
      source: "fallback" as const,
      errorMessage: fallbackError.message,
    };
  }

  if (!fallbackGrandPrix) {
    return { grandPrix: SEEDED_GRAND_PRIX, source: "fallback" as const, errorMessage: null };
  }

  return { grandPrix: fallbackGrandPrix, source: "query" as const, errorMessage: null };
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

  const {
    grandPrix: upcomingGrandPrix,
    source: grandPrixSource,
    errorMessage: grandPrixErrorMessage,
  } = await getUpcomingGrandPrix(supabase);

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

  const queriedDrivers =
    driverPriceRows
      ?.filter((row) => row.drivers)
      .map((row) => ({
        id: row.drivers!.id,
        name: row.drivers!.name,
        constructorTeam: row.drivers!.constructor_team,
        price: row.price,
      })) ?? [];

  const driversSource: DataSource = driversError || queriedDrivers.length === 0 ? "fallback" : "query";
  const drivers = driversSource === "query" ? queriedDrivers : SEEDED_DRIVERS;
  const driversErrorMessage = driversError?.message ?? null;

  if (!upcomingGrandPrix || drivers.length === 0) {
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

        <div style={{ marginTop: "1rem", fontSize: "0.875rem", opacity: 0.85 }}>
          <p>Debug: Grand Prix bron: {grandPrixSource === "query" ? "query" : "fallback"}</p>
          <p>Debug: Coureurs bron: {driversSource === "query" ? "query" : "fallback"}</p>
          <p>
            Debug: Queryfout: {grandPrixErrorMessage ?? driversErrorMessage ?? "geen"}
          </p>
        </div>
      </section>
    </main>
  );
}

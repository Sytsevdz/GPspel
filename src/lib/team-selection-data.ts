import { createServerSupabaseClient } from "@/lib/supabase";

export type SelectableGrandPrix = {
  id: string;
  name: string;
  status: "upcoming" | "open" | "locked" | "finished";
  qualification_start: string;
  deadline: string;
};

export type SelectableDriver = {
  id: string;
  name: string;
  constructorTeam: string;
  price: number;
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

export type TeamSelectionDataResult = {
  grandPrix: SelectableGrandPrix;
  drivers: SelectableDriver[];
  source: "query" | "fallback";
  errorInfo: {
    grandPrixQueryError: string | null;
    driversQueryError: string | null;
  };
};

const SEEDED_GRAND_PRIX: SelectableGrandPrix = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  name: "Dutch Grand Prix 2026",
  status: "open",
  qualification_start: "2026-08-29T13:00:00+00:00",
  deadline: "2026-08-29T13:00:00+00:00",
};

const SEEDED_DRIVERS: SelectableDriver[] = [
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

export async function getSelectableGrandPrixAndDrivers(
  supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<TeamSelectionDataResult> {
  const serverNowIso = new Date().toISOString();

  const { data: grandPrix, error: grandPrixError } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline")
    .in("status", ["upcoming", "open"])
    .gt("deadline", serverNowIso)
    .order("qualification_start", { ascending: true })
    .limit(1)
    .maybeSingle<SelectableGrandPrix>();

  console.log("[TeamSelectionData] Grand Prix query result", grandPrix);
  console.log("[TeamSelectionData] Grand Prix query error", grandPrixError);

  if (grandPrixError || !grandPrix) {
    const source = "fallback" as const;
    console.log("[TeamSelectionData] final source used", source);

    return {
      grandPrix: SEEDED_GRAND_PRIX,
      drivers: SEEDED_DRIVERS,
      source,
      errorInfo: {
        grandPrixQueryError: grandPrixError?.message ?? (!grandPrix ? "Geen komende Grand Prix gevonden" : null),
        driversQueryError: null,
      },
    };
  }

  const { data: driverPriceRows, error: driversError } = await supabase
    .from("driver_prices")
    .select("price, drivers!inner(id, name, constructor_team, active)")
    .eq("grand_prix_id", grandPrix.id)
    .eq("drivers.active", true)
    .order("price", { ascending: true })
    .returns<DriverPriceRow[]>();

  console.log("[TeamSelectionData] driver_prices result count", driverPriceRows?.length ?? 0);
  console.log("[TeamSelectionData] driver_prices error", driversError);

  const drivers =
    driverPriceRows
      ?.filter((row) => row.drivers?.active)
      .map((row) => ({
        id: row.drivers!.id,
        name: row.drivers!.name,
        constructorTeam: row.drivers!.constructor_team,
        price: row.price,
      })) ?? [];

  if (driversError || drivers.length === 0) {
    const source = "fallback" as const;
    console.log("[TeamSelectionData] final source used", source);

    return {
      grandPrix: SEEDED_GRAND_PRIX,
      drivers: SEEDED_DRIVERS,
      source,
      errorInfo: {
        grandPrixQueryError: null,
        driversQueryError: driversError?.message ?? "Geen actieve coureurs met prijs gevonden",
      },
    };
  }

  const source = "query" as const;
  console.log("[TeamSelectionData] final source used", source);

  return {
    grandPrix,
    drivers,
    source,
    errorInfo: {
      grandPrixQueryError: null,
      driversQueryError: null,
    },
  };
}

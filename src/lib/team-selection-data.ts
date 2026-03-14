import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase";

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
};

export async function getSelectableGrandPrixAndDrivers(
  _supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<TeamSelectionDataResult> {
  const supabase = createAdminSupabaseClient();
  const serverNowIso = new Date().toISOString();

  console.log("Grand Prix query timestamp:", serverNowIso);

  const { data, error: grandPrixError } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline")
    .in("status", ["upcoming", "open"])
    .gt("deadline", serverNowIso)
    .order("qualification_start", { ascending: true })
    .limit(1)
    .returns<SelectableGrandPrix[]>();

  console.log("Grand Prix query result:", data);
  console.log("Grand Prix query error:", grandPrixError);

  const grandPrix = data?.[0] ?? null;

  if (grandPrixError || !grandPrix) {
    throw new Error(grandPrixError?.message ?? "Geen komende Grand Prix gevonden");
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
    throw new Error(driversError?.message ?? "Geen actieve coureurs met prijs gevonden");
  }

  return {
    grandPrix,
    drivers,
  };
}

import { createServerSupabaseClient } from "@/lib/supabase";

export type GrandPrixDriver = {
  id: string;
  name: string;
  constructor_team: string;
};

type DriverRow = GrandPrixDriver & {
  active: boolean;
};

type GrandPrixDriverEntryRow = {
  driver_id: string;
  constructor_team: string;
};

function mapEntriesToDrivers(entries: GrandPrixDriverEntryRow[], drivers: DriverRow[]): GrandPrixDriver[] {
  const driverNameById = new Map(drivers.map((driver) => [driver.id, driver.name]));

  return entries
    .map((entry) => {
      const name = driverNameById.get(entry.driver_id);

      if (!name) {
        throw new Error(`Coureur ${entry.driver_id} uit de GP-deelnemerslijst is niet gevonden`);
      }

      return { id: entry.driver_id, name, constructor_team: entry.constructor_team };
    })
    .sort(
      (left, right) =>
        left.constructor_team.localeCompare(right.constructor_team) || left.name.localeCompare(right.name),
    );
}

async function getGrandPrixDriverData(grandPrixId: string) {
  const normalizedGrandPrixId = grandPrixId.trim();
  if (!normalizedGrandPrixId) throw new Error("A Grand Prix id is required");

  const supabase = createServerSupabaseClient();
  const [{ data: drivers, error: driversError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase.from("drivers").select("id, name, constructor_team, active").order("name").returns<DriverRow[]>(),
    supabase
      .from("grand_prix_driver_entries")
      .select("driver_id, constructor_team")
      .eq("grand_prix_id", normalizedGrandPrixId)
      .returns<GrandPrixDriverEntryRow[]>(),
  ]);
  if (driversError) throw new Error(driversError.message);
  if (entriesError) throw new Error(entriesError.message);

  return { drivers: drivers ?? [], entries: entries ?? [] };
}

/** Returns only explicitly configured participants, without the master-driver fallback. */
export async function getExplicitGrandPrixDrivers(grandPrixId: string): Promise<GrandPrixDriver[]> {
  const { drivers, entries } = await getGrandPrixDriverData(grandPrixId);

  return mapEntriesToDrivers(entries, drivers);
}

/** The single source of truth for the drivers participating in a Grand Prix. */
export async function getGrandPrixDrivers(grandPrixId: string): Promise<GrandPrixDriver[]> {
  const { drivers, entries } = await getGrandPrixDriverData(grandPrixId);

  if (entries.length > 0) {
    return mapEntriesToDrivers(entries, drivers);
  }

  return drivers.filter((driver) => driver.active).map((driver) => ({
    id: driver.id,
    name: driver.name,
    constructor_team: driver.constructor_team,
  }));
}

import { createServerSupabaseClient } from "@/lib/supabase";

export type GrandPrixDriver = {
  id: string;
  name: string;
  constructor_team: string;
};

/** The single source of truth for the drivers participating in a Grand Prix. */
export async function getGrandPrixDrivers(grandPrixId: string): Promise<GrandPrixDriver[]> {
  const normalizedGrandPrixId = grandPrixId.trim();
  if (!normalizedGrandPrixId) throw new Error("A Grand Prix id is required");

  const supabase = createServerSupabaseClient();
  const [{ data: drivers, error: driversError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase.from("drivers").select("id, name, constructor_team, active").order("name"),
    supabase.from("grand_prix_driver_entries").select("driver_id, constructor_team").eq("grand_prix_id", normalizedGrandPrixId),
  ]);
  if (driversError) throw new Error(driversError.message);
  if (entriesError) throw new Error(entriesError.message);

  if (entries && entries.length > 0) {
    const driverNameById = new Map((drivers ?? []).map((driver) => [driver.id, driver.name]));
    return entries.flatMap((entry) => {
      const name = driverNameById.get(entry.driver_id);
      return name ? [{ id: entry.driver_id, name, constructor_team: entry.constructor_team }] : [];
    }).sort((left, right) => left.constructor_team.localeCompare(right.constructor_team) || left.name.localeCompare(right.name));
  }

  return (drivers ?? []).filter((driver) => driver.active).map((driver) => ({
    id: driver.id,
    name: driver.name,
    constructor_team: driver.constructor_team,
  }));
}

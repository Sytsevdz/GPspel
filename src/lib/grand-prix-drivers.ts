import { createServerSupabaseClient } from "@/lib/supabase";

export type GrandPrixDriver = {
  id: string;
  name: string;
  constructor_team: string;
  active: boolean;
  default_constructor_team: string;
  default_active: boolean;
  has_override: boolean;
};

/** The single source of truth for the effective driver roster of a Grand Prix. */
export async function getGrandPrixDrivers(grandPrixId: string): Promise<GrandPrixDriver[]> {
  const normalizedGrandPrixId = grandPrixId.trim();
  if (!normalizedGrandPrixId) throw new Error("A Grand Prix id is required");

  const supabase = createServerSupabaseClient();
  const [{ data: drivers, error: driversError }, { data: entries, error: entriesError }] = await Promise.all([
    supabase.from("drivers").select("id, name, constructor_team, active").order("name"),
    supabase.from("grand_prix_driver_entries").select("driver_id, constructor_team, is_active").eq("grand_prix_id", normalizedGrandPrixId),
  ]);
  if (driversError) throw new Error(driversError.message);
  if (entriesError) throw new Error(entriesError.message);

  const entryByDriverId = new Map((entries ?? []).map((entry) => [entry.driver_id, entry]));
  return (drivers ?? []).map((driver) => {
    const entry = entryByDriverId.get(driver.id);
    return {
      id: driver.id,
      name: driver.name,
      constructor_team: entry?.constructor_team ?? driver.constructor_team,
      active: entry?.is_active ?? driver.active,
      default_constructor_team: driver.constructor_team,
      default_active: driver.active,
      has_override: Boolean(entry),
    };
  });
}

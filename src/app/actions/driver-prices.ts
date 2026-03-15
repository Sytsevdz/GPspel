"use server";

import { revalidatePath } from "next/cache";

import { calculateDriverPricesFromRaceResults } from "@/lib/driver-pricing";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function generateGrandPrixPricesFromPreviousResult(grandPrixId: string): Promise<void> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Je bent niet ingelogd");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role !== "admin") {
    throw new Error("Je hebt geen toegang tot deze pagina.");
  }

  const { data: targetGrandPrix, error: targetGrandPrixError } = await supabase
    .from("grand_prix")
    .select("id, qualification_start")
    .eq("id", grandPrixId)
    .maybeSingle<{ id: string; qualification_start: string }>();

  if (targetGrandPrixError || !targetGrandPrix) {
    throw new Error("Grand Prix niet gevonden");
  }

  const { data: activeDrivers, error: activeDriversError } = await supabase
    .from("drivers")
    .select("id")
    .eq("active", true)
    .returns<Array<{ id: string }>>();

  if (activeDriversError) {
    throw new Error(activeDriversError.message);
  }

  const activeDriverIds = (activeDrivers ?? []).map((driver) => driver.id);

  if (activeDriverIds.length === 0) {
    throw new Error("Geen actieve coureurs gevonden");
  }

  const { data: previousGrandPrixCandidates, error: previousGrandPrixCandidatesError } = await supabase
    .from("grand_prix")
    .select("id")
    .lt("qualification_start", targetGrandPrix.qualification_start)
    .order("qualification_start", { ascending: false })
    .returns<Array<{ id: string }>>();

  if (previousGrandPrixCandidatesError) {
    throw new Error(previousGrandPrixCandidatesError.message);
  }

  let previousResults: Array<{ driver_id: string; race_position: number }> | null = null;

  for (const candidate of previousGrandPrixCandidates ?? []) {
    const { data: candidateResults, error: candidateResultsError } = await supabase
      .from("grand_prix_driver_results")
      .select("driver_id, race_position")
      .eq("grand_prix_id", candidate.id)
      .returns<Array<{ driver_id: string; race_position: number }>>();

    if (candidateResultsError) {
      throw new Error(candidateResultsError.message);
    }

    const rows = candidateResults ?? [];

    if (rows.length !== activeDriverIds.length) {
      continue;
    }

    const uniqueDriverIds = new Set(rows.map((row) => row.driver_id));

    if (uniqueDriverIds.size !== activeDriverIds.length) {
      continue;
    }

    previousResults = rows;
    break;
  }

  if (!previousResults) {
    throw new Error("Geen vorige Grand Prix met volledige race-uitslag gevonden");
  }

  const calculatedPrices = calculateDriverPricesFromRaceResults(
    activeDriverIds,
    previousResults.map((row) => ({
      driverId: row.driver_id,
      racePosition: row.race_position,
    })),
  );

  const upsertRows = calculatedPrices.map((row) => ({
    driver_id: row.driverId,
    grand_prix_id: grandPrixId,
    price: row.price,
  }));

  const { error: upsertError } = await supabase
    .from("driver_prices")
    .upsert(upsertRows, { onConflict: "driver_id,grand_prix_id" });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  revalidatePath("/admin");
}

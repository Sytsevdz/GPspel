"use server";

import { revalidatePath } from "next/cache";

import { calculateDriverPricesFromSeasonResults } from "@/lib/driver-pricing";
import { createServerSupabaseClient } from "@/lib/supabase";

type GrandPrixCandidate = {
  id: string;
  name: string;
  qualification_start: string;
};

type DriverResultRow = {
  grand_prix_id: string;
  driver_id: string;
  quali_position: number;
  race_position: number;
};

const NO_SOURCE_RESULTS_MESSAGE =
  "Er is nog geen afgeronde eerdere Grand Prix beschikbaar om prijzen op te baseren.";

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
    .select("id, name, qualification_start")
    .eq("id", grandPrixId)
    .maybeSingle<GrandPrixCandidate>();

  if (targetGrandPrixError || !targetGrandPrix) {
    throw new Error("Grand Prix niet gevonden");
  }

  const { data: activeDrivers, error: activeDriversError } = await supabase
    .from("drivers")
    .select("id, name")
    .eq("active", true)
    .returns<Array<{ id: string; name: string }>>();

  if (activeDriversError) {
    throw new Error(activeDriversError.message);
  }

  const activeDriverRows = activeDrivers ?? [];
  const activeDriverIds = activeDriverRows.map((driver) => driver.id);

  if (activeDriverIds.length === 0) {
    throw new Error("Geen actieve coureurs gevonden");
  }

  console.info("[driver-prices] Start prijsberekening", {
    targetGrandPrixId: targetGrandPrix.id,
    targetGrandPrixName: targetGrandPrix.name,
    targetQualificationStart: targetGrandPrix.qualification_start,
    expectedResultRows: activeDriverIds.length,
  });

  const { data: completedGrandPrixBeforeTarget, error: completedGrandPrixError } = await supabase
    .from("grand_prix")
    .select("id, name, qualification_start")
    .eq("status", "finished")
    .lt("qualification_start", targetGrandPrix.qualification_start)
    .order("qualification_start", { ascending: true })
    .returns<GrandPrixCandidate[]>();

  if (completedGrandPrixError) {
    throw new Error(completedGrandPrixError.message);
  }

  if (!completedGrandPrixBeforeTarget || completedGrandPrixBeforeTarget.length === 0) {
    console.warn("[driver-prices] Geen afgeronde eerdere GP gevonden voor prijsberekening", {
      targetGrandPrixId: targetGrandPrix.id,
      targetGrandPrixName: targetGrandPrix.name,
      reason: "no_completed_previous_gp",
    });

    throw new Error(NO_SOURCE_RESULTS_MESSAGE);
  }

  const completedGrandPrixIds = completedGrandPrixBeforeTarget.map((grandPrix) => grandPrix.id);

  console.info("[driver-prices] Afgeronde bron-GP's voor prijsberekening", {
    targetGrandPrixId: targetGrandPrix.id,
    targetGrandPrixName: targetGrandPrix.name,
    completedGrandPrixCount: completedGrandPrixIds.length,
    mostRecentCompletedGrandPrixId: completedGrandPrixIds[completedGrandPrixIds.length - 1],
  });

  const { data: completedDriverResults, error: completedDriverResultsError } = await supabase
    .from("grand_prix_driver_results")
    .select("grand_prix_id, driver_id, quali_position, race_position")
    .in("grand_prix_id", completedGrandPrixIds)
    .returns<DriverResultRow[]>();

  if (completedDriverResultsError) {
    throw new Error(completedDriverResultsError.message);
  }

  const calculatedPrices = calculateDriverPricesFromSeasonResults(
    activeDriverRows.map((driver) => ({
      driverId: driver.id,
      name: driver.name,
    })),
    completedGrandPrixIds,
    completedDriverResults?.map((row) => ({
      grandPrixId: row.grand_prix_id,
      driverId: row.driver_id,
      racePosition: row.race_position,
      qualiPosition: row.quali_position,
    })) ?? [],
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

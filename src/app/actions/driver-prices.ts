"use server";

import { revalidatePath } from "next/cache";

import {
  calculateDriverPricesFromSeasonResults,
  EXPECTED_GRAND_PRIX_DRIVER_COUNT,
} from "@/lib/driver-pricing";
import { isGrandPrixCancelled, type GrandPrixStatus } from "@/lib/grand-prix-status";
import { createServerSupabaseClient } from "@/lib/supabase";
import { getExplicitGrandPrixDrivers } from "@/lib/grand-prix-drivers";

type GrandPrixCandidate = {
  id: string;
  name: string;
  status: GrandPrixStatus;
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
    .select("id, name, status, qualification_start")
    .eq("id", grandPrixId)
    .maybeSingle<GrandPrixCandidate>();

  if (targetGrandPrixError || !targetGrandPrix) {
    throw new Error("Grand Prix niet gevonden");
  }
  if (isGrandPrixCancelled(targetGrandPrix.status)) {
    throw new Error("Deze Grand Prix is geannuleerd. Prijzen kunnen niet worden berekend.");
  }

  // Pricing must never use the active-master-driver fallback: a reserve driver may
  // be available globally without participating in this particular Grand Prix.
  const participatingDriverRows = await getExplicitGrandPrixDrivers(targetGrandPrix.id);
  const participatingDriverIds = participatingDriverRows.map((driver) => driver.id);

  if (participatingDriverIds.length === 0) {
    throw new Error("Stel eerst de GP-deelnemers in voordat je coureurprijzen berekent.");
  }

  if (participatingDriverIds.length !== EXPECTED_GRAND_PRIX_DRIVER_COUNT) {
    throw new Error(
      `De GP-deelnemerslijst moet exact ${EXPECTED_GRAND_PRIX_DRIVER_COUNT} coureurs bevatten voordat je coureurprijzen berekent.`,
    );
  }

  console.info("[driver-prices] Start prijsberekening", {
    targetGrandPrixId: targetGrandPrix.id,
    targetGrandPrixName: targetGrandPrix.name,
    targetQualificationStart: targetGrandPrix.qualification_start,
    expectedResultRows: participatingDriverIds.length,
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
    participatingDriverRows.map((driver) => ({
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

  const { data: existingPriceRows, error: existingPricesError } = await supabase
    .from("driver_prices")
    .select("driver_id")
    .eq("grand_prix_id", targetGrandPrix.id)
    .returns<Array<{ driver_id: string }>>();

  if (existingPricesError) {
    throw new Error(existingPricesError.message);
  }

  const participantIds = new Set(participatingDriverIds);
  const staleDriverIds = (existingPriceRows ?? [])
    .map((row) => row.driver_id)
    .filter((driverId) => !participantIds.has(driverId));

  if (staleDriverIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("driver_prices")
      .delete()
      .eq("grand_prix_id", targetGrandPrix.id)
      .in("driver_id", staleDriverIds);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  revalidatePath("/admin");
}

export async function resetDriverPrices(grandPrixId: string): Promise<void> {
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

  const { error: deleteError } = await supabase.from("driver_prices").delete().eq("grand_prix_id", grandPrixId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath("/admin");
}

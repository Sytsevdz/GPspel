"use server";

import { revalidatePath } from "next/cache";

import { calculateDriverPricesFromRaceResults } from "@/lib/driver-pricing";
import { createServerSupabaseClient } from "@/lib/supabase";

type GrandPrixCandidate = {
  id: string;
  name: string;
  qualification_start: string;
};

type DriverResultRow = {
  driver_id: string;
  race_position: number;
};

const NO_SOURCE_RESULTS_MESSAGE =
  "Er is nog geen eerdere Grand Prix met een volledige uitslag beschikbaar om prijzen op te baseren.";

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
    .select("id")
    .eq("active", true)
    .returns<Array<{ id: string }>>();

  if (activeDriversError) {
    throw new Error(activeDriversError.message);
  }

  const activeDriverIds = (activeDrivers ?? []).map((driver) => driver.id);
  const activeDriverSet = new Set(activeDriverIds);

  if (activeDriverIds.length === 0) {
    throw new Error("Geen actieve coureurs gevonden");
  }

  console.info("[driver-prices] Start prijsberekening", {
    targetGrandPrixId: targetGrandPrix.id,
    targetGrandPrixName: targetGrandPrix.name,
    targetQualificationStart: targetGrandPrix.qualification_start,
    expectedResultRows: activeDriverIds.length,
  });

  const { data: previousGrandPrixCandidates, error: previousGrandPrixCandidatesError } = await supabase
    .from("grand_prix")
    .select("id, name, qualification_start")
    .lt("qualification_start", targetGrandPrix.qualification_start)
    .order("qualification_start", { ascending: false })
    .returns<GrandPrixCandidate[]>();

  if (previousGrandPrixCandidatesError) {
    throw new Error(previousGrandPrixCandidatesError.message);
  }

  let selectedSourceGrandPrix: GrandPrixCandidate | null = null;
  let selectedSourceResults: DriverResultRow[] | null = null;

  for (const candidate of previousGrandPrixCandidates ?? []) {
    const { data: candidateResults, error: candidateResultsError } = await supabase
      .from("grand_prix_driver_results")
      .select("driver_id, race_position")
      .eq("grand_prix_id", candidate.id)
      .returns<DriverResultRow[]>();

    if (candidateResultsError) {
      throw new Error(candidateResultsError.message);
    }

    const rows = candidateResults ?? [];
    const uniqueDriverIds = new Set(rows.map((row) => row.driver_id));
    const hasOnlyActiveDrivers = rows.every((row) => activeDriverSet.has(row.driver_id));
    const uniqueRacePositions = new Set(rows.map((row) => row.race_position));

    console.info("[driver-prices] Controle kandidaat eerdere GP", {
      targetGrandPrixId: targetGrandPrix.id,
      candidateGrandPrixId: candidate.id,
      candidateGrandPrixName: candidate.name,
      candidateQualificationStart: candidate.qualification_start,
      resultRowsFound: rows.length,
      hasCompleteRows: rows.length === activeDriverIds.length,
      hasUniqueDriverIds: uniqueDriverIds.size === activeDriverIds.length,
      hasOnlyActiveDrivers,
      hasUniqueRacePositions: uniqueRacePositions.size === activeDriverIds.length,
    });

    const hasFullValidResult =
      rows.length === activeDriverIds.length &&
      uniqueDriverIds.size === activeDriverIds.length &&
      hasOnlyActiveDrivers &&
      uniqueRacePositions.size === activeDriverIds.length;

    if (!hasFullValidResult) {
      continue;
    }

    selectedSourceGrandPrix = candidate;
    selectedSourceResults = rows;
    break;
  }

  if (!selectedSourceGrandPrix || !selectedSourceResults) {
    console.warn("[driver-prices] Geen geldige eerdere GP gevonden voor prijsberekening", {
      targetGrandPrixId: targetGrandPrix.id,
      targetGrandPrixName: targetGrandPrix.name,
      reason: "no_previous_gp_with_full_valid_results",
    });

    throw new Error(NO_SOURCE_RESULTS_MESSAGE);
  }

  console.info("[driver-prices] Gekozen bron GP voor prijsberekening", {
    targetGrandPrixId: targetGrandPrix.id,
    targetGrandPrixName: targetGrandPrix.name,
    sourceGrandPrixId: selectedSourceGrandPrix.id,
    sourceGrandPrixName: selectedSourceGrandPrix.name,
    sourceResultRows: selectedSourceResults.length,
  });

  const calculatedPrices = calculateDriverPricesFromRaceResults(
    activeDriverIds,
    selectedSourceResults.map((row) => ({
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

"use server";

import { revalidatePath } from "next/cache";

import { getGrandPrixAndDriversById } from "@/lib/team-selection-data";
import { isGrandPrixCancelled } from "@/lib/grand-prix-status";
import { createServerSupabaseClient } from "@/lib/supabase";

export type PredictionsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const initialState: PredictionsActionState = {
  status: "idle",
};

export async function savePrediction(
  _prevState: PredictionsActionState = initialState,
  formData: FormData,
): Promise<PredictionsActionState> {
  const leagueId = String(formData.get("league_id") ?? "").trim();
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

  const qualiP1 = String(formData.get("quali_p1") ?? "").trim();
  const qualiP2 = String(formData.get("quali_p2") ?? "").trim();
  const qualiP3 = String(formData.get("quali_p3") ?? "").trim();
  const raceP1 = String(formData.get("race_p1") ?? "").trim();
  const raceP2 = String(formData.get("race_p2") ?? "").trim();
  const raceP3 = String(formData.get("race_p3") ?? "").trim();

  if (!leagueId || !grandPrixId || !qualiP1 || !qualiP2 || !qualiP3 || !raceP1 || !raceP2 || !raceP3) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je voorspelling",
    };
  }

  if (new Set([qualiP1, qualiP2, qualiP3]).size !== 3) {
    return {
      status: "error",
      message: "Je mag binnen kwalificatie geen coureur dubbel kiezen",
    };
  }

  if (new Set([raceP1, raceP2, raceP3]).size !== 3) {
    return {
      status: "error",
      message: "Je mag binnen race geen coureur dubbel kiezen",
    };
  }

  const supabase = createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je voorspelling",
    };
  }

  const { data: member } = await supabase
    .from("league_members")
    .select("user_id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je voorspelling",
    };
  }

  let teamSelectionData: Awaited<ReturnType<typeof getGrandPrixAndDriversById>>;

  try {
    teamSelectionData = await getGrandPrixAndDriversById(supabase, grandPrixId);
  } catch {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je voorspelling",
    };
  }

  if (teamSelectionData.grandPrix.deadline <= new Date().toISOString()) {
    return {
      status: "error",
      message: "De deadline van deze Grand Prix is verstreken.",
    };
  }

  if (isGrandPrixCancelled(teamSelectionData.grandPrix.status)) {
    return {
      status: "error",
      message: "Deze Grand Prix is geannuleerd. Voorspellingen zijn niet beschikbaar.",
    };
  }

  const allowedDriverIds = new Set(teamSelectionData.drivers.map((driver) => driver.id));
  const selectedIds = [qualiP1, qualiP2, qualiP3, raceP1, raceP2, raceP3];

  if (selectedIds.some((driverId) => !allowedDriverIds.has(driverId))) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je voorspelling",
    };
  }

  const { error: upsertError } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      grand_prix_id: grandPrixId,
      quali_p1: qualiP1,
      quali_p2: qualiP2,
      quali_p3: qualiP3,
      race_p1: raceP1,
      race_p2: raceP2,
      race_p3: raceP3,
    },
    { onConflict: "user_id,grand_prix_id" },
  );

  if (upsertError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je voorspelling",
    };
  }

  revalidatePath(`/leagues/${leagueId}/gp-spel`);
  revalidatePath(`/leagues/${leagueId}/gp-spel/${grandPrixId}`);

  return {
    status: "success",
    message: "Voorspelling succesvol opgeslagen",
  };
}

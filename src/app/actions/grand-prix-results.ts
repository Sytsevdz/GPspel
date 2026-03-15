"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase";

export type GrandPrixResultActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const initialState: GrandPrixResultActionState = {
  status: "idle",
};

export async function saveGrandPrixResult(
  _prevState: GrandPrixResultActionState = initialState,
  formData: FormData,
): Promise<GrandPrixResultActionState> {
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();
  const qualificationOrder = String(formData.get("qualification_order") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const raceOrder = String(formData.get("race_order") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!grandPrixId || qualificationOrder.length === 0 || raceOrder.length === 0) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan",
    };
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan",
    };
  }

  const { data: grandPrix } = await supabase
    .from("grand_prix")
    .select("id")
    .eq("id", grandPrixId)
    .maybeSingle<{ id: string }>();

  if (!grandPrix) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan",
    };
  }

  const { data: drivers } = await supabase.from("drivers").select("id").eq("active", true);

  const activeDriverIds = (drivers ?? []).map((driver) => driver.id);
  const activeDriverSet = new Set(activeDriverIds);

  if (
    qualificationOrder.length !== activeDriverIds.length ||
    raceOrder.length !== activeDriverIds.length ||
    new Set(qualificationOrder).size !== activeDriverIds.length ||
    new Set(raceOrder).size !== activeDriverIds.length
  ) {
    return {
      status: "error",
      message: "Elke actieve coureur moet precies één positie hebben in kwalificatie en race",
    };
  }

  const selectedDriverIds = [...qualificationOrder, ...raceOrder];

  if (selectedDriverIds.some((driverId) => !activeDriverSet.has(driverId))) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan",
    };
  }

  const rows = activeDriverIds.map((driverId) => ({
    grand_prix_id: grandPrixId,
    driver_id: driverId,
    quali_position: qualificationOrder.indexOf(driverId) + 1,
    race_position: raceOrder.indexOf(driverId) + 1,
  }));

  const { error: upsertError } = await supabase.from("grand_prix_driver_results").upsert(rows, {
    onConflict: "grand_prix_id,driver_id",
  });

  if (upsertError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan",
    };
  }

  revalidatePath(`/admin/grand-prix/${grandPrixId}/result`);

  return {
    status: "success",
    message: "Uitslag succesvol opgeslagen",
  };
}

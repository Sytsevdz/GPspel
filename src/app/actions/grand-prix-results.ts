"use server";

import { revalidatePath } from "next/cache";

import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase";

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

  const qualiP1 = String(formData.get("quali_p1") ?? "").trim();
  const qualiP2 = String(formData.get("quali_p2") ?? "").trim();
  const qualiP3 = String(formData.get("quali_p3") ?? "").trim();
  const raceP1 = String(formData.get("race_p1") ?? "").trim();
  const raceP2 = String(formData.get("race_p2") ?? "").trim();
  const raceP3 = String(formData.get("race_p3") ?? "").trim();

  if (!grandPrixId || !qualiP1 || !qualiP2 || !qualiP3 || !raceP1 || !raceP2 || !raceP3) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan",
    };
  }

  if (new Set([qualiP1, qualiP2, qualiP3]).size !== 3) {
    return {
      status: "error",
      message: "Binnen kwalificatie mag je geen coureur dubbel kiezen",
    };
  }

  if (new Set([raceP1, raceP2, raceP3]).size !== 3) {
    return {
      status: "error",
      message: "Binnen race mag je geen coureur dubbel kiezen",
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

  const adminSupabase = createAdminSupabaseClient();

  const { data: grandPrix } = await adminSupabase
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

  const { data: drivers } = await adminSupabase.from("drivers").select("id").eq("active", true);

  const activeDriverIds = new Set((drivers ?? []).map((driver) => driver.id));
  const selectedDriverIds = [qualiP1, qualiP2, qualiP3, raceP1, raceP2, raceP3];

  if (selectedDriverIds.some((driverId) => !activeDriverIds.has(driverId))) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan",
    };
  }

  const { error: upsertError } = await adminSupabase.from("grand_prix_results").upsert(
    {
      grand_prix_id: grandPrixId,
      quali_p1: qualiP1,
      quali_p2: qualiP2,
      quali_p3: qualiP3,
      race_p1: raceP1,
      race_p2: raceP2,
      race_p3: raceP3,
    },
    {
      onConflict: "grand_prix_id",
    },
  );

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

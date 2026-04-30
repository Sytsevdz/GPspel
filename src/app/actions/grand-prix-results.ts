"use server";

import { revalidatePath } from "next/cache";

import {
  calculateGrandPrixQualificationScores,
  calculateGrandPrixRaceScores,
  calculateGrandPrixSprintQualificationScores,
  calculateGrandPrixSprintRaceScores,
} from "@/app/actions/grand-prix-scores";
import { isGrandPrixCancelled, type GrandPrixStatus } from "@/lib/grand-prix-status";
import { createServerSupabaseClient } from "@/lib/supabase";

export type GrandPrixResultActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const initialState: GrandPrixResultActionState = {
  status: "idle",
};

async function requireAdminAndGrandPrix(grandPrixId: string) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { supabase: null, error: "Er ging iets mis bij het opslaan" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role !== "admin") {
    return { supabase: null, error: "Je hebt geen toegang tot deze pagina." };
  }

  const { data: grandPrix } = await supabase
    .from("grand_prix")
    .select("id, status, is_sprint_weekend")
    .eq("id", grandPrixId)
    .maybeSingle<{ id: string; status: GrandPrixStatus; is_sprint_weekend: boolean }>();

  if (!grandPrix) {
    return { supabase: null, error: "Er ging iets mis bij het opslaan" };
  }
  if (isGrandPrixCancelled(grandPrix.status)) {
    return { supabase: null, error: "Deze Grand Prix is geannuleerd. Deze actie is niet beschikbaar." };
  }

  return { supabase, error: null };
}

export async function publishGrandPrixQualificationScores(
  _prevState: GrandPrixResultActionState = initialState,
  formData: FormData,
): Promise<GrandPrixResultActionState> {
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

  if (!grandPrixId) {
    return {
      status: "error",
      message: "Er ging iets mis bij het publiceren",
    };
  }

  const { error } = await requireAdminAndGrandPrix(grandPrixId);

  if (error) {
    return {
      status: "error",
      message: error,
    };
  }

  await calculateGrandPrixQualificationScores(grandPrixId);

  revalidatePath(`/admin/grand-prix/${grandPrixId}`);
  revalidatePath(`/admin/grand-prix/${grandPrixId}/result`);

  return {
    status: "success",
    message: "Kwalificatiepunten gepubliceerd",
  };
}

export async function publishGrandPrixSprintQualificationScores(
  _prevState: GrandPrixResultActionState = initialState,
  formData: FormData,
): Promise<GrandPrixResultActionState> {
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

  if (!grandPrixId) {
    return {
      status: "error",
      message: "Er ging iets mis bij het publiceren",
    };
  }

  const { error } = await requireAdminAndGrandPrix(grandPrixId);

  if (error) {
    return {
      status: "error",
      message: error,
    };
  }

  await calculateGrandPrixSprintQualificationScores(grandPrixId);

  revalidatePath(`/admin/grand-prix/${grandPrixId}`);
  revalidatePath(`/admin/grand-prix/${grandPrixId}/result`);

  return {
    status: "success",
    message: "Sprintkwalificatiepunten gepubliceerd",
  };
}

export async function publishGrandPrixSprintRaceScores(
  _prevState: GrandPrixResultActionState = initialState,
  formData: FormData,
): Promise<GrandPrixResultActionState> {
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

  if (!grandPrixId) {
    return {
      status: "error",
      message: "Er ging iets mis bij het publiceren",
    };
  }

  const { error } = await requireAdminAndGrandPrix(grandPrixId);

  if (error) {
    return {
      status: "error",
      message: error,
    };
  }

  await calculateGrandPrixSprintRaceScores(grandPrixId);

  revalidatePath(`/admin/grand-prix/${grandPrixId}`);
  revalidatePath(`/admin/grand-prix/${grandPrixId}/result`);

  return {
    status: "success",
    message: "Sprintracepunten gepubliceerd",
  };
}

export async function publishGrandPrixFinalScores(
  _prevState: GrandPrixResultActionState = initialState,
  formData: FormData,
): Promise<GrandPrixResultActionState> {
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

  if (!grandPrixId) {
    return {
      status: "error",
      message: "Er ging iets mis bij het publiceren",
    };
  }

  const adminCheck = await requireAdminAndGrandPrix(grandPrixId);

  if (adminCheck.error || !adminCheck.supabase) {
    return {
      status: "error",
      message: adminCheck.error ?? "Er ging iets mis bij het publiceren",
    };
  }

  await calculateGrandPrixRaceScores(grandPrixId);
  const { error: statusUpdateError } = await adminCheck.supabase
    .from("grand_prix")
    .update({ status: "finished" })
    .eq("id", grandPrixId);

  if (statusUpdateError) {
    return {
      status: "error",
      message: "Racepunten zijn gepubliceerd, maar status bijwerken naar afgerond mislukte.",
    };
  }

  revalidatePath(`/admin/grand-prix/${grandPrixId}`);
  revalidatePath(`/admin/grand-prix/${grandPrixId}/result`);

  return {
    status: "success",
    message: "Racepunten gepubliceerd",
  };
}

export async function resetGrandPrixPlayerScores(
  _prevState: GrandPrixResultActionState = initialState,
  formData: FormData,
): Promise<GrandPrixResultActionState> {
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

  if (!grandPrixId) {
    return {
      status: "error",
      message: "Er ging iets mis bij het resetten",
    };
  }

  const adminCheck = await requireAdminAndGrandPrix(grandPrixId);

  if (adminCheck.error || !adminCheck.supabase) {
    return {
      status: "error",
      message: adminCheck.error ?? "Er ging iets mis bij het resetten",
    };
  }

  const { error: detailDeleteError } = await adminCheck.supabase
    .from("grand_prix_score_details")
    .delete()
    .eq("grand_prix_id", grandPrixId);

  if (detailDeleteError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het resetten",
    };
  }

  const { error: predictionDetailDeleteError } = await adminCheck.supabase
    .from("grand_prix_prediction_score_details")
    .delete()
    .eq("grand_prix_id", grandPrixId);

  if (predictionDetailDeleteError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het resetten",
    };
  }

  const { error: scoreDeleteError } = await adminCheck.supabase.from("grand_prix_scores").delete().eq("grand_prix_id", grandPrixId);

  if (scoreDeleteError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het resetten",
    };
  }

  revalidatePath(`/admin/grand-prix/${grandPrixId}`);
  revalidatePath(`/admin/grand-prix/${grandPrixId}/result`);

  return {
    status: "success",
    message: "Spelerspunten voor deze GP zijn gereset",
  };
}

export async function resetGrandPrixResult(
  _prevState: GrandPrixResultActionState = initialState,
  formData: FormData,
): Promise<GrandPrixResultActionState> {
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

  if (!grandPrixId) {
    return {
      status: "error",
      message: "Er ging iets mis bij het resetten",
    };
  }

  const adminCheck = await requireAdminAndGrandPrix(grandPrixId);

  if (adminCheck.error || !adminCheck.supabase) {
    return {
      status: "error",
      message: adminCheck.error ?? "Er ging iets mis bij het resetten",
    };
  }

  const { error: deleteError } = await adminCheck.supabase.from("grand_prix_driver_results").delete().eq("grand_prix_id", grandPrixId);

  if (deleteError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het resetten",
    };
  }

  revalidatePath(`/admin/grand-prix/${grandPrixId}`);
  revalidatePath(`/admin/grand-prix/${grandPrixId}/result`);

  return {
    status: "success",
    message: "Uitslag voor deze GP is gereset",
  };
}

export async function saveGrandPrixResult(
  _prevState: GrandPrixResultActionState = initialState,
  formData: FormData,
): Promise<GrandPrixResultActionState> {
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();
  const qualificationOrder = String(formData.get("qualification_order") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const sprintQualificationOrder = String(formData.get("sprint_qualification_order") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const sprintRaceOrder = String(formData.get("sprint_race_order") ?? "")
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

  const adminCheck = await requireAdminAndGrandPrix(grandPrixId);

  if (adminCheck.error || !adminCheck.supabase) {
    return {
      status: "error",
      message: adminCheck.error ?? "Er ging iets mis bij het opslaan",
    };
  }

  const { data: drivers } = await adminCheck.supabase.from("drivers").select("id").eq("active", true);

  const activeDriverIds = (drivers ?? []).map((driver) => driver.id);
  const activeDriverSet = new Set(activeDriverIds);

  const isSprintWeekend = adminCheck.supabase ? (await adminCheck.supabase.from("grand_prix").select("is_sprint_weekend").eq("id", grandPrixId).maybeSingle<{is_sprint_weekend:boolean}>()).data?.is_sprint_weekend === true : false;
  if (
    qualificationOrder.length !== activeDriverIds.length ||
    raceOrder.length !== activeDriverIds.length ||
    new Set(qualificationOrder).size !== activeDriverIds.length ||
    new Set(raceOrder).size !== activeDriverIds.length ||
    (isSprintWeekend &&
      (sprintQualificationOrder.length !== activeDriverIds.length ||
        sprintRaceOrder.length !== activeDriverIds.length ||
        new Set(sprintQualificationOrder).size !== activeDriverIds.length ||
        new Set(sprintRaceOrder).size !== activeDriverIds.length))
  ) {
    return {
      status: "error",
      message: "Elke actieve coureur moet precies één positie hebben in kwalificatie, sprint kwalificatie, sprint race en race",
    };
  }

  const selectedDriverIds = [...qualificationOrder, ...sprintQualificationOrder, ...sprintRaceOrder, ...raceOrder];

  if (selectedDriverIds.some((driverId) => !activeDriverSet.has(driverId))) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan",
    };
  }

  const qualiPositionByDriverId = new Map(qualificationOrder.map((driverId, index) => [driverId, index + 1]));
  const sprintQualiPositionByDriverId = new Map(sprintQualificationOrder.map((driverId, index) => [driverId, index + 1]));
  const sprintRacePositionByDriverId = new Map(sprintRaceOrder.map((driverId, index) => [driverId, index + 1]));
  const racePositionByDriverId = new Map(raceOrder.map((driverId, index) => [driverId, index + 1]));

  const rows = activeDriverIds.map((driverId) => ({
    grand_prix_id: grandPrixId,
    driver_id: driverId,
    quali_position: qualiPositionByDriverId.get(driverId)!,
    sprint_quali_position: isSprintWeekend ? (sprintQualiPositionByDriverId.get(driverId) ?? null) : null,
    sprint_race_position: isSprintWeekend ? (sprintRacePositionByDriverId.get(driverId) ?? null) : null,
    race_position: racePositionByDriverId.get(driverId)!,
  }));

  const { error: deleteError } = await adminCheck.supabase.from("grand_prix_driver_results").delete().eq("grand_prix_id", grandPrixId);

  if (deleteError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan",
    };
  }

  const { error: insertError } = await adminCheck.supabase.from("grand_prix_driver_results").insert(rows);

  if (insertError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan",
    };
  }

  revalidatePath(`/admin/grand-prix/${grandPrixId}`);
  revalidatePath(`/admin/grand-prix/${grandPrixId}/result`);

  return {
    status: "success",
    message: "Uitslag succesvol opgeslagen",
  };
}

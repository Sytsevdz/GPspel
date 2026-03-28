"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase";
import { parseAmsterdamDateTimeLocalToUtcIso } from "@/lib/datetime";

const DEADLINE_ERROR_MESSAGE = "Er ging iets mis bij het opslaan van de deadline";
const DEADLINE_SUCCESS_MESSAGE = "Deadline succesvol opgeslagen";

export type DeadlineActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const INITIAL_STATE: DeadlineActionState = { status: "idle" };

export async function updateGrandPrixDeadline(
  _prevState: DeadlineActionState = INITIAL_STATE,
  formData: FormData,
): Promise<DeadlineActionState> {
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();
  const deadline = parseAmsterdamDateTimeLocalToUtcIso(formData.get("deadline"));
  const qualificationStart = parseAmsterdamDateTimeLocalToUtcIso(formData.get("qualification_start"));

  if (!grandPrixId || !deadline || !qualificationStart) {
    return { status: "error", message: DEADLINE_ERROR_MESSAGE } as const;
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { status: "error", message: DEADLINE_ERROR_MESSAGE } as const;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role !== "admin") {
    return { status: "error", message: DEADLINE_ERROR_MESSAGE } as const;
  }

  const { error: updateError } = await supabase
    .from("grand_prix")
    .update({
      deadline,
      qualification_start: qualificationStart,
    })
    .eq("id", grandPrixId);

  if (updateError) {
    return { status: "error", message: DEADLINE_ERROR_MESSAGE } as const;
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/grand-prix/${grandPrixId}`);
  revalidatePath(`/admin/grand-prix/${grandPrixId}/deadline`);

  return { status: "success", message: DEADLINE_SUCCESS_MESSAGE } as const;
}

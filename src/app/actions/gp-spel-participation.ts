"use server";

import { revalidatePath } from "next/cache";

import { savePrediction } from "@/app/actions/predictions";
import { saveTeamSelection } from "@/app/actions/team-selection";

export type GPSpelParticipationActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

const initialState: GPSpelParticipationActionState = {
  status: "idle",
};

export async function saveGPSpelParticipation(
  _prevState: GPSpelParticipationActionState = initialState,
  formData: FormData,
): Promise<GPSpelParticipationActionState> {
  const teamResult = await saveTeamSelection(undefined, formData);

  if (teamResult.status !== "success") {
    return {
      status: "error",
      message: teamResult.message ?? "Er ging iets mis bij het opslaan.",
    };
  }

  const predictionResult = await savePrediction(undefined, formData);

  if (predictionResult.status !== "success") {
    return {
      status: "error",
      message: predictionResult.message ?? "Er ging iets mis bij het opslaan.",
    };
  }

  const leagueId = String(formData.get("league_id") ?? "").trim();
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

  if (leagueId && grandPrixId) {
    revalidatePath(`/leagues/${leagueId}/gp-spel`);
    revalidatePath(`/leagues/${leagueId}/gp-spel/${grandPrixId}`);
  }

  return {
    status: "success",
    message: "Team en voorspellingen opgeslagen.",
  };
}

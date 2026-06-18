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

  const sprintQualiP1 = String(formData.get("sprint_quali_p1") ?? "").trim();
  const sprintQualiP2 = String(formData.get("sprint_quali_p2") ?? "").trim();
  const sprintQualiP3 = String(formData.get("sprint_quali_p3") ?? "").trim();
  const sprintRaceP1 = String(formData.get("sprint_race_p1") ?? "").trim();
  const sprintRaceP2 = String(formData.get("sprint_race_p2") ?? "").trim();
  const sprintRaceP3 = String(formData.get("sprint_race_p3") ?? "").trim();

  const qualiP1 = String(formData.get("quali_p1") ?? "").trim();
  const qualiP2 = String(formData.get("quali_p2") ?? "").trim();
  const qualiP3 = String(formData.get("quali_p3") ?? "").trim();
  const raceP1 = String(formData.get("race_p1") ?? "").trim();
  const raceP2 = String(formData.get("race_p2") ?? "").trim();
  const raceP3 = String(formData.get("race_p3") ?? "").trim();
  const fastestPitstopTeam = String(
    formData.get("fastest_pitstop_team") ?? "",
  ).trim();
  const bonusQuestionId = String(formData.get("bonus_question_id") ?? "").trim();
  const bonusAnswerPositionValue = String(
    formData.get("bonus_answer_position") ?? "",
  ).trim();
  const bonusAnswerPosition = bonusAnswerPositionValue
    ? Number(bonusAnswerPositionValue)
    : null;

  if (
    !leagueId ||
    !grandPrixId ||
    !qualiP1 ||
    !qualiP2 ||
    !qualiP3 ||
    !raceP1 ||
    !raceP2 ||
    !raceP3 ||
    (!bonusQuestionId && !fastestPitstopTeam)
  ) {
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

  if (isGrandPrixCancelled(teamSelectionData.grandPrix.status)) {
    return {
      status: "error",
      message:
        "Deze Grand Prix is geannuleerd. Voorspellingen zijn niet beschikbaar.",
    };
  }

  if (
    teamSelectionData.grandPrix.status === "locked" ||
    teamSelectionData.grandPrix.status === "finished"
  ) {
    return {
      status: "error",
      message: "De deadline van deze Grand Prix is verstreken.",
    };
  }

  const isSprintWeekend = teamSelectionData.grandPrix.is_sprint_weekend;

  if (isSprintWeekend) {
    if (
      !sprintQualiP1 ||
      !sprintQualiP2 ||
      !sprintQualiP3 ||
      !sprintRaceP1 ||
      !sprintRaceP2 ||
      !sprintRaceP3
    ) {
      return {
        status: "error",
        message: "Vul ook sprint kwalificatie en sprint race in.",
      };
    }

    if (new Set([sprintQualiP1, sprintQualiP2, sprintQualiP3]).size !== 3) {
      return {
        status: "error",
        message: "Je mag binnen sprint kwalificatie geen coureur dubbel kiezen",
      };
    }

    if (new Set([sprintRaceP1, sprintRaceP2, sprintRaceP3]).size !== 3) {
      return {
        status: "error",
        message: "Je mag binnen sprint race geen coureur dubbel kiezen",
      };
    }
  }

  const allowedDriverIds = new Set(
    teamSelectionData.drivers.map((driver) => driver.id),
  );
  const allowedConstructorTeams = new Set(
    teamSelectionData.drivers.map((driver) => driver.constructorTeam),
  );
  const selectedIds = [
    qualiP1,
    qualiP2,
    qualiP3,
    raceP1,
    raceP2,
    raceP3,
    sprintQualiP1,
    sprintQualiP2,
    sprintQualiP3,
    sprintRaceP1,
    sprintRaceP2,
    sprintRaceP3,
  ].filter(Boolean);

  if (
    selectedIds.some((driverId) => !allowedDriverIds.has(driverId)) ||
    (!bonusQuestionId && !allowedConstructorTeams.has(fastestPitstopTeam))
  ) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je voorspelling",
    };
  }

  const predictionRow: Record<string, string | null> = {
    user_id: user.id,
    grand_prix_id: grandPrixId,
    quali_p1: qualiP1,
    quali_p2: qualiP2,
    quali_p3: qualiP3,
    race_p1: raceP1,
    race_p2: raceP2,
    race_p3: raceP3,
    sprint_quali_p1: isSprintWeekend ? sprintQualiP1 : null,
    sprint_quali_p2: isSprintWeekend ? sprintQualiP2 : null,
    sprint_quali_p3: isSprintWeekend ? sprintQualiP3 : null,
    sprint_race_p1: isSprintWeekend ? sprintRaceP1 : null,
    sprint_race_p2: isSprintWeekend ? sprintRaceP2 : null,
    sprint_race_p3: isSprintWeekend ? sprintRaceP3 : null,
  };

  if (!bonusQuestionId) {
    predictionRow.fastest_pitstop_team = fastestPitstopTeam;
  }

  const { error: upsertError } = await supabase.from("predictions").upsert(
    predictionRow,
    { onConflict: "user_id,grand_prix_id" },
  );

  if (upsertError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je voorspelling",
    };
  }

  revalidatePath(`/leagues/${leagueId}/gp-spel`);
  if (bonusQuestionId) {
    if (
      !Number.isInteger(bonusAnswerPosition) ||
      bonusAnswerPosition === null ||
      bonusAnswerPosition < 1 ||
      bonusAnswerPosition > teamSelectionData.drivers.length
    ) {
      return {
        status: "error",
        message: "Kies een geldige plek voor de bonusvraag",
      };
    }

    const { data: bonusQuestion, error: bonusQuestionError } = await supabase
      .from("grand_prix_bonus_questions")
      .select("id, grand_prix_id, question_type")
      .eq("id", bonusQuestionId)
      .eq("grand_prix_id", grandPrixId)
      .maybeSingle<{ id: string; grand_prix_id: string; question_type: string }>();

    if (bonusQuestionError || bonusQuestion?.question_type !== "driver_finish_position") {
      return {
        status: "error",
        message: "Er ging iets mis bij het opslaan van je bonusvoorspelling",
      };
    }

    const { error: bonusUpsertError } = await supabase
      .from("grand_prix_bonus_predictions")
      .upsert(
        {
          grand_prix_bonus_question_id: bonusQuestionId,
          user_id: user.id,
          answer_position: bonusAnswerPosition,
        },
        { onConflict: "grand_prix_bonus_question_id,user_id" },
      );

    if (bonusUpsertError) {
      return {
        status: "error",
        message: "Je voorspelling is opgeslagen, maar de bonusvraag opslaan mislukte",
      };
    }
  }

  revalidatePath(`/leagues/${leagueId}/gp-spel/${grandPrixId}`);

  return {
    status: "success",
    message: "Voorspelling succesvol opgeslagen",
  };
}

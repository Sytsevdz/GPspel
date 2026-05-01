"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { isSessionPublished } from "@/lib/session-publication";
import { isGrandPrixCancelled, resolveGrandPrixWorkflowStatus, type GrandPrixStatus } from "@/lib/grand-prix-status";

type PodiumEntry = {
  id: string;
  name: string;
  constructorTeam: string;
};

type TeamScoreDetail = {
  driverId: string;
  teamSprintQualiPoints: number | null;
  teamSprintRacePoints: number | null;
  teamQualiPoints: number | null;
  teamRacePoints: number | null;
  totalPoints: number | null;
};

type PredictionSlotScore = {
  predictionType: "sprint_quali" | "sprint_race" | "quali" | "race";
  slotPosition: 1 | 2 | 3;
  points: number | null;
};

export type PlayerGrandPrixViewResult =
  | {
      status: "success";
      playerName: string;
      teamSelection: PodiumEntry[];
      qualificationPodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null;
      sprintQualificationPodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null;
      sprintRacePodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null;
      racePodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null;
      hasPredictions: boolean;
      isSprintWeekend: boolean;
      teamScoreDetails: TeamScoreDetail[];
      predictionSlotScores: PredictionSlotScore[];
      totals: {
        teamPoints: number | null;
        predictionPoints: number | null;
        totalPoints: number | null;
      };
      publication: {
        sprintQualiPublished: boolean;
        sprintRacePublished: boolean;
        qualiPublished: boolean;
        racePublished: boolean;
      };
    }
  | {
      status: "error";
      message: string;
    };

const GENERIC_ERROR_MESSAGE = "De gegevens van deze speler konden niet worden geladen.";

async function loadPlayerGrandPrixViewData(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  safeGrandPrixId: string,
  safePlayerId: string,
  safePlayerName: string,
): Promise<PlayerGrandPrixViewResult> {
  const { data: grandPrix } = await supabase
    .from("grand_prix")
    .select("deadline, status, is_sprint_weekend")
    .eq("id", safeGrandPrixId)
    .maybeSingle<{ deadline: string; status: GrandPrixStatus; is_sprint_weekend: boolean }>();

  if (!grandPrix) {
    return {
      status: "error",
      message: GENERIC_ERROR_MESSAGE,
    };
  }

  const workflowStatus = resolveGrandPrixWorkflowStatus({
    status: grandPrix.status,
    deadline: grandPrix.deadline,
  });

  if (isGrandPrixCancelled(workflowStatus)) {
    return {
      status: "error",
      message: "Deze Grand Prix is geannuleerd.",
    };
  }

  if (workflowStatus === "upcoming") {
    return {
      status: "error",
      message: "Deze keuzes worden zichtbaar zodra de kwalificatiedeadline is verstreken.",
    };
  }

  const [{ data: teamSelection }, { data: prediction }, { data: teamScoreDetails }, { data: predictionSlotScores }, { data: totals }] =
    await Promise.all([
    supabase
      .from("team_selections")
      .select("id, team_selection_drivers(driver_id, drivers(id, name, constructor_team))")
      .eq("user_id", safePlayerId)
      .eq("grand_prix_id", safeGrandPrixId)
      .maybeSingle<{
        id: string;
        team_selection_drivers: Array<{
          driver_id: string;
          drivers: {
            id: string;
            name: string;
            constructor_team: string;
          } | null;
        }>;
      }>(),
    supabase
      .from("predictions")
      .select("sprint_quali_p1, sprint_quali_p2, sprint_quali_p3, sprint_race_p1, sprint_race_p2, sprint_race_p3, quali_p1, quali_p2, quali_p3, race_p1, race_p2, race_p3")
      .eq("user_id", safePlayerId)
      .eq("grand_prix_id", safeGrandPrixId)
      .maybeSingle<{
        sprint_quali_p1: string | null;
        sprint_quali_p2: string | null;
        sprint_quali_p3: string | null;
        sprint_race_p1: string | null;
        sprint_race_p2: string | null;
        sprint_race_p3: string | null;
        quali_p1: string | null;
        quali_p2: string | null;
        quali_p3: string | null;
        race_p1: string | null;
        race_p2: string | null;
        race_p3: string | null;
      }>(),
    supabase
      .from("grand_prix_score_details")
      .select("driver_id, team_sprint_quali_points, team_sprint_race_points, team_quali_points, team_race_points, total_points")
      .eq("user_id", safePlayerId)
      .eq("grand_prix_id", safeGrandPrixId)
      .returns<
        Array<{
          driver_id: string;
          team_sprint_quali_points: number | null;
          team_sprint_race_points: number | null;
          team_quali_points: number | null;
          team_race_points: number | null;
          total_points: number | null;
        }>
      >(),
    supabase
      .from("grand_prix_prediction_score_details")
      .select("prediction_type, slot_position, points")
      .eq("user_id", safePlayerId)
      .eq("grand_prix_id", safeGrandPrixId)
      .returns<
        Array<{
          prediction_type: "sprint_quali" | "sprint_race" | "quali" | "race";
          slot_position: 1 | 2 | 3;
          points: number | null;
        }>
      >(),
    supabase
      .from("grand_prix_scores")
      .select("team_points, prediction_points, total_points, team_sprint_quali_points, team_sprint_race_points, team_quali_points, team_race_points")
      .eq("user_id", safePlayerId)
      .eq("grand_prix_id", safeGrandPrixId)
      .maybeSingle<{
        team_points: number | null;
        prediction_points: number | null;
        total_points: number | null;
        team_sprint_quali_points: number | null;
        team_sprint_race_points: number | null;
        team_quali_points: number | null;
        team_race_points: number | null;
      }>(),
  ]);

  const teamSelectionRows = teamSelection?.team_selection_drivers ?? [];

  const teamSelectionDrivers = teamSelectionRows
    .map((row) => row.drivers)
    .filter((row): row is { id: string; name: string; constructor_team: string } => Boolean(row))
    .map((driver) => ({
      id: driver.id,
      name: driver.name,
      constructorTeam: driver.constructor_team,
    }));

  let qualificationPodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null = null;
  let sprintQualificationPodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null = null;
  let sprintRacePodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null = null;
  let racePodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null = null;

  const hasAnyPredictionSection = Boolean(
    prediction &&
      (
        prediction.sprint_quali_p1 ||
        prediction.sprint_quali_p2 ||
        prediction.sprint_quali_p3 ||
        prediction.sprint_race_p1 ||
        prediction.sprint_race_p2 ||
        prediction.sprint_race_p3 ||
        prediction.quali_p1 ||
        prediction.quali_p2 ||
        prediction.quali_p3 ||
        prediction.race_p1 ||
        prediction.race_p2 ||
        prediction.race_p3
      ),
  );

  if (prediction) {
    const predictionDriverIds = [
      prediction.sprint_quali_p1,
      prediction.sprint_quali_p2,
      prediction.sprint_quali_p3,
      prediction.sprint_race_p1,
      prediction.sprint_race_p2,
      prediction.sprint_race_p3,
      prediction.quali_p1,
      prediction.quali_p2,
      prediction.quali_p3,
      prediction.race_p1,
      prediction.race_p2,
      prediction.race_p3,
    ].filter((driverId): driverId is string => Boolean(driverId));

    const uniqueDriverIds = Array.from(new Set(predictionDriverIds));

    const { data: predictionDrivers } = await supabase
      .from("drivers")
      .select("id, name, constructor_team")
      .in("id", uniqueDriverIds)
      .returns<Array<{ id: string; name: string; constructor_team: string }>>();

    const driversById = new Map(
      (predictionDrivers ?? []).map((driver) => [
        driver.id,
        { id: driver.id, name: driver.name, constructorTeam: driver.constructor_team },
      ]),
    );

    const buildPodium = (ids: Array<string | null>) => {
      const mapped = ids
        .map((driverId) => (driverId ? driversById.get(driverId) : null))
        .filter((entry): entry is PodiumEntry => Boolean(entry));

      return mapped.length === 3 ? ([mapped[0], mapped[1], mapped[2]] as [PodiumEntry, PodiumEntry, PodiumEntry]) : null;
    };

    sprintQualificationPodium = buildPodium([prediction.sprint_quali_p1, prediction.sprint_quali_p2, prediction.sprint_quali_p3]);
    sprintRacePodium = buildPodium([prediction.sprint_race_p1, prediction.sprint_race_p2, prediction.sprint_race_p3]);
    qualificationPodium = buildPodium([prediction.quali_p1, prediction.quali_p2, prediction.quali_p3]);
    racePodium = buildPodium([prediction.race_p1, prediction.race_p2, prediction.race_p3]);
  }

  return {
    status: "success",
    playerName: safePlayerName,
    teamSelection: teamSelectionDrivers,
    qualificationPodium,
    sprintQualificationPodium,
    sprintRacePodium,
    racePodium,
    hasPredictions: hasAnyPredictionSection,
    isSprintWeekend: grandPrix.is_sprint_weekend,
    teamScoreDetails: (teamScoreDetails ?? []).map((detail) => ({
      driverId: detail.driver_id,
      teamSprintQualiPoints: detail.team_sprint_quali_points,
      teamSprintRacePoints: detail.team_sprint_race_points,
      teamQualiPoints: detail.team_quali_points,
      teamRacePoints: detail.team_race_points,
      totalPoints: detail.total_points,
    })),
    predictionSlotScores: (predictionSlotScores ?? []).map((detail) => ({
      predictionType: detail.prediction_type,
      slotPosition: detail.slot_position,
      points: detail.points,
    })),
    totals: {
      teamPoints: totals?.team_points ?? null,
      predictionPoints: totals?.prediction_points ?? null,
      totalPoints: totals?.total_points ?? null,
    },
    publication: {
      sprintQualiPublished: isSessionPublished(totals, "team_sprint_quali_points"),
      sprintRacePublished: isSessionPublished(totals, "team_sprint_race_points"),
      qualiPublished: isSessionPublished(totals, "team_quali_points"),
      racePublished: isSessionPublished(totals, "team_race_points"),
    },
  };
}

export async function getPlayerGrandPrixView(
  leagueId: string,
  grandPrixId: string,
  playerId: string,
  playerName: string,
): Promise<PlayerGrandPrixViewResult> {
  const safeLeagueId = leagueId.trim();
  const safeGrandPrixId = grandPrixId.trim();
  const safePlayerId = playerId.trim();
  const safePlayerName = playerName.trim() || "Speler";

  if (!safeLeagueId || !safeGrandPrixId || !safePlayerId) {
    return {
      status: "error",
      message: GENERIC_ERROR_MESSAGE,
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
      message: "Log opnieuw in om spelergegevens te bekijken.",
    };
  }

  const { data: leagueMembership } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", safeLeagueId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!leagueMembership) {
    return {
      status: "error",
      message: "Je hebt geen toegang tot deze competitie.",
    };
  }

  const { data: selectedPlayerMembership } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", safeLeagueId)
    .eq("user_id", safePlayerId)
    .maybeSingle();

  if (!selectedPlayerMembership) {
    return {
      status: "error",
      message: GENERIC_ERROR_MESSAGE,
    };
  }

  return loadPlayerGrandPrixViewData(supabase, safeGrandPrixId, safePlayerId, safePlayerName);
}

export async function getGlobalPlayerGrandPrixView(
  grandPrixId: string,
  playerId: string,
  playerName: string,
): Promise<PlayerGrandPrixViewResult> {
  const safeGrandPrixId = grandPrixId.trim();
  const safePlayerId = playerId.trim();
  const safePlayerName = playerName.trim() || "Speler";

  if (!safeGrandPrixId || !safePlayerId) {
    return {
      status: "error",
      message: GENERIC_ERROR_MESSAGE,
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
      message: "Log opnieuw in om spelergegevens te bekijken.",
    };
  }

  return loadPlayerGrandPrixViewData(supabase, safeGrandPrixId, safePlayerId, safePlayerName);
}

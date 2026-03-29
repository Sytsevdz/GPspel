"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { isGrandPrixCancelled, resolveGrandPrixWorkflowStatus, type GrandPrixStatus } from "@/lib/grand-prix-status";

type PodiumEntry = {
  id: string;
  name: string;
  constructorTeam: string;
};

type TeamScoreDetail = {
  driverId: string;
  teamQualiPoints: number | null;
  teamRacePoints: number | null;
  totalPoints: number | null;
};

type PredictionSlotScore = {
  predictionType: "quali" | "race";
  slotPosition: 1 | 2 | 3;
  points: number | null;
};

export type PlayerGrandPrixViewResult =
  | {
      status: "success";
      playerName: string;
      teamSelection: PodiumEntry[];
      qualificationPodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null;
      racePodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null;
      teamScoreDetails: TeamScoreDetail[];
      predictionSlotScores: PredictionSlotScore[];
      totals: {
        teamPoints: number | null;
        predictionPoints: number | null;
        totalPoints: number | null;
      };
    }
  | {
      status: "error";
      message: string;
    };

const GENERIC_ERROR_MESSAGE = "De gegevens van deze speler konden niet worden geladen.";

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

  const { data: grandPrix } = await supabase
    .from("grand_prix")
    .select("deadline, status")
    .eq("id", safeGrandPrixId)
    .maybeSingle<{ deadline: string; status: GrandPrixStatus }>();

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
      .select("quali_p1, quali_p2, quali_p3, race_p1, race_p2, race_p3")
      .eq("user_id", safePlayerId)
      .eq("grand_prix_id", safeGrandPrixId)
      .maybeSingle<{
        quali_p1: string;
        quali_p2: string;
        quali_p3: string;
        race_p1: string;
        race_p2: string;
        race_p3: string;
      }>(),
    supabase
      .from("grand_prix_score_details")
      .select("driver_id, team_quali_points, team_race_points, total_points")
      .eq("user_id", safePlayerId)
      .eq("grand_prix_id", safeGrandPrixId)
      .returns<
        Array<{
          driver_id: string;
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
          prediction_type: "quali" | "race";
          slot_position: 1 | 2 | 3;
          points: number | null;
        }>
      >(),
    supabase
      .from("grand_prix_scores")
      .select("team_points, prediction_points, total_points")
      .eq("user_id", safePlayerId)
      .eq("grand_prix_id", safeGrandPrixId)
      .maybeSingle<{
        team_points: number | null;
        prediction_points: number | null;
        total_points: number | null;
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
  let racePodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null = null;

  if (prediction) {
    const predictionDriverIds = [
      prediction.quali_p1,
      prediction.quali_p2,
      prediction.quali_p3,
      prediction.race_p1,
      prediction.race_p2,
      prediction.race_p3,
    ];

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

    const qualifyEntries = [prediction.quali_p1, prediction.quali_p2, prediction.quali_p3]
      .map((driverId) => driversById.get(driverId))
      .filter((entry): entry is PodiumEntry => Boolean(entry));

    const raceEntries = [prediction.race_p1, prediction.race_p2, prediction.race_p3]
      .map((driverId) => driversById.get(driverId))
      .filter((entry): entry is PodiumEntry => Boolean(entry));

    if (qualifyEntries.length === 3) {
      qualificationPodium = [qualifyEntries[0], qualifyEntries[1], qualifyEntries[2]];
    }

    if (raceEntries.length === 3) {
      racePodium = [raceEntries[0], raceEntries[1], raceEntries[2]];
    }
  }

  return {
    status: "success",
    playerName: safePlayerName,
    teamSelection: teamSelectionDrivers,
    qualificationPodium,
    racePodium,
    teamScoreDetails: (teamScoreDetails ?? []).map((detail) => ({
      driverId: detail.driver_id,
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
  };
}

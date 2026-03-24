"use server";

import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase";

type PodiumEntry = {
  id: string;
  name: string;
  constructorTeam: string;
};

export type PlayerGrandPrixViewResult =
  | {
      status: "success";
      playerName: string;
      teamSelection: PodiumEntry[];
      qualificationPodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null;
      racePodium: [PodiumEntry, PodiumEntry, PodiumEntry] | null;
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
): Promise<PlayerGrandPrixViewResult> {
  const safeLeagueId = leagueId.trim();
  const safeGrandPrixId = grandPrixId.trim();
  const safePlayerId = playerId.trim();

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
    .select("deadline")
    .eq("id", safeGrandPrixId)
    .maybeSingle<{ deadline: string }>();

  if (!grandPrix) {
    return {
      status: "error",
      message: GENERIC_ERROR_MESSAGE,
    };
  }

  if (grandPrix.deadline > new Date().toISOString()) {
    return {
      status: "error",
      message: "Deze keuzes worden zichtbaar zodra de kwalificatiedeadline is verstreken.",
    };
  }

  const adminClient = createAdminSupabaseClient();

  const { data: selectedPlayerMembership } = await adminClient
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

  const [{ data: profile }, { data: teamSelection }, { data: prediction }] = await Promise.all([
    adminClient.from("profiles").select("display_name").eq("id", safePlayerId).maybeSingle<{ display_name: string }>(),
    adminClient
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
    adminClient
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

    const { data: predictionDrivers } = await adminClient
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
    playerName: profile?.display_name ?? "Speler",
    teamSelection: teamSelectionDrivers,
    qualificationPodium,
    racePodium,
  };
}

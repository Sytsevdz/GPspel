"use server";

import { createAdminSupabaseClient } from "@/lib/supabase";

type GrandPrixDriverResultRow = {
  driver_id: string;
  quali_position: number;
  race_position: number;
};

type TeamSelectionRow = {
  user_id: string;
  team_selection_drivers: Array<{
    driver_id: string;
  }> | null;
};

type PredictionRow = {
  user_id: string;
  quali_p1: string;
  quali_p2: string;
  quali_p3: string;
  race_p1: string;
  race_p2: string;
  race_p3: string;
};

const F1_RACE_POINTS_BY_POSITION: Record<number, number> = {
  1: 25,
  2: 18,
  3: 15,
  4: 12,
  5: 10,
  6: 8,
  7: 6,
  8: 4,
  9: 2,
  10: 1,
};

const getRacePointsForPosition = (position: number) => F1_RACE_POINTS_BY_POSITION[position] ?? 0;

const calculateTopThreePredictionPoints = (predictedTopThree: string[], actualTopThree: string[]) => {
  let points = 0;

  predictedTopThree.forEach((driverId, index) => {
    if (driverId === actualTopThree[index]) {
      points += 10;
      return;
    }

    if (actualTopThree.includes(driverId)) {
      points += 5;
    }
  });

  return points;
};

const buildTopThreeByPosition = (rows: GrandPrixDriverResultRow[], positionKey: "quali_position" | "race_position") =>
  rows
    .filter((row) => row[positionKey] >= 1 && row[positionKey] <= 3)
    .sort((left, right) => left[positionKey] - right[positionKey])
    .map((row) => row.driver_id)
    .slice(0, 3);

export async function calculateGrandPrixScores(grandPrixId: string) {
  const normalizedGrandPrixId = grandPrixId.trim();

  if (!normalizedGrandPrixId) {
    throw new Error("calculateGrandPrixScores requires a valid grandPrixId");
  }

  console.info(`[calculateGrandPrixScores] Starting calculation for grandPrixId=${normalizedGrandPrixId}`);

  const supabase = createAdminSupabaseClient();

  const { data: driverResultRows, error: driverResultsError } = await supabase
    .from("grand_prix_driver_results")
    .select("driver_id, quali_position, race_position")
    .eq("grand_prix_id", normalizedGrandPrixId);

  if (driverResultsError) {
    throw new Error(`[calculateGrandPrixScores] Failed to load grand_prix_driver_results: ${driverResultsError.message}`);
  }

  const typedDriverResultRows = (driverResultRows ?? []) as GrandPrixDriverResultRow[];
  const officialQualiTopThree = buildTopThreeByPosition(typedDriverResultRows, "quali_position");
  const officialRaceTopThree = buildTopThreeByPosition(typedDriverResultRows, "race_position");

  const racePointsByDriverId = new Map<string, number>();
  typedDriverResultRows.forEach((row) => {
    racePointsByDriverId.set(row.driver_id, getRacePointsForPosition(row.race_position));
  });

  const { data: teamSelections, error: teamSelectionsError } = await supabase
    .from("team_selections")
    .select("user_id, team_selection_drivers(driver_id)")
    .eq("grand_prix_id", normalizedGrandPrixId);

  if (teamSelectionsError) {
    throw new Error(`[calculateGrandPrixScores] Failed to load team selections: ${teamSelectionsError.message}`);
  }

  const typedTeamSelections = (teamSelections ?? []) as TeamSelectionRow[];
  console.info(`[calculateGrandPrixScores] Team selections loaded: ${typedTeamSelections.length}`);

  const teamPointsByUserId = new Map<string, number>();

  typedTeamSelections.forEach((selection) => {
    const teamPoints = (selection.team_selection_drivers ?? []).reduce((total, selectedDriver) => {
      return total + (racePointsByDriverId.get(selectedDriver.driver_id) ?? 0);
    }, 0);

    teamPointsByUserId.set(selection.user_id, teamPoints);
  });

  const { data: predictions, error: predictionsError } = await supabase
    .from("predictions")
    .select("user_id, quali_p1, quali_p2, quali_p3, race_p1, race_p2, race_p3")
    .eq("grand_prix_id", normalizedGrandPrixId);

  if (predictionsError) {
    throw new Error(`[calculateGrandPrixScores] Failed to load predictions: ${predictionsError.message}`);
  }

  const typedPredictions = (predictions ?? []) as PredictionRow[];
  console.info(`[calculateGrandPrixScores] Predictions loaded: ${typedPredictions.length}`);

  const predictionPointsByUserId = new Map<string, number>();

  typedPredictions.forEach((prediction) => {
    const qualificationPoints = calculateTopThreePredictionPoints(
      [prediction.quali_p1, prediction.quali_p2, prediction.quali_p3],
      officialQualiTopThree,
    );

    const racePoints = calculateTopThreePredictionPoints(
      [prediction.race_p1, prediction.race_p2, prediction.race_p3],
      officialRaceTopThree,
    );

    predictionPointsByUserId.set(prediction.user_id, qualificationPoints + racePoints);
  });

  const allUserIds = new Set<string>([...teamPointsByUserId.keys(), ...predictionPointsByUserId.keys()]);

  const rowsToUpsert = [...allUserIds]
    .sort()
    .map((userId) => {
      const teamPoints = teamPointsByUserId.get(userId) ?? 0;
      const predictionPoints = predictionPointsByUserId.get(userId) ?? 0;

      return {
        grand_prix_id: normalizedGrandPrixId,
        user_id: userId,
        team_points: teamPoints,
        prediction_points: predictionPoints,
        total_points: teamPoints + predictionPoints,
      };
    });

  if (rowsToUpsert.length === 0) {
    console.info("[calculateGrandPrixScores] Scores written: 0");
    return { scoresWritten: 0 };
  }

  const { error: upsertError } = await supabase.from("grand_prix_scores").upsert(rowsToUpsert, {
    onConflict: "grand_prix_id,user_id",
  });

  if (upsertError) {
    throw new Error(`[calculateGrandPrixScores] Failed to upsert scores: ${upsertError.message}`);
  }

  console.info(`[calculateGrandPrixScores] Scores written: ${rowsToUpsert.length}`);

  return { scoresWritten: rowsToUpsert.length };
}

"use server";

import { createServerSupabaseClient } from "@/lib/supabase";

type GrandPrixDriverResultRow = {
  driver_id: string;
  quali_position: number | null;
  race_position: number | null;
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

type ScoreComponentValues = {
  teamPoints: number;
  qualiPredictionPoints: number;
  sprintQualiPredictionPoints: number;
  sprintRacePredictionPoints: number;
  racePredictionPoints: number;
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

const getRacePointsForPosition = (position: number | null) => {
  if (position === null) {
    return 0;
  }

  return F1_RACE_POINTS_BY_POSITION[position] ?? 0;
};

const calculateTopThreePredictionPoints = (predictedTopThree: string[], actualTopThree: string[]) => {
  if (actualTopThree.length !== 3) {
    return 0;
  }

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

const buildTopThreeByPosition = (
  rows: GrandPrixDriverResultRow[],
  positionKey: "quali_position" | "race_position",
) =>
  rows
    .filter((row) => (row[positionKey] ?? 0) >= 1 && (row[positionKey] ?? 0) <= 3)
    .sort((left, right) => (left[positionKey] ?? Number.MAX_SAFE_INTEGER) - (right[positionKey] ?? Number.MAX_SAFE_INTEGER))
    .map((row) => row.driver_id)
    .slice(0, 3);

const buildTotalPoints = (components: ScoreComponentValues) =>
  components.teamPoints +
  components.qualiPredictionPoints +
  components.sprintQualiPredictionPoints +
  components.sprintRacePredictionPoints +
  components.racePredictionPoints;

const buildPredictionPoints = (components: ScoreComponentValues) =>
  components.qualiPredictionPoints +
  components.sprintQualiPredictionPoints +
  components.sprintRacePredictionPoints +
  components.racePredictionPoints;

const buildSprintPredictionComponents = (_isSprintWeekend: boolean) => ({
  // Sprint publication is not active yet; keep explicit sprint components in place.
  sprintQualiPredictionPoints: 0,
  sprintRacePredictionPoints: 0,
});

const ensureGrandPrixExists = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data: grandPrix, error } = await supabase
    .from("grand_prix")
    .select("id, is_sprint_weekend")
    .eq("id", grandPrixId)
    .maybeSingle<{ id: string; is_sprint_weekend: boolean }>();

  if (error) {
    throw new Error(`[grand-prix-scores] Failed to load grand_prix: ${error.message}`);
  }

  if (!grandPrix) {
    throw new Error(`[grand-prix-scores] Grand Prix not found: ${grandPrixId}`);
  }

  return grandPrix;
};

const loadPredictions = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("predictions")
    .select("user_id, quali_p1, quali_p2, quali_p3, race_p1, race_p2, race_p3")
    .eq("grand_prix_id", grandPrixId);

  if (error) {
    throw new Error(`[grand-prix-scores] Failed to load predictions: ${error.message}`);
  }

  return (data ?? []) as PredictionRow[];
};

const loadDriverResults = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("grand_prix_driver_results")
    .select("driver_id, quali_position, race_position")
    .eq("grand_prix_id", grandPrixId);

  if (error) {
    throw new Error(`[grand-prix-scores] Failed to load grand_prix_driver_results: ${error.message}`);
  }

  return (data ?? []) as GrandPrixDriverResultRow[];
};

const loadTeamSelections = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("team_selections")
    .select("user_id, team_selection_drivers(driver_id)")
    .eq("grand_prix_id", grandPrixId);

  if (error) {
    throw new Error(`[grand-prix-scores] Failed to load team selections: ${error.message}`);
  }

  return (data ?? []) as TeamSelectionRow[];
};

async function upsertGrandPrixScoreRows(grandPrixId: string, componentByUserId: Map<string, ScoreComponentValues>) {
  const supabase = createServerSupabaseClient();

  const rowsToUpsert = [...componentByUserId.entries()]
    .sort(([leftUserId], [rightUserId]) => leftUserId.localeCompare(rightUserId))
    .map(([userId, components]) => ({
      grand_prix_id: grandPrixId,
      user_id: userId,
      team_points: components.teamPoints,
      quali_prediction_points: components.qualiPredictionPoints,
      sprint_quali_prediction_points: components.sprintQualiPredictionPoints,
      sprint_race_prediction_points: components.sprintRacePredictionPoints,
      race_prediction_points: components.racePredictionPoints,
      prediction_points: buildPredictionPoints(components),
      total_points: buildTotalPoints(components),
    }));

  if (rowsToUpsert.length === 0) {
    return { scoresWritten: 0 };
  }

  const { error } = await supabase.from("grand_prix_scores").upsert(rowsToUpsert, {
    onConflict: "grand_prix_id,user_id",
  });

  if (error) {
    throw new Error(`[grand-prix-scores] Failed to upsert scores: ${error.message}`);
  }

  return { scoresWritten: rowsToUpsert.length };
}

export async function calculateGrandPrixQualificationScores(grandPrixId: string) {
  const normalizedGrandPrixId = grandPrixId.trim();

  if (!normalizedGrandPrixId) {
    throw new Error("calculateGrandPrixQualificationScores requires a valid grandPrixId");
  }

  const grandPrix = await ensureGrandPrixExists(normalizedGrandPrixId);
  const [driverResults, predictions] = await Promise.all([
    loadDriverResults(normalizedGrandPrixId),
    loadPredictions(normalizedGrandPrixId),
  ]);

  const officialQualiTopThree = buildTopThreeByPosition(driverResults, "quali_position");

  const componentByUserId = new Map<string, ScoreComponentValues>();

  predictions.forEach((prediction) => {
    const qualiPredictionPoints = calculateTopThreePredictionPoints(
      [prediction.quali_p1, prediction.quali_p2, prediction.quali_p3],
      officialQualiTopThree,
    );

    const sprintComponents = buildSprintPredictionComponents(grandPrix.is_sprint_weekend);

    componentByUserId.set(prediction.user_id, {
      teamPoints: 0,
      qualiPredictionPoints,
      sprintQualiPredictionPoints: sprintComponents.sprintQualiPredictionPoints,
      sprintRacePredictionPoints: sprintComponents.sprintRacePredictionPoints,
      racePredictionPoints: 0,
    });
  });

  return upsertGrandPrixScoreRows(normalizedGrandPrixId, componentByUserId);
}

export async function calculateGrandPrixScores(grandPrixId: string) {
  const normalizedGrandPrixId = grandPrixId.trim();

  if (!normalizedGrandPrixId) {
    throw new Error("calculateGrandPrixScores requires a valid grandPrixId");
  }

  const grandPrix = await ensureGrandPrixExists(normalizedGrandPrixId);

  const [driverResults, teamSelections, predictions] = await Promise.all([
    loadDriverResults(normalizedGrandPrixId),
    loadTeamSelections(normalizedGrandPrixId),
    loadPredictions(normalizedGrandPrixId),
  ]);

  const officialQualiTopThree = buildTopThreeByPosition(driverResults, "quali_position");
  const officialRaceTopThree = buildTopThreeByPosition(driverResults, "race_position");

  const racePointsByDriverId = new Map<string, number>();
  driverResults.forEach((row) => {
    racePointsByDriverId.set(row.driver_id, getRacePointsForPosition(row.race_position));
  });

  const componentByUserId = new Map<string, ScoreComponentValues>();

  teamSelections.forEach((selection) => {
    const teamPoints = (selection.team_selection_drivers ?? []).reduce((total, selectedDriver) => {
      return total + (racePointsByDriverId.get(selectedDriver.driver_id) ?? 0);
    }, 0);

    const existing = componentByUserId.get(selection.user_id);
    componentByUserId.set(selection.user_id, {
      teamPoints,
      qualiPredictionPoints: existing?.qualiPredictionPoints ?? 0,
      sprintQualiPredictionPoints: existing?.sprintQualiPredictionPoints ?? 0,
      sprintRacePredictionPoints: existing?.sprintRacePredictionPoints ?? 0,
      racePredictionPoints: existing?.racePredictionPoints ?? 0,
    });
  });

  predictions.forEach((prediction) => {
    const qualiPredictionPoints = calculateTopThreePredictionPoints(
      [prediction.quali_p1, prediction.quali_p2, prediction.quali_p3],
      officialQualiTopThree,
    );

    const racePredictionPoints = calculateTopThreePredictionPoints(
      [prediction.race_p1, prediction.race_p2, prediction.race_p3],
      officialRaceTopThree,
    );

    const existing = componentByUserId.get(prediction.user_id);

    const sprintComponents = buildSprintPredictionComponents(grandPrix.is_sprint_weekend);

    componentByUserId.set(prediction.user_id, {
      teamPoints: existing?.teamPoints ?? 0,
      qualiPredictionPoints,
      sprintQualiPredictionPoints: sprintComponents.sprintQualiPredictionPoints,
      sprintRacePredictionPoints: sprintComponents.sprintRacePredictionPoints,
      racePredictionPoints,
    });
  });

  return upsertGrandPrixScoreRows(normalizedGrandPrixId, componentByUserId);
}

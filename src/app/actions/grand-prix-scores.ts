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
  teamQualiPoints: number;
  teamSprintQualiPoints: number;
  teamSprintRacePoints: number;
  teamRacePoints: number;
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

const F1_QUALI_TEAM_POINTS_BY_POSITION: Record<number, number> = {
  1: 10,
  2: 8,
  3: 6,
  4: 5,
  5: 4,
  6: 3,
  7: 2,
  8: 1,
};

const getRacePointsForPosition = (position: number | null) => {
  if (position === null) {
    return 0;
  }

  return F1_RACE_POINTS_BY_POSITION[position] ?? 0;
};

const getQualiTeamPointsForPosition = (position: number | null) => {
  if (position === null) {
    return 0;
  }

  return F1_QUALI_TEAM_POINTS_BY_POSITION[position] ?? 0;
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

const buildTeamPoints = (components: ScoreComponentValues) =>
  components.teamQualiPoints +
  components.teamSprintQualiPoints +
  components.teamSprintRacePoints +
  components.teamRacePoints;

const buildTotalPoints = (components: ScoreComponentValues) => buildTeamPoints(components) + buildPredictionPoints(components);

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

const buildSprintTeamComponents = (_isSprintWeekend: boolean) => ({
  // Sprint publication is not active yet; keep explicit sprint components in place.
  teamSprintQualiPoints: 0,
  teamSprintRacePoints: 0,
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

const loadExistingScores = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("grand_prix_scores")
    .select(
      "user_id, team_quali_points, team_sprint_quali_points, team_sprint_race_points, team_race_points, quali_prediction_points, sprint_quali_prediction_points, sprint_race_prediction_points, race_prediction_points",
    )
    .eq("grand_prix_id", grandPrixId);

  if (error) {
    throw new Error(`[grand-prix-scores] Failed to load grand_prix_scores: ${error.message}`);
  }

  const componentByUserId = new Map<string, ScoreComponentValues>();

  (data ?? []).forEach((row) => {
    componentByUserId.set(row.user_id, {
      teamQualiPoints: row.team_quali_points ?? 0,
      teamSprintQualiPoints: row.team_sprint_quali_points ?? 0,
      teamSprintRacePoints: row.team_sprint_race_points ?? 0,
      teamRacePoints: row.team_race_points ?? 0,
      qualiPredictionPoints: row.quali_prediction_points ?? 0,
      sprintQualiPredictionPoints: row.sprint_quali_prediction_points ?? 0,
      sprintRacePredictionPoints: row.sprint_race_prediction_points ?? 0,
      racePredictionPoints: row.race_prediction_points ?? 0,
    });
  });

  return componentByUserId;
};

async function upsertGrandPrixScoreRows(grandPrixId: string, componentByUserId: Map<string, ScoreComponentValues>) {
  const supabase = createServerSupabaseClient();

  const rowsToUpsert = [...componentByUserId.entries()]
    .sort(([leftUserId], [rightUserId]) => leftUserId.localeCompare(rightUserId))
    .map(([userId, components]) => ({
      grand_prix_id: grandPrixId,
      user_id: userId,
      team_quali_points: components.teamQualiPoints,
      team_sprint_quali_points: components.teamSprintQualiPoints,
      team_sprint_race_points: components.teamSprintRacePoints,
      team_race_points: components.teamRacePoints,
      // Legacy compatibility fields, still consumed in some views.
      team_points: buildTeamPoints(components),
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
  const [driverResults, teamSelections, predictions, existingComponentsByUserId] = await Promise.all([
    loadDriverResults(normalizedGrandPrixId),
    loadTeamSelections(normalizedGrandPrixId),
    loadPredictions(normalizedGrandPrixId),
    loadExistingScores(normalizedGrandPrixId),
  ]);

  const officialQualiTopThree = buildTopThreeByPosition(driverResults, "quali_position");
  const qualiPointsByDriverId = new Map<string, number>();
  driverResults.forEach((row) => {
    qualiPointsByDriverId.set(row.driver_id, getQualiTeamPointsForPosition(row.quali_position));
  });

  const componentByUserId = new Map<string, ScoreComponentValues>(existingComponentsByUserId);

  teamSelections.forEach((selection) => {
    const teamQualiPoints = (selection.team_selection_drivers ?? []).reduce((total, selectedDriver) => {
      return total + (qualiPointsByDriverId.get(selectedDriver.driver_id) ?? 0);
    }, 0);

    const existing = componentByUserId.get(selection.user_id);
    const sprintTeamComponents = buildSprintTeamComponents(grandPrix.is_sprint_weekend);
    const sprintPredictionComponents = buildSprintPredictionComponents(grandPrix.is_sprint_weekend);
    componentByUserId.set(selection.user_id, {
      teamQualiPoints,
      teamSprintQualiPoints: existing?.teamSprintQualiPoints ?? sprintTeamComponents.teamSprintQualiPoints,
      teamSprintRacePoints: existing?.teamSprintRacePoints ?? sprintTeamComponents.teamSprintRacePoints,
      teamRacePoints: existing?.teamRacePoints ?? 0,
      qualiPredictionPoints: existing?.qualiPredictionPoints ?? 0,
      sprintQualiPredictionPoints:
        existing?.sprintQualiPredictionPoints ?? sprintPredictionComponents.sprintQualiPredictionPoints,
      sprintRacePredictionPoints:
        existing?.sprintRacePredictionPoints ?? sprintPredictionComponents.sprintRacePredictionPoints,
      racePredictionPoints: existing?.racePredictionPoints ?? 0,
    });
  });

  predictions.forEach((prediction) => {
    const qualiPredictionPoints = calculateTopThreePredictionPoints(
      [prediction.quali_p1, prediction.quali_p2, prediction.quali_p3],
      officialQualiTopThree,
    );

    const sprintComponents = buildSprintPredictionComponents(grandPrix.is_sprint_weekend);
    const sprintTeamComponents = buildSprintTeamComponents(grandPrix.is_sprint_weekend);
    const existing = componentByUserId.get(prediction.user_id);

    componentByUserId.set(prediction.user_id, {
      teamQualiPoints: existing?.teamQualiPoints ?? 0,
      teamSprintQualiPoints: existing?.teamSprintQualiPoints ?? sprintTeamComponents.teamSprintQualiPoints,
      teamSprintRacePoints: existing?.teamSprintRacePoints ?? sprintTeamComponents.teamSprintRacePoints,
      teamRacePoints: existing?.teamRacePoints ?? 0,
      qualiPredictionPoints,
      sprintQualiPredictionPoints: existing?.sprintQualiPredictionPoints ?? sprintComponents.sprintQualiPredictionPoints,
      sprintRacePredictionPoints: existing?.sprintRacePredictionPoints ?? sprintComponents.sprintRacePredictionPoints,
      racePredictionPoints: existing?.racePredictionPoints ?? 0,
    });
  });

  return upsertGrandPrixScoreRows(normalizedGrandPrixId, componentByUserId);
}

export async function calculateGrandPrixRaceScores(grandPrixId: string) {
  const normalizedGrandPrixId = grandPrixId.trim();

  if (!normalizedGrandPrixId) {
    throw new Error("calculateGrandPrixScores requires a valid grandPrixId");
  }

  const grandPrix = await ensureGrandPrixExists(normalizedGrandPrixId);

  const [driverResults, teamSelections, predictions, existingComponentsByUserId] = await Promise.all([
    loadDriverResults(normalizedGrandPrixId),
    loadTeamSelections(normalizedGrandPrixId),
    loadPredictions(normalizedGrandPrixId),
    loadExistingScores(normalizedGrandPrixId),
  ]);

  const officialQualiTopThree = buildTopThreeByPosition(driverResults, "quali_position");
  const officialRaceTopThree = buildTopThreeByPosition(driverResults, "race_position");

  const racePointsByDriverId = new Map<string, number>();
  driverResults.forEach((row) => {
    racePointsByDriverId.set(row.driver_id, getRacePointsForPosition(row.race_position));
  });

  const componentByUserId = new Map<string, ScoreComponentValues>(existingComponentsByUserId);

  teamSelections.forEach((selection) => {
    const teamRacePoints = (selection.team_selection_drivers ?? []).reduce((total, selectedDriver) => {
      return total + (racePointsByDriverId.get(selectedDriver.driver_id) ?? 0);
    }, 0);

    const existing = componentByUserId.get(selection.user_id);
    const sprintTeamComponents = buildSprintTeamComponents(grandPrix.is_sprint_weekend);
    const sprintPredictionComponents = buildSprintPredictionComponents(grandPrix.is_sprint_weekend);
    componentByUserId.set(selection.user_id, {
      teamQualiPoints: existing?.teamQualiPoints ?? 0,
      teamSprintQualiPoints: existing?.teamSprintQualiPoints ?? sprintTeamComponents.teamSprintQualiPoints,
      teamSprintRacePoints: existing?.teamSprintRacePoints ?? sprintTeamComponents.teamSprintRacePoints,
      teamRacePoints,
      qualiPredictionPoints: existing?.qualiPredictionPoints ?? 0,
      sprintQualiPredictionPoints:
        existing?.sprintQualiPredictionPoints ?? sprintPredictionComponents.sprintQualiPredictionPoints,
      sprintRacePredictionPoints:
        existing?.sprintRacePredictionPoints ?? sprintPredictionComponents.sprintRacePredictionPoints,
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

    const sprintComponents = buildSprintPredictionComponents(grandPrix.is_sprint_weekend);
    const sprintTeamComponents = buildSprintTeamComponents(grandPrix.is_sprint_weekend);
    const existing = componentByUserId.get(prediction.user_id);

    componentByUserId.set(prediction.user_id, {
      teamQualiPoints: existing?.teamQualiPoints ?? 0,
      teamSprintQualiPoints: existing?.teamSprintQualiPoints ?? sprintTeamComponents.teamSprintQualiPoints,
      teamSprintRacePoints: existing?.teamSprintRacePoints ?? sprintTeamComponents.teamSprintRacePoints,
      teamRacePoints: existing?.teamRacePoints ?? 0,
      qualiPredictionPoints: existing?.qualiPredictionPoints ?? qualiPredictionPoints,
      sprintQualiPredictionPoints: existing?.sprintQualiPredictionPoints ?? sprintComponents.sprintQualiPredictionPoints,
      sprintRacePredictionPoints: existing?.sprintRacePredictionPoints ?? sprintComponents.sprintRacePredictionPoints,
      racePredictionPoints,
    });
  });

  return upsertGrandPrixScoreRows(normalizedGrandPrixId, componentByUserId);
}

export async function calculateGrandPrixScores(grandPrixId: string) {
  return calculateGrandPrixRaceScores(grandPrixId);
}

"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { calculateDriverFinishPositionBonusPoints, type BonusQuestion } from "@/lib/bonus-predictions";

type GrandPrixDriverResultRow = {
  driver_id: string;
  quali_position: number | null;
  sprint_quali_position: number | null;
  sprint_race_position: number | null;
  race_position: number | null;
};

type TeamSelectionRow = {
  user_id: string;
  team_selection_drivers: Array<{
    driver_id: string;
  }> | null;
};

type GrandPrixScoreDetailRow = {
  user_id: string;
  driver_id: string;
  team_quali_points: number | null;
  team_sprint_quali_points: number | null;
  team_sprint_race_points: number | null;
  team_race_points: number | null;
};

type PredictionRow = {
  user_id: string;
  quali_p1: string;
  quali_p2: string;
  quali_p3: string;
  race_p1: string;
  race_p2: string;
  race_p3: string;
  sprint_quali_p1: string | null;
  sprint_quali_p2: string | null;
  sprint_quali_p3: string | null;
  sprint_race_p1: string | null;
  sprint_race_p2: string | null;
  sprint_race_p3: string | null;
  fastest_pitstop_team: string | null;
};

type GrandPrixPredictionScoreDetailRow = {
  grand_prix_id: string;
  user_id: string;
  prediction_type: "sprint_quali" | "sprint_race" | "quali" | "race";
  slot_position: 1 | 2 | 3;
  predicted_driver_id: string;
  points: number;
};

type ScoreComponentValues = {
  teamQualiPoints: number | null;
  teamSprintQualiPoints: number | null;
  teamSprintRacePoints: number | null;
  teamRacePoints: number | null;
  qualiPredictionPoints: number;
  sprintQualiPredictionPoints: number;
  sprintRacePredictionPoints: number;
  racePredictionPoints: number;
  fastestPitstopPredictionPoints: number | null;
  bonusPredictionPoints: number | null;
};

type BonusPredictionRow = {
  user_id: string;
  answer_position: number | null;
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

const F1_SPRINT_RACE_TEAM_POINTS_BY_POSITION: Record<number, number> = {
  1: 15,
  2: 12,
  3: 10,
  4: 8,
  5: 6,
  6: 4,
  7: 3,
  8: 2,
  9: 1,
};

const F1_SPRINT_QUALI_TEAM_POINTS_BY_POSITION: Record<number, number> = {
  1: 6,
  2: 5,
  3: 4,
  4: 3,
  5: 2,
  6: 1,
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

const getSprintRaceTeamPointsForPosition = (position: number | null) => {
  if (position === null) {
    return 0;
  }

  return F1_SPRINT_RACE_TEAM_POINTS_BY_POSITION[position] ?? 0;
};

const getSprintQualiTeamPointsForPosition = (position: number | null) => {
  if (position === null) {
    return 0;
  }

  return F1_SPRINT_QUALI_TEAM_POINTS_BY_POSITION[position] ?? 0;
};

const calculateTopThreePredictionPointsBySlot = (
  predictedTopThree: string[],
  actualTopThree: string[],
) => {
  if (actualTopThree.length !== 3) {
    return [0, 0, 0] as const;
  }

  return predictedTopThree.map((driverId, index) => {
    if (driverId === actualTopThree[index]) {
      return 10;
    }

    if (actualTopThree.includes(driverId)) {
      return 5;
    }

    return 0;
  }) as [number, number, number];
};

const calculateTopThreePredictionPoints = (
  predictedTopThree: string[],
  actualTopThree: string[],
) => {
  if (actualTopThree.length !== 3) {
    return 0;
  }

  return calculateTopThreePredictionPointsBySlot(
    predictedTopThree,
    actualTopThree,
  ).reduce((total, slotPoints) => {
    return total + slotPoints;
  }, 0);
};

const buildTopThreeByPosition = (
  rows: GrandPrixDriverResultRow[],
  positionKey:
    | "sprint_quali_position"
    | "sprint_race_position"
    | "quali_position"
    | "race_position",
) =>
  rows
    .filter(
      (row) => (row[positionKey] ?? 0) >= 1 && (row[positionKey] ?? 0) <= 3,
    )
    .sort(
      (left, right) =>
        (left[positionKey] ?? Number.MAX_SAFE_INTEGER) -
        (right[positionKey] ?? Number.MAX_SAFE_INTEGER),
    )
    .map((row) => row.driver_id)
    .slice(0, 3);

const buildTeamPoints = (components: ScoreComponentValues) =>
  (components.teamQualiPoints ?? 0) +
  (components.teamSprintQualiPoints ?? 0) +
  (components.teamSprintRacePoints ?? 0) +
  (components.teamRacePoints ?? 0);

const buildTotalPoints = (components: ScoreComponentValues) =>
  buildTeamPoints(components) + buildPredictionPoints(components);

const buildPredictionPoints = (components: ScoreComponentValues) =>
  components.qualiPredictionPoints +
  components.sprintQualiPredictionPoints +
  components.sprintRacePredictionPoints +
  components.racePredictionPoints +
  (components.fastestPitstopPredictionPoints ?? 0) +
  (components.bonusPredictionPoints ?? 0);

const buildSprintPredictionComponents = ({
  isSprintWeekend,
  prediction,
  officialSprintQualiTopThree,
  officialSprintRaceTopThree,
}: {
  isSprintWeekend: boolean;
  prediction?: PredictionRow;
  officialSprintQualiTopThree?: string[];
  officialSprintRaceTopThree?: string[];
}) => {
  if (!isSprintWeekend || !prediction)
    return { sprintQualiPredictionPoints: 0, sprintRacePredictionPoints: 0 };
  return {
    sprintQualiPredictionPoints: calculateTopThreePredictionPoints(
      [
        prediction.sprint_quali_p1 ?? "",
        prediction.sprint_quali_p2 ?? "",
        prediction.sprint_quali_p3 ?? "",
      ],
      officialSprintQualiTopThree ?? [],
    ),
    sprintRacePredictionPoints: calculateTopThreePredictionPoints(
      [
        prediction.sprint_race_p1 ?? "",
        prediction.sprint_race_p2 ?? "",
        prediction.sprint_race_p3 ?? "",
      ],
      officialSprintRaceTopThree ?? [],
    ),
  };
};

const buildSprintTeamComponents = ({
  isSprintWeekend,
  selectedDriverIds,
  sprintQualiPointsByDriverId,
  sprintRacePointsByDriverId,
}: {
  isSprintWeekend: boolean;
  selectedDriverIds: string[];
  sprintQualiPointsByDriverId: Map<string, number>;
  sprintRacePointsByDriverId: Map<string, number>;
}) => {
  if (!isSprintWeekend) {
    return {
      teamSprintQualiPoints: null,
      teamSprintRacePoints: null,
    };
  }

  return {
    teamSprintQualiPoints: selectedDriverIds.reduce((total, driverId) => {
      return total + (sprintQualiPointsByDriverId.get(driverId) ?? 0);
    }, 0),
    teamSprintRacePoints: selectedDriverIds.reduce((total, driverId) => {
      return total + (sprintRacePointsByDriverId.get(driverId) ?? 0);
    }, 0),
  };
};

const ensureGrandPrixExists = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data: grandPrix, error } = await supabase
    .from("grand_prix")
    .select("id, is_sprint_weekend")
    .eq("id", grandPrixId)
    .maybeSingle<{ id: string; is_sprint_weekend: boolean }>();

  if (error) {
    throw new Error(
      `[grand-prix-scores] Failed to load grand_prix: ${error.message}`,
    );
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
    .select(
      "user_id, quali_p1, quali_p2, quali_p3, race_p1, race_p2, race_p3, sprint_quali_p1, sprint_quali_p2, sprint_quali_p3, sprint_race_p1, sprint_race_p2, sprint_race_p3, fastest_pitstop_team",
    )
    .eq("grand_prix_id", grandPrixId);

  if (error) {
    throw new Error(
      `[grand-prix-scores] Failed to load predictions: ${error.message}`,
    );
  }

  return (data ?? []) as PredictionRow[];
};

const loadBonusResult = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("grand_prix_bonus_results")
    .select("fastest_pitstop_team")
    .eq("grand_prix_id", grandPrixId)
    .maybeSingle<{ fastest_pitstop_team: string | null }>();

  if (error) {
    throw new Error(
      `[grand-prix-scores] Failed to load grand_prix_bonus_results: ${error.message}`,
    );
  }

  return data?.fastest_pitstop_team?.trim() || null;
};

const normalizeConstructorTeam = (team: string | null) =>
  team?.trim().toLocaleLowerCase("nl-NL") || null;

const calculateFastestPitstopPredictionPoints = (
  predictedTeam: string | null,
  actualTeam: string | null,
) => {
  const normalizedPredictedTeam = normalizeConstructorTeam(predictedTeam);
  const normalizedActualTeam = normalizeConstructorTeam(actualTeam);

  if (!normalizedPredictedTeam || !normalizedActualTeam) {
    return 0;
  }

  return normalizedPredictedTeam === normalizedActualTeam ? 10 : 0;
};

const buildFastestPitstopPredictionPointsByUserId = (
  predictions: PredictionRow[],
  actualTeam: string | null,
) =>
  new Map(
    predictions.map((prediction) => [
      prediction.user_id,
      calculateFastestPitstopPredictionPoints(
        prediction.fastest_pitstop_team,
        actualTeam,
      ),
    ]),
  );

const loadBonusQuestion = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("grand_prix_bonus_questions")
    .select("id, grand_prix_id, question_type, question_text, subject_driver_id, points")
    .eq("grand_prix_id", grandPrixId)
    .maybeSingle<BonusQuestion>();

  if (error) {
    throw new Error(`[grand-prix-scores] Failed to load bonus question: ${error.message}`);
  }

  return data;
};

const loadBonusPredictions = async (questionId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("grand_prix_bonus_predictions")
    .select("user_id, answer_position")
    .eq("grand_prix_bonus_question_id", questionId)
    .returns<BonusPredictionRow[]>();

  if (error) {
    throw new Error(`[grand-prix-scores] Failed to load bonus predictions: ${error.message}`);
  }

  return data ?? [];
};

const loadDriverResults = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("grand_prix_driver_results")
    .select(
      "driver_id, quali_position, sprint_quali_position, sprint_race_position, race_position",
    )
    .eq("grand_prix_id", grandPrixId);

  if (error) {
    throw new Error(
      `[grand-prix-scores] Failed to load grand_prix_driver_results: ${error.message}`,
    );
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
    throw new Error(
      `[grand-prix-scores] Failed to load team selections: ${error.message}`,
    );
  }

  return (data ?? []) as TeamSelectionRow[];
};

const loadExistingScores = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("grand_prix_scores")
    .select(
      "user_id, team_quali_points, team_sprint_quali_points, team_sprint_race_points, team_race_points, quali_prediction_points, sprint_quali_prediction_points, sprint_race_prediction_points, race_prediction_points, fastest_pitstop_prediction_points, bonus_prediction_points",
    )
    .eq("grand_prix_id", grandPrixId);

  if (error) {
    throw new Error(
      `[grand-prix-scores] Failed to load grand_prix_scores: ${error.message}`,
    );
  }

  const componentByUserId = new Map<string, ScoreComponentValues>();

  (data ?? []).forEach((row) => {
    componentByUserId.set(row.user_id, {
      teamQualiPoints: row.team_quali_points,
      teamSprintQualiPoints: row.team_sprint_quali_points,
      teamSprintRacePoints: row.team_sprint_race_points,
      teamRacePoints: row.team_race_points,
      qualiPredictionPoints: row.quali_prediction_points ?? 0,
      sprintQualiPredictionPoints: row.sprint_quali_prediction_points ?? 0,
      sprintRacePredictionPoints: row.sprint_race_prediction_points ?? 0,
      racePredictionPoints: row.race_prediction_points ?? 0,
      fastestPitstopPredictionPoints: row.fastest_pitstop_prediction_points,
      bonusPredictionPoints: row.bonus_prediction_points,
    });
  });

  return componentByUserId;
};

async function upsertGrandPrixScoreRows(
  grandPrixId: string,
  componentByUserId: Map<string, ScoreComponentValues>,
) {
  const supabase = createServerSupabaseClient();

  const rowsToUpsert = [...componentByUserId.entries()]
    .sort(([leftUserId], [rightUserId]) =>
      leftUserId.localeCompare(rightUserId),
    )
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
      fastest_pitstop_prediction_points:
        components.fastestPitstopPredictionPoints,
      bonus_prediction_points: components.bonusPredictionPoints,
      prediction_points: buildPredictionPoints(components),
      total_points: buildTotalPoints(components),
    }));

  if (rowsToUpsert.length === 0) {
    return { scoresWritten: 0 };
  }

  const { error } = await supabase
    .from("grand_prix_scores")
    .upsert(rowsToUpsert, {
      onConflict: "grand_prix_id,user_id",
    });

  if (error) {
    throw new Error(
      `[grand-prix-scores] Failed to upsert scores: ${error.message}`,
    );
  }

  return { scoresWritten: rowsToUpsert.length };
}

const loadExistingScoreDetails = async (grandPrixId: string) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("grand_prix_score_details")
    .select(
      "user_id, driver_id, team_quali_points, team_sprint_quali_points, team_sprint_race_points, team_race_points",
    )
    .eq("grand_prix_id", grandPrixId);

  if (error) {
    throw new Error(
      `[grand-prix-scores] Failed to load grand_prix_score_details: ${error.message}`,
    );
  }

  const detailByUserAndDriver = new Map<string, GrandPrixScoreDetailRow>();
  (data ?? []).forEach((row) => {
    const key = `${row.user_id}:${row.driver_id}`;
    detailByUserAndDriver.set(key, row as GrandPrixScoreDetailRow);
  });

  return detailByUserAndDriver;
};

const upsertGrandPrixScoreDetailRows = async ({
  grandPrixId,
  teamSelections,
  qualiPointsByDriverId,
  sprintQualiPointsByDriverId,
  sprintRacePointsByDriverId,
  racePointsByDriverId,
  preserveExistingQualiPoints,
  preserveExistingSprintQualiPoints,
  preserveExistingSprintRacePoints,
  preserveExistingRacePoints,
}: {
  grandPrixId: string;
  teamSelections: TeamSelectionRow[];
  qualiPointsByDriverId: Map<string, number>;
  sprintQualiPointsByDriverId: Map<string, number>;
  sprintRacePointsByDriverId: Map<string, number>;
  racePointsByDriverId: Map<string, number>;
  preserveExistingQualiPoints: boolean;
  preserveExistingSprintQualiPoints: boolean;
  preserveExistingSprintRacePoints: boolean;
  preserveExistingRacePoints: boolean;
}) => {
  const supabase = createServerSupabaseClient();
  const shouldLoadExistingDetails =
    preserveExistingQualiPoints ||
    preserveExistingSprintQualiPoints ||
    preserveExistingSprintRacePoints ||
    preserveExistingRacePoints;
  const existingDetailByUserAndDriver = shouldLoadExistingDetails
    ? await loadExistingScoreDetails(grandPrixId)
    : new Map<string, GrandPrixScoreDetailRow>();

  const rowsToUpsert = teamSelections.flatMap((selection) =>
    (selection.team_selection_drivers ?? []).map((selectedDriver) => {
      const existing = existingDetailByUserAndDriver.get(
        `${selection.user_id}:${selectedDriver.driver_id}`,
      );
      const teamQualiPoints = preserveExistingQualiPoints
        ? (existing?.team_quali_points ?? null)
        : (qualiPointsByDriverId.get(selectedDriver.driver_id) ?? 0);
      const teamSprintQualiPoints = preserveExistingSprintQualiPoints
        ? (existing?.team_sprint_quali_points ?? null)
        : (sprintQualiPointsByDriverId.get(selectedDriver.driver_id) ?? 0);
      const teamSprintRacePoints = preserveExistingSprintRacePoints
        ? (existing?.team_sprint_race_points ?? null)
        : (sprintRacePointsByDriverId.get(selectedDriver.driver_id) ?? 0);
      const teamRacePoints = preserveExistingRacePoints
        ? (existing?.team_race_points ?? null)
        : (racePointsByDriverId.get(selectedDriver.driver_id) ?? 0);

      return {
        grand_prix_id: grandPrixId,
        user_id: selection.user_id,
        driver_id: selectedDriver.driver_id,
        team_quali_points: teamQualiPoints,
        team_sprint_quali_points: teamSprintQualiPoints,
        team_sprint_race_points: teamSprintRacePoints,
        team_race_points: teamRacePoints,
        total_points:
          (teamQualiPoints ?? 0) +
          (teamSprintQualiPoints ?? 0) +
          (teamSprintRacePoints ?? 0) +
          (teamRacePoints ?? 0),
      };
    }),
  );

  if (rowsToUpsert.length === 0) {
    return { detailsWritten: 0 };
  }

  const { error } = await supabase
    .from("grand_prix_score_details")
    .upsert(rowsToUpsert, {
      onConflict: "grand_prix_id,user_id,driver_id",
    });

  if (error) {
    throw new Error(
      `[grand-prix-scores] Failed to upsert score details: ${error.message}`,
    );
  }

  return { detailsWritten: rowsToUpsert.length };
};

const upsertGrandPrixPredictionScoreDetailRows = async ({
  grandPrixId,
  rows,
  predictionType,
}: {
  grandPrixId: string;
  rows: GrandPrixPredictionScoreDetailRow[];
  predictionType: "sprint_quali" | "sprint_race" | "quali" | "race";
}) => {
  const supabase = createServerSupabaseClient();

  const { error: deleteError } = await supabase
    .from("grand_prix_prediction_score_details")
    .delete()
    .eq("grand_prix_id", grandPrixId)
    .eq("prediction_type", predictionType);

  if (deleteError) {
    throw new Error(
      `[grand-prix-scores] Failed to delete prediction score details: ${deleteError.message}`,
    );
  }

  if (rows.length === 0) {
    return { detailsWritten: 0 };
  }

  const { error } = await supabase
    .from("grand_prix_prediction_score_details")
    .upsert(rows, {
      onConflict: "grand_prix_id,user_id,prediction_type,slot_position",
    });

  if (error) {
    throw new Error(
      `[grand-prix-scores] Failed to upsert prediction score details: ${error.message}`,
    );
  }

  return { detailsWritten: rows.length };
};

export async function calculateGrandPrixQualificationScores(
  grandPrixId: string,
) {
  const normalizedGrandPrixId = grandPrixId.trim();

  if (!normalizedGrandPrixId) {
    throw new Error(
      "calculateGrandPrixQualificationScores requires a valid grandPrixId",
    );
  }

  const grandPrix = await ensureGrandPrixExists(normalizedGrandPrixId);
  const [
    driverResults,
    teamSelections,
    predictions,
    existingComponentsByUserId,
  ] = await Promise.all([
    loadDriverResults(normalizedGrandPrixId),
    loadTeamSelections(normalizedGrandPrixId),
    loadPredictions(normalizedGrandPrixId),
    loadExistingScores(normalizedGrandPrixId),
  ]);

  const officialSprintQualiTopThree = buildTopThreeByPosition(
    driverResults,
    "sprint_quali_position",
  );
  const officialSprintRaceTopThree = buildTopThreeByPosition(
    driverResults,
    "sprint_race_position",
  );
  const officialQualiTopThree = buildTopThreeByPosition(
    driverResults,
    "quali_position",
  );
  const qualiPointsByDriverId = new Map<string, number>();
  const sprintQualiPointsByDriverId = new Map<string, number>();
  const sprintRacePointsByDriverId = new Map<string, number>();
  driverResults.forEach((row) => {
    qualiPointsByDriverId.set(
      row.driver_id,
      getQualiTeamPointsForPosition(row.quali_position),
    );
    sprintQualiPointsByDriverId.set(
      row.driver_id,
      getSprintQualiTeamPointsForPosition(row.sprint_quali_position),
    );
    sprintRacePointsByDriverId.set(
      row.driver_id,
      getSprintRaceTeamPointsForPosition(row.sprint_race_position),
    );
  });
  const racePointsByDriverId = new Map<string, number>();

  const componentByUserId = new Map<string, ScoreComponentValues>(
    existingComponentsByUserId,
  );

  teamSelections.forEach((selection) => {
    const teamQualiPoints = (selection.team_selection_drivers ?? []).reduce(
      (total, selectedDriver) => {
        return (
          total + (qualiPointsByDriverId.get(selectedDriver.driver_id) ?? 0)
        );
      },
      0,
    );

    const existing = componentByUserId.get(selection.user_id);
    const selectedDriverIds = (selection.team_selection_drivers ?? []).map(
      (selectedDriver) => selectedDriver.driver_id,
    );
    const sprintTeamComponents = buildSprintTeamComponents({
      isSprintWeekend: grandPrix.is_sprint_weekend,
      selectedDriverIds,
      sprintQualiPointsByDriverId,
      sprintRacePointsByDriverId,
    });
    const sprintPredictionComponents = buildSprintPredictionComponents({
      isSprintWeekend: grandPrix.is_sprint_weekend,
    });
    componentByUserId.set(selection.user_id, {
      teamQualiPoints,
      teamSprintQualiPoints:
        existing?.teamSprintQualiPoints ??
        sprintTeamComponents.teamSprintQualiPoints,
      teamSprintRacePoints:
        existing?.teamSprintRacePoints ??
        sprintTeamComponents.teamSprintRacePoints,
      teamRacePoints: existing?.teamRacePoints ?? null,
      qualiPredictionPoints: existing?.qualiPredictionPoints ?? 0,
      sprintQualiPredictionPoints:
        existing?.sprintQualiPredictionPoints ??
        sprintPredictionComponents.sprintQualiPredictionPoints,
      sprintRacePredictionPoints:
        existing?.sprintRacePredictionPoints ??
        sprintPredictionComponents.sprintRacePredictionPoints,
      racePredictionPoints: existing?.racePredictionPoints ?? 0,
      fastestPitstopPredictionPoints:
        existing?.fastestPitstopPredictionPoints ?? null,
      bonusPredictionPoints: existing?.bonusPredictionPoints ?? null,
    });
  });

  predictions.forEach((prediction) => {
    const qualiPredictionPoints = calculateTopThreePredictionPoints(
      [prediction.quali_p1, prediction.quali_p2, prediction.quali_p3],
      officialQualiTopThree,
    );

    const sprintComponents = buildSprintPredictionComponents({
      isSprintWeekend: grandPrix.is_sprint_weekend,
      prediction,
      officialSprintQualiTopThree,
      officialSprintRaceTopThree,
    });
    const sprintTeamComponents = buildSprintTeamComponents({
      isSprintWeekend: grandPrix.is_sprint_weekend,
      selectedDriverIds: [],
      sprintQualiPointsByDriverId,
      sprintRacePointsByDriverId,
    });
    const existing = componentByUserId.get(prediction.user_id);

    componentByUserId.set(prediction.user_id, {
      teamQualiPoints: existing?.teamQualiPoints ?? null,
      teamSprintQualiPoints:
        existing?.teamSprintQualiPoints ??
        sprintTeamComponents.teamSprintQualiPoints,
      teamSprintRacePoints:
        existing?.teamSprintRacePoints ??
        sprintTeamComponents.teamSprintRacePoints,
      teamRacePoints: existing?.teamRacePoints ?? null,
      qualiPredictionPoints,
      sprintQualiPredictionPoints:
        existing?.sprintQualiPredictionPoints ??
        sprintComponents.sprintQualiPredictionPoints,
      sprintRacePredictionPoints:
        existing?.sprintRacePredictionPoints ??
        sprintComponents.sprintRacePredictionPoints,
      racePredictionPoints: existing?.racePredictionPoints ?? 0,
      fastestPitstopPredictionPoints:
        existing?.fastestPitstopPredictionPoints ?? null,
      bonusPredictionPoints: existing?.bonusPredictionPoints ?? null,
    });
  });

  const qualiPredictionDetailRows: GrandPrixPredictionScoreDetailRow[] =
    predictions.flatMap((prediction) => {
      const predictedTopThree = [
        prediction.quali_p1,
        prediction.quali_p2,
        prediction.quali_p3,
      ];
      const pointsBySlot = calculateTopThreePredictionPointsBySlot(
        predictedTopThree,
        officialQualiTopThree,
      );

      return predictedTopThree.map((predictedDriverId, index) => ({
        grand_prix_id: normalizedGrandPrixId,
        user_id: prediction.user_id,
        prediction_type: "quali",
        slot_position: (index + 1) as 1 | 2 | 3,
        predicted_driver_id: predictedDriverId,
        points: pointsBySlot[index] ?? 0,
      }));
    });

  const [scoreWriteResult] = await Promise.all([
    upsertGrandPrixScoreRows(normalizedGrandPrixId, componentByUserId),
    upsertGrandPrixPredictionScoreDetailRows({
      grandPrixId: normalizedGrandPrixId,
      rows: qualiPredictionDetailRows,
      predictionType: "quali",
    }),
    upsertGrandPrixScoreDetailRows({
      grandPrixId: normalizedGrandPrixId,
      teamSelections,
      qualiPointsByDriverId,
      sprintQualiPointsByDriverId,
      sprintRacePointsByDriverId,
      racePointsByDriverId,
      preserveExistingQualiPoints: false,
      preserveExistingSprintQualiPoints: true,
      preserveExistingSprintRacePoints: true,
      preserveExistingRacePoints: true,
    }),
  ]);

  return scoreWriteResult;
}

async function upsertBonusAnswerAndScores({
  question,
  driverResults,
}: {
  question: BonusQuestion | null;
  driverResults: GrandPrixDriverResultRow[];
}) {
  if (!question || question.question_type !== "driver_finish_position") {
    return new Map<string, number>();
  }

  const actualPosition =
    driverResults.find((row) => row.driver_id === question.subject_driver_id)
      ?.race_position ?? null;
  const supabase = createServerSupabaseClient();

  await supabase.from("grand_prix_bonus_answers").upsert(
    {
      grand_prix_bonus_question_id: question.id,
      answer_position: actualPosition,
    },
    { onConflict: "grand_prix_bonus_question_id" },
  );

  const bonusPredictions = await loadBonusPredictions(question.id);
  const pointsByUserId = new Map<string, number>();
  const scoreRows = bonusPredictions.map((prediction) => {
    const points = calculateDriverFinishPositionBonusPoints({
      predictedPosition: prediction.answer_position,
      actualPosition,
      pointsAvailable: question.points,
    });
    pointsByUserId.set(prediction.user_id, points);
    return {
      grand_prix_bonus_question_id: question.id,
      user_id: prediction.user_id,
      points,
    };
  });

  if (scoreRows.length > 0) {
    const { error } = await supabase.from("grand_prix_bonus_prediction_scores").upsert(
      scoreRows,
      { onConflict: "grand_prix_bonus_question_id,user_id" },
    );
    if (error) {
      throw new Error(`[grand-prix-scores] Failed to upsert bonus scores: ${error.message}`);
    }
  }

  return pointsByUserId;
}

export async function calculateGrandPrixRaceScores(grandPrixId: string) {
  const normalizedGrandPrixId = grandPrixId.trim();

  if (!normalizedGrandPrixId) {
    throw new Error("calculateGrandPrixScores requires a valid grandPrixId");
  }

  const grandPrix = await ensureGrandPrixExists(normalizedGrandPrixId);

  const [
    driverResults,
    teamSelections,
    predictions,
    existingComponentsByUserId,
    officialFastestPitstopTeam,
    bonusQuestion,
  ] = await Promise.all([
    loadDriverResults(normalizedGrandPrixId),
    loadTeamSelections(normalizedGrandPrixId),
    loadPredictions(normalizedGrandPrixId),
    loadExistingScores(normalizedGrandPrixId),
    loadBonusResult(normalizedGrandPrixId),
    loadBonusQuestion(normalizedGrandPrixId),
  ]);

  const officialSprintQualiTopThree = buildTopThreeByPosition(
    driverResults,
    "sprint_quali_position",
  );
  const officialSprintRaceTopThree = buildTopThreeByPosition(
    driverResults,
    "sprint_race_position",
  );
  const officialQualiTopThree = buildTopThreeByPosition(
    driverResults,
    "quali_position",
  );
  const officialRaceTopThree = buildTopThreeByPosition(
    driverResults,
    "race_position",
  );

  const racePointsByDriverId = new Map<string, number>();
  const sprintQualiPointsByDriverId = new Map<string, number>();
  const sprintRacePointsByDriverId = new Map<string, number>();
  driverResults.forEach((row) => {
    racePointsByDriverId.set(
      row.driver_id,
      getRacePointsForPosition(row.race_position),
    );
    sprintQualiPointsByDriverId.set(
      row.driver_id,
      getSprintQualiTeamPointsForPosition(row.sprint_quali_position),
    );
    sprintRacePointsByDriverId.set(
      row.driver_id,
      getSprintRaceTeamPointsForPosition(row.sprint_race_position),
    );
  });
  const qualiPointsByDriverId = new Map<string, number>();
  const bonusPredictionPointsByUserId = await upsertBonusAnswerAndScores({
    question: bonusQuestion,
    driverResults,
  });

  const componentByUserId = new Map<string, ScoreComponentValues>(
    existingComponentsByUserId,
  );

  teamSelections.forEach((selection) => {
    const teamRacePoints = (selection.team_selection_drivers ?? []).reduce(
      (total, selectedDriver) => {
        return (
          total + (racePointsByDriverId.get(selectedDriver.driver_id) ?? 0)
        );
      },
      0,
    );

    const existing = componentByUserId.get(selection.user_id);
    const selectedDriverIds = (selection.team_selection_drivers ?? []).map(
      (selectedDriver) => selectedDriver.driver_id,
    );
    const sprintTeamComponents = buildSprintTeamComponents({
      isSprintWeekend: grandPrix.is_sprint_weekend,
      selectedDriverIds,
      sprintQualiPointsByDriverId,
      sprintRacePointsByDriverId,
    });
    const sprintPredictionComponents = buildSprintPredictionComponents({
      isSprintWeekend: grandPrix.is_sprint_weekend,
    });
    componentByUserId.set(selection.user_id, {
      teamQualiPoints: existing?.teamQualiPoints ?? null,
      teamSprintQualiPoints:
        existing?.teamSprintQualiPoints ??
        sprintTeamComponents.teamSprintQualiPoints,
      teamSprintRacePoints:
        existing?.teamSprintRacePoints ??
        sprintTeamComponents.teamSprintRacePoints,
      teamRacePoints,
      qualiPredictionPoints: existing?.qualiPredictionPoints ?? 0,
      sprintQualiPredictionPoints:
        existing?.sprintQualiPredictionPoints ??
        sprintPredictionComponents.sprintQualiPredictionPoints,
      sprintRacePredictionPoints:
        existing?.sprintRacePredictionPoints ??
        sprintPredictionComponents.sprintRacePredictionPoints,
      racePredictionPoints: existing?.racePredictionPoints ?? 0,
      fastestPitstopPredictionPoints:
        existing?.fastestPitstopPredictionPoints ?? 0,
      bonusPredictionPoints: existing?.bonusPredictionPoints ?? null,
    });
  });

  const fastestPitstopPredictionPointsByUserId =
    buildFastestPitstopPredictionPointsByUserId(
      predictions,
      officialFastestPitstopTeam,
    );

  predictions.forEach((prediction) => {
    const qualiPredictionPoints = calculateTopThreePredictionPoints(
      [prediction.quali_p1, prediction.quali_p2, prediction.quali_p3],
      officialQualiTopThree,
    );

    const racePredictionPoints = calculateTopThreePredictionPoints(
      [prediction.race_p1, prediction.race_p2, prediction.race_p3],
      officialRaceTopThree,
    );

    const sprintComponents = buildSprintPredictionComponents({
      isSprintWeekend: grandPrix.is_sprint_weekend,
      prediction,
      officialSprintQualiTopThree,
      officialSprintRaceTopThree,
    });
    const sprintTeamComponents = buildSprintTeamComponents({
      isSprintWeekend: grandPrix.is_sprint_weekend,
      selectedDriverIds: [],
      sprintQualiPointsByDriverId,
      sprintRacePointsByDriverId,
    });
    const existing = componentByUserId.get(prediction.user_id);

    componentByUserId.set(prediction.user_id, {
      teamQualiPoints: existing?.teamQualiPoints ?? null,
      teamSprintQualiPoints:
        existing?.teamSprintQualiPoints ??
        sprintTeamComponents.teamSprintQualiPoints,
      teamSprintRacePoints:
        existing?.teamSprintRacePoints ??
        sprintTeamComponents.teamSprintRacePoints,
      teamRacePoints: existing?.teamRacePoints ?? null,
      qualiPredictionPoints:
        existing?.qualiPredictionPoints ?? qualiPredictionPoints,
      sprintQualiPredictionPoints:
        existing?.sprintQualiPredictionPoints ??
        sprintComponents.sprintQualiPredictionPoints,
      sprintRacePredictionPoints:
        existing?.sprintRacePredictionPoints ??
        sprintComponents.sprintRacePredictionPoints,
      racePredictionPoints,
      fastestPitstopPredictionPoints:
        fastestPitstopPredictionPointsByUserId.get(prediction.user_id) ?? 0,
      bonusPredictionPoints:
        bonusPredictionPointsByUserId.get(prediction.user_id) ?? 0,
    });
  });

  componentByUserId.forEach((components, userId) => {
    componentByUserId.set(userId, {
      ...components,
      fastestPitstopPredictionPoints:
        fastestPitstopPredictionPointsByUserId.get(userId) ?? 0,
      bonusPredictionPoints: bonusPredictionPointsByUserId.get(userId) ?? 0,
    });
  });

  const racePredictionDetailRows: GrandPrixPredictionScoreDetailRow[] =
    predictions.flatMap((prediction) => {
      const predictedTopThree = [
        prediction.race_p1,
        prediction.race_p2,
        prediction.race_p3,
      ];
      const pointsBySlot = calculateTopThreePredictionPointsBySlot(
        predictedTopThree,
        officialRaceTopThree,
      );

      return predictedTopThree.map((predictedDriverId, index) => ({
        grand_prix_id: normalizedGrandPrixId,
        user_id: prediction.user_id,
        prediction_type: "race",
        slot_position: (index + 1) as 1 | 2 | 3,
        predicted_driver_id: predictedDriverId,
        points: pointsBySlot[index] ?? 0,
      }));
    });

  const [scoreWriteResult] = await Promise.all([
    upsertGrandPrixScoreRows(normalizedGrandPrixId, componentByUserId),
    upsertGrandPrixPredictionScoreDetailRows({
      grandPrixId: normalizedGrandPrixId,
      rows: racePredictionDetailRows,
      predictionType: "race",
    }),
    upsertGrandPrixScoreDetailRows({
      grandPrixId: normalizedGrandPrixId,
      teamSelections,
      qualiPointsByDriverId,
      sprintQualiPointsByDriverId,
      sprintRacePointsByDriverId,
      racePointsByDriverId,
      preserveExistingQualiPoints: true,
      preserveExistingSprintQualiPoints: true,
      preserveExistingSprintRacePoints: true,
      preserveExistingRacePoints: false,
    }),
  ]);

  return scoreWriteResult;
}

export async function calculateGrandPrixSprintQualificationScores(
  grandPrixId: string,
) {
  const normalizedGrandPrixId = grandPrixId.trim();

  if (!normalizedGrandPrixId) {
    throw new Error(
      "calculateGrandPrixSprintQualificationScores requires a valid grandPrixId",
    );
  }

  const grandPrix = await ensureGrandPrixExists(normalizedGrandPrixId);
  const [
    driverResults,
    teamSelections,
    predictions,
    existingComponentsByUserId,
  ] = await Promise.all([
    loadDriverResults(normalizedGrandPrixId),
    loadTeamSelections(normalizedGrandPrixId),
    loadPredictions(normalizedGrandPrixId),
    loadExistingScores(normalizedGrandPrixId),
  ]);

  const sprintQualiPointsByDriverId = new Map<string, number>();
  const sprintRacePointsByDriverId = new Map<string, number>();
  const qualiPointsByDriverId = new Map<string, number>();
  const racePointsByDriverId = new Map<string, number>();
  driverResults.forEach((row) => {
    sprintQualiPointsByDriverId.set(
      row.driver_id,
      getSprintQualiTeamPointsForPosition(row.sprint_quali_position),
    );
    sprintRacePointsByDriverId.set(
      row.driver_id,
      getSprintRaceTeamPointsForPosition(row.sprint_race_position),
    );
  });
  const officialSprintQualiTopThree = buildTopThreeByPosition(
    driverResults,
    "sprint_quali_position",
  );

  const componentByUserId = new Map<string, ScoreComponentValues>(
    existingComponentsByUserId,
  );
  teamSelections.forEach((selection) => {
    const selectedDriverIds = (selection.team_selection_drivers ?? []).map(
      (selectedDriver) => selectedDriver.driver_id,
    );
    const sprintTeamComponents = buildSprintTeamComponents({
      isSprintWeekend: grandPrix.is_sprint_weekend,
      selectedDriverIds,
      sprintQualiPointsByDriverId,
      sprintRacePointsByDriverId,
    });
    const existing = componentByUserId.get(selection.user_id);
    componentByUserId.set(selection.user_id, {
      teamQualiPoints: existing?.teamQualiPoints ?? null,
      teamSprintQualiPoints: sprintTeamComponents.teamSprintQualiPoints,
      teamSprintRacePoints: existing?.teamSprintRacePoints ?? null,
      teamRacePoints: existing?.teamRacePoints ?? null,
      qualiPredictionPoints: existing?.qualiPredictionPoints ?? 0,
      sprintQualiPredictionPoints: existing?.sprintQualiPredictionPoints ?? 0,
      sprintRacePredictionPoints: existing?.sprintRacePredictionPoints ?? 0,
      racePredictionPoints: existing?.racePredictionPoints ?? 0,
      fastestPitstopPredictionPoints:
        existing?.fastestPitstopPredictionPoints ?? null,
      bonusPredictionPoints: existing?.bonusPredictionPoints ?? null,
    });
  });

  const sprintQualiPredictionDetailRows: GrandPrixPredictionScoreDetailRow[] =
    predictions.flatMap((prediction) => {
      const predictedTopThree = [
        prediction.sprint_quali_p1 ?? "",
        prediction.sprint_quali_p2 ?? "",
        prediction.sprint_quali_p3 ?? "",
      ];
      const pointsBySlot = calculateTopThreePredictionPointsBySlot(
        predictedTopThree,
        officialSprintQualiTopThree,
      );
      const existing = componentByUserId.get(prediction.user_id);
      componentByUserId.set(prediction.user_id, {
        teamQualiPoints: existing?.teamQualiPoints ?? null,
        teamSprintQualiPoints: existing?.teamSprintQualiPoints ?? null,
        teamSprintRacePoints: existing?.teamSprintRacePoints ?? null,
        teamRacePoints: existing?.teamRacePoints ?? null,
        qualiPredictionPoints: existing?.qualiPredictionPoints ?? 0,
        sprintQualiPredictionPoints: calculateTopThreePredictionPoints(
          predictedTopThree,
          officialSprintQualiTopThree,
        ),
        sprintRacePredictionPoints: existing?.sprintRacePredictionPoints ?? 0,
        racePredictionPoints: existing?.racePredictionPoints ?? 0,
        fastestPitstopPredictionPoints:
          existing?.fastestPitstopPredictionPoints ?? null,
        bonusPredictionPoints: existing?.bonusPredictionPoints ?? null,
      });
      return predictedTopThree.map((predictedDriverId, index) => ({
        grand_prix_id: normalizedGrandPrixId,
        user_id: prediction.user_id,
        prediction_type: "sprint_quali",
        slot_position: (index + 1) as 1 | 2 | 3,
        predicted_driver_id: predictedDriverId,
        points: pointsBySlot[index] ?? 0,
      }));
    });

  const [scoreWriteResult] = await Promise.all([
    upsertGrandPrixScoreRows(normalizedGrandPrixId, componentByUserId),
    upsertGrandPrixPredictionScoreDetailRows({
      grandPrixId: normalizedGrandPrixId,
      rows: sprintQualiPredictionDetailRows,
      predictionType: "sprint_quali",
    }),
    upsertGrandPrixScoreDetailRows({
      grandPrixId: normalizedGrandPrixId,
      teamSelections,
      qualiPointsByDriverId,
      sprintQualiPointsByDriverId,
      sprintRacePointsByDriverId,
      racePointsByDriverId,
      preserveExistingQualiPoints: true,
      preserveExistingSprintQualiPoints: false,
      preserveExistingSprintRacePoints: true,
      preserveExistingRacePoints: true,
    }),
  ]);

  return scoreWriteResult;
}

export async function calculateGrandPrixSprintRaceScores(grandPrixId: string) {
  const normalizedGrandPrixId = grandPrixId.trim();

  if (!normalizedGrandPrixId) {
    throw new Error(
      "calculateGrandPrixSprintRaceScores requires a valid grandPrixId",
    );
  }

  const grandPrix = await ensureGrandPrixExists(normalizedGrandPrixId);
  const [
    driverResults,
    teamSelections,
    predictions,
    existingComponentsByUserId,
  ] = await Promise.all([
    loadDriverResults(normalizedGrandPrixId),
    loadTeamSelections(normalizedGrandPrixId),
    loadPredictions(normalizedGrandPrixId),
    loadExistingScores(normalizedGrandPrixId),
  ]);

  const sprintQualiPointsByDriverId = new Map<string, number>();
  const sprintRacePointsByDriverId = new Map<string, number>();
  const qualiPointsByDriverId = new Map<string, number>();
  const racePointsByDriverId = new Map<string, number>();
  driverResults.forEach((row) => {
    sprintQualiPointsByDriverId.set(
      row.driver_id,
      getSprintQualiTeamPointsForPosition(row.sprint_quali_position),
    );
    sprintRacePointsByDriverId.set(
      row.driver_id,
      getSprintRaceTeamPointsForPosition(row.sprint_race_position),
    );
  });
  const officialSprintRaceTopThree = buildTopThreeByPosition(
    driverResults,
    "sprint_race_position",
  );

  const componentByUserId = new Map<string, ScoreComponentValues>(
    existingComponentsByUserId,
  );
  teamSelections.forEach((selection) => {
    const selectedDriverIds = (selection.team_selection_drivers ?? []).map(
      (selectedDriver) => selectedDriver.driver_id,
    );
    const sprintTeamComponents = buildSprintTeamComponents({
      isSprintWeekend: grandPrix.is_sprint_weekend,
      selectedDriverIds,
      sprintQualiPointsByDriverId,
      sprintRacePointsByDriverId,
    });
    const existing = componentByUserId.get(selection.user_id);
    componentByUserId.set(selection.user_id, {
      teamQualiPoints: existing?.teamQualiPoints ?? null,
      teamSprintQualiPoints: existing?.teamSprintQualiPoints ?? null,
      teamSprintRacePoints: sprintTeamComponents.teamSprintRacePoints,
      teamRacePoints: existing?.teamRacePoints ?? null,
      qualiPredictionPoints: existing?.qualiPredictionPoints ?? 0,
      sprintQualiPredictionPoints: existing?.sprintQualiPredictionPoints ?? 0,
      sprintRacePredictionPoints: existing?.sprintRacePredictionPoints ?? 0,
      racePredictionPoints: existing?.racePredictionPoints ?? 0,
      fastestPitstopPredictionPoints:
        existing?.fastestPitstopPredictionPoints ?? null,
      bonusPredictionPoints: existing?.bonusPredictionPoints ?? null,
    });
  });

  const sprintRacePredictionDetailRows: GrandPrixPredictionScoreDetailRow[] =
    predictions.flatMap((prediction) => {
      const predictedTopThree = [
        prediction.sprint_race_p1 ?? "",
        prediction.sprint_race_p2 ?? "",
        prediction.sprint_race_p3 ?? "",
      ];
      const pointsBySlot = calculateTopThreePredictionPointsBySlot(
        predictedTopThree,
        officialSprintRaceTopThree,
      );
      const existing = componentByUserId.get(prediction.user_id);
      componentByUserId.set(prediction.user_id, {
        teamQualiPoints: existing?.teamQualiPoints ?? null,
        teamSprintQualiPoints: existing?.teamSprintQualiPoints ?? null,
        teamSprintRacePoints: existing?.teamSprintRacePoints ?? null,
        teamRacePoints: existing?.teamRacePoints ?? null,
        qualiPredictionPoints: existing?.qualiPredictionPoints ?? 0,
        sprintQualiPredictionPoints: existing?.sprintQualiPredictionPoints ?? 0,
        sprintRacePredictionPoints: calculateTopThreePredictionPoints(
          predictedTopThree,
          officialSprintRaceTopThree,
        ),
        racePredictionPoints: existing?.racePredictionPoints ?? 0,
        fastestPitstopPredictionPoints:
          existing?.fastestPitstopPredictionPoints ?? null,
        bonusPredictionPoints: existing?.bonusPredictionPoints ?? null,
      });
      return predictedTopThree.map((predictedDriverId, index) => ({
        grand_prix_id: normalizedGrandPrixId,
        user_id: prediction.user_id,
        prediction_type: "sprint_race",
        slot_position: (index + 1) as 1 | 2 | 3,
        predicted_driver_id: predictedDriverId,
        points: pointsBySlot[index] ?? 0,
      }));
    });

  const [scoreWriteResult] = await Promise.all([
    upsertGrandPrixScoreRows(normalizedGrandPrixId, componentByUserId),
    upsertGrandPrixPredictionScoreDetailRows({
      grandPrixId: normalizedGrandPrixId,
      rows: sprintRacePredictionDetailRows,
      predictionType: "sprint_race",
    }),
    upsertGrandPrixScoreDetailRows({
      grandPrixId: normalizedGrandPrixId,
      teamSelections,
      qualiPointsByDriverId,
      sprintQualiPointsByDriverId,
      sprintRacePointsByDriverId,
      racePointsByDriverId,
      preserveExistingQualiPoints: true,
      preserveExistingSprintQualiPoints: true,
      preserveExistingSprintRacePoints: false,
      preserveExistingRacePoints: true,
    }),
  ]);

  return scoreWriteResult;
}

export async function calculateGrandPrixScores(grandPrixId: string) {
  return calculateGrandPrixRaceScores(grandPrixId);
}

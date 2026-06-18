import { getTeamSelectionValidity } from "@/lib/team-selection-validity";

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string | null;
};

type TeamSelectionRow = {
  user_id: string;
  team_selection_drivers: Array<{ driver_id: string }> | null;
};

type PredictionRow = {
  user_id: string;
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
};

export type GrandPrixParticipationRow = {
  userId: string;
  displayName: string;
  hasTeam: boolean;
  teamStatus: "valid" | "over_budget" | "missing";
  teamPriceTotal: number;
  hasPrediction: boolean;
  isMissingTeam: boolean;
  isMissingPrediction: boolean;
};

export function isTeamSelectionComplete(driverCount: number) {
  return driverCount === 4;
}

function hasTopThree(first: string | null, second: string | null, third: string | null) {
  return Boolean(first && second && third);
}

export function isPredictionComplete(prediction: PredictionRow, isSprintWeekend: boolean) {
  const hasQualiTopThree = hasTopThree(prediction.quali_p1, prediction.quali_p2, prediction.quali_p3);
  const hasRaceTopThree = hasTopThree(prediction.race_p1, prediction.race_p2, prediction.race_p3);

  if (!isSprintWeekend) {
    return hasQualiTopThree && hasRaceTopThree;
  }

  const hasSprintQualiTopThree = hasTopThree(
    prediction.sprint_quali_p1,
    prediction.sprint_quali_p2,
    prediction.sprint_quali_p3,
  );
  const hasSprintRaceTopThree = hasTopThree(prediction.sprint_race_p1, prediction.sprint_race_p2, prediction.sprint_race_p3);

  return hasSprintQualiTopThree && hasSprintRaceTopThree && hasQualiTopThree && hasRaceTopThree;
}

export function buildGrandPrixParticipationOverview(params: {
  profiles: ProfileRow[];
  teamSelections: TeamSelectionRow[];
  predictions: PredictionRow[];
  isSprintWeekend: boolean;
  includedUserIds?: string[];
  driverPricesById?: Map<string, number>;
}) {
  const includedUserIdsSet = params.includedUserIds ? new Set(params.includedUserIds) : null;
  const teamSelectionMap = new Map<string, TeamSelectionRow>();
  for (const selection of params.teamSelections) {
    teamSelectionMap.set(selection.user_id, selection);
  }

  const predictionMap = new Map<string, PredictionRow>();
  for (const prediction of params.predictions) {
    predictionMap.set(prediction.user_id, prediction);
  }

  const rows: GrandPrixParticipationRow[] = params.profiles
    .filter((profile) => profile.role !== "admin")
    .filter((profile) => (includedUserIdsSet ? includedUserIdsSet.has(profile.id) : true))
    .map((profile) => {
      const teamSelection = teamSelectionMap.get(profile.id);
      const prediction = predictionMap.get(profile.id);

      const selectedDriverIds = teamSelection?.team_selection_drivers?.map((driver) => driver.driver_id) ?? [];
      const validity = getTeamSelectionValidity(
        selectedDriverIds.map((driverId) => ({
          driverId,
          price: params.driverPricesById?.get(driverId),
        })),
      );
      const hasTeam = validity.isValid;
      const teamStatus = !validity.isComplete || validity.hasMissingPrice
        ? "missing"
        : validity.isWithinBudget
          ? "valid"
          : "over_budget";
      const hasPrediction = prediction ? isPredictionComplete(prediction, params.isSprintWeekend) : false;

      return {
        userId: profile.id,
        displayName: profile.display_name?.trim() || "Speler",
        hasTeam,
        teamStatus,
        teamPriceTotal: validity.totalPrice,
        hasPrediction,
        isMissingTeam: !hasTeam,
        isMissingPrediction: !hasPrediction,
      };
    })
    .sort((a, b) => {
      const aMissingCount = Number(a.isMissingTeam) + Number(a.isMissingPrediction);
      const bMissingCount = Number(b.isMissingTeam) + Number(b.isMissingPrediction);

      if (aMissingCount !== bMissingCount) {
        return bMissingCount - aMissingCount;
      }

      return a.displayName.localeCompare(b.displayName, "nl-NL");
    });

  const submittedTeamsCount = rows.filter((row) => row.hasTeam).length;
  const submittedPredictionsCount = rows.filter((row) => row.hasPrediction).length;

  return {
    rows,
    totalPlayers: rows.length,
    submittedTeamsCount,
    submittedPredictionsCount,
    usersMissingTeam: rows.filter((row) => row.isMissingTeam).map((row) => row.userId),
    usersMissingPrediction: rows.filter((row) => row.isMissingPrediction).map((row) => row.userId),
  };
}

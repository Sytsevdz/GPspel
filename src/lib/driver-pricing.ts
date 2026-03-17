export type ActiveDriver = {
  driverId: string;
  name: string;
};

export type GrandPrixResult = {
  grandPrixId: string;
  driverId: string;
  racePosition: number;
  qualiPosition: number;
};

export type CalculatedDriverPrice = {
  driverId: string;
  price: number;
};

type DriverStanding = {
  driverId: string;
  name: string;
  racePoints: number;
  qualifyingBonus: number;
  seasonScore: number;
  mostRecentRacePosition: number;
};

export type DriverSeasonScore = Pick<DriverStanding, "driverId" | "racePoints" | "qualifyingBonus" | "seasonScore">;

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

const PRICE_LADDER_BY_RANK = [
  380, 365, 350, 335, 315, 295, 275, 255, 235, 215, 200, 185, 170, 160, 150, 140, 135, 130, 125, 120, 115, 110,
] as const;

const getRacePointsForPosition = (position: number) => F1_RACE_POINTS_BY_POSITION[position] ?? 0;

const getQualifyingBonusForPosition = (position: number) => {
  if (position === 1) {
    return 3;
  }

  if (position === 2) {
    return 2;
  }

  if (position === 3) {
    return 1;
  }

  return 0;
};

export function calculateDriverSeasonScores(
  activeDrivers: ActiveDriver[],
  completedGrandPrixIdsInOrder: string[],
  allCompletedResults: GrandPrixResult[],
): DriverSeasonScore[] {
  const standingsByDriverId = new Map<string, DriverStanding>();

  activeDrivers.forEach((driver) => {
    standingsByDriverId.set(driver.driverId, {
      driverId: driver.driverId,
      name: driver.name,
      racePoints: 0,
      qualifyingBonus: 0,
      seasonScore: 0,
      mostRecentRacePosition: Number.POSITIVE_INFINITY,
    });
  });

  const mostRecentGrandPrixId = completedGrandPrixIdsInOrder[completedGrandPrixIdsInOrder.length - 1] ?? null;

  allCompletedResults.forEach((result) => {
    const standing = standingsByDriverId.get(result.driverId);

    if (!standing) {
      return;
    }

    if (Number.isFinite(result.racePosition) && result.racePosition > 0) {
      standing.racePoints += getRacePointsForPosition(result.racePosition);

      if (mostRecentGrandPrixId && result.grandPrixId === mostRecentGrandPrixId) {
        standing.mostRecentRacePosition = result.racePosition;
      }
    }

    if (Number.isFinite(result.qualiPosition) && result.qualiPosition > 0) {
      standing.qualifyingBonus += getQualifyingBonusForPosition(result.qualiPosition);
    }

    standing.seasonScore = standing.racePoints + standing.qualifyingBonus;
  });

  return [...standingsByDriverId.values()].map((standing) => ({
    driverId: standing.driverId,
    racePoints: standing.racePoints,
    qualifyingBonus: standing.qualifyingBonus,
    seasonScore: standing.seasonScore,
  }));
}

export function calculateDriverPricesFromSeasonResults(
  activeDrivers: ActiveDriver[],
  completedGrandPrixIdsInOrder: string[],
  allCompletedResults: GrandPrixResult[],
): CalculatedDriverPrice[] {
  if (activeDrivers.length === 0) {
    throw new Error("Geen actieve coureurs gevonden");
  }

  if (activeDrivers.length > PRICE_LADDER_BY_RANK.length) {
    throw new Error("Er zijn meer actieve coureurs dan beschikbare prijs-treden");
  }

  const seasonScores = calculateDriverSeasonScores(activeDrivers, completedGrandPrixIdsInOrder, allCompletedResults);
  const seasonScoresByDriverId = new Map(seasonScores.map((score) => [score.driverId, score]));
  const standingsByDriverId = new Map<string, DriverStanding>();

  activeDrivers.forEach((driver) => {
    const seasonScore = seasonScoresByDriverId.get(driver.driverId);

    standingsByDriverId.set(driver.driverId, {
      driverId: driver.driverId,
      name: driver.name,
      racePoints: seasonScore?.racePoints ?? 0,
      qualifyingBonus: seasonScore?.qualifyingBonus ?? 0,
      seasonScore: seasonScore?.seasonScore ?? 0,
      mostRecentRacePosition: Number.POSITIVE_INFINITY,
    });
  });

  const mostRecentGrandPrixId = completedGrandPrixIdsInOrder[completedGrandPrixIdsInOrder.length - 1] ?? null;

  allCompletedResults.forEach((result) => {
    if (!mostRecentGrandPrixId || result.grandPrixId !== mostRecentGrandPrixId) {
      return;
    }

    const standing = standingsByDriverId.get(result.driverId);

    if (!standing) {
      return;
    }

    if (Number.isFinite(result.racePosition) && result.racePosition > 0) {
      standing.mostRecentRacePosition = result.racePosition;
    }
  });

  const sortedStandings = [...standingsByDriverId.values()].sort((left, right) => {
    if (right.seasonScore !== left.seasonScore) {
      return right.seasonScore - left.seasonScore;
    }

    if (right.racePoints !== left.racePoints) {
      return right.racePoints - left.racePoints;
    }

    if (left.mostRecentRacePosition !== right.mostRecentRacePosition) {
      return left.mostRecentRacePosition - right.mostRecentRacePosition;
    }

    return left.name.localeCompare(right.name, "nl-NL");
  });

  return sortedStandings.map((standing, index) => ({
    driverId: standing.driverId,
    price: PRICE_LADDER_BY_RANK[index],
  }));
}

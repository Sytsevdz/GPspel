export type RaceResult = {
  driverId: string;
  racePosition: number;
};

export type CalculatedDriverPrice = {
  driverId: string;
  price: number;
};

const PRICING_CONFIG = {
  topPrice: 360,
  priceStep: 12,
  minimumPrice: 90,
} as const;

export function calculateDriverPricesFromRaceResults(
  activeDriverIds: string[],
  raceResults: RaceResult[],
): CalculatedDriverPrice[] {
  if (activeDriverIds.length === 0) {
    throw new Error("Geen actieve coureurs gevonden");
  }

  const activeDriverSet = new Set(activeDriverIds);

  const validRaceResults = raceResults.filter(
    (result) => activeDriverSet.has(result.driverId) && Number.isFinite(result.racePosition) && result.racePosition > 0,
  );

  if (validRaceResults.length !== activeDriverIds.length) {
    throw new Error("De vorige Grand Prix heeft geen volledige race-uitslag voor alle actieve coureurs");
  }

  const uniqueResultDriverIds = new Set(validRaceResults.map((result) => result.driverId));

  if (uniqueResultDriverIds.size !== activeDriverIds.length) {
    throw new Error("De vorige Grand Prix heeft dubbele of ontbrekende raceposities");
  }

  const sortedResults = [...validRaceResults].sort((left, right) => left.racePosition - right.racePosition);

  return sortedResults.map((result, index) => {
    const calculatedPrice = PRICING_CONFIG.topPrice - index * PRICING_CONFIG.priceStep;

    return {
      driverId: result.driverId,
      price: Math.max(PRICING_CONFIG.minimumPrice, calculatedPrice),
    };
  });
}

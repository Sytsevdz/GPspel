export const TEAM_SELECTION_MAX_BUDGET = 1000;
export const TEAM_SELECTION_REQUIRED_DRIVERS = 4;

export type TeamSelectionPriceDriver = {
  driverId: string;
  price: number | null | undefined;
};

export type TeamSelectionValidity = {
  driverCount: number;
  totalPrice: number;
  isComplete: boolean;
  isWithinBudget: boolean;
  isValid: boolean;
  hasMissingPrice: boolean;
};

export function calculateTeamSelectionPriceTotal(drivers: TeamSelectionPriceDriver[]) {
  return drivers.reduce((total, driver) => total + (driver.price ?? 0), 0);
}

export function getTeamSelectionValidity(drivers: TeamSelectionPriceDriver[]): TeamSelectionValidity {
  const driverCount = drivers.length;
  const totalPrice = calculateTeamSelectionPriceTotal(drivers);
  const hasMissingPrice = drivers.some((driver) => driver.price === null || driver.price === undefined);
  const isComplete = driverCount === TEAM_SELECTION_REQUIRED_DRIVERS;
  const isWithinBudget = totalPrice <= TEAM_SELECTION_MAX_BUDGET;

  return {
    driverCount,
    totalPrice,
    isComplete,
    isWithinBudget,
    isValid: isComplete && isWithinBudget && !hasMissingPrice,
    hasMissingPrice,
  };
}

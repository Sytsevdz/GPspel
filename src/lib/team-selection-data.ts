import {
  calculateDriverStandingsFromSeasonResults,
  compareDriverStandings,
} from "@/lib/driver-pricing";
import { createServerSupabaseClient } from "@/lib/supabase";

export type SelectableGrandPrix = {
  id: string;
  name: string;
  status: "upcoming" | "open" | "locked" | "finished";
  qualification_start: string;
  deadline: string;
};

export type GrandPrixTimelineItem = {
  id: string;
  name: string;
  qualification_start: string;
  deadline: string;
};

export type SelectableDriver = {
  id: string;
  name: string;
  constructorTeam: string;
  price: number;
  seasonScore: number;
  performanceRank: number;
};

type DriverPriceRow = {
  price: number;
  drivers: {
    id: string;
    name: string;
    constructor_team: string;
  } | null;
};

type DriverResultRow = {
  grand_prix_id: string;
  driver_id: string;
  quali_position: number | null;
  race_position: number | null;
};

export type TeamSelectionDataResult = {
  grandPrix: GrandPrixTimelineItem;
  drivers: SelectableDriver[];
  usesFallbackPrices: boolean;
};

async function loadDriverPrices(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  grandPrixId: string,
): Promise<SelectableDriver[]> {
  const { data: driverPriceRows, error: driversError } = await supabase
    .from("driver_prices")
    .select("price, drivers!inner(id, name, constructor_team)")
    .eq("grand_prix_id", grandPrixId)
    .order("price", { ascending: true })
    .returns<DriverPriceRow[]>();

  if (driversError) {
    throw new Error(driversError.message);
  }

  return (
    driverPriceRows
      ?.filter((row) => row.drivers)
      .map((row) => ({
        id: row.drivers!.id,
        name: row.drivers!.name,
        constructorTeam: row.drivers!.constructor_team,
        price: row.price,
        seasonScore: 0,
        performanceRank: Number.POSITIVE_INFINITY,
      })) ?? []
  );
}

async function enrichDriversWithSeasonScores(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  grandPrix: GrandPrixTimelineItem,
  drivers: SelectableDriver[],
): Promise<SelectableDriver[]> {
  if (drivers.length === 0) {
    return drivers;
  }

  const { data: completedGrandPrixRows, error: completedGrandPrixError } = await supabase
    .from("grand_prix")
    .select("id")
    .eq("status", "finished")
    .lt("qualification_start", grandPrix.qualification_start)
    .order("qualification_start", { ascending: true })
    .returns<Array<{ id: string }>>();

  if (completedGrandPrixError) {
    throw new Error(completedGrandPrixError.message);
  }

  const completedGrandPrixIds = (completedGrandPrixRows ?? []).map((row) => row.id);

  if (completedGrandPrixIds.length === 0) {
    return drivers;
  }

  const { data: completedDriverResults, error: completedDriverResultsError } = await supabase
    .from("grand_prix_driver_results")
    .select("grand_prix_id, driver_id, quali_position, race_position")
    .in("grand_prix_id", completedGrandPrixIds)
    .returns<DriverResultRow[]>();

  if (completedDriverResultsError) {
    throw new Error(completedDriverResultsError.message);
  }

  const sortedStandings = calculateDriverStandingsFromSeasonResults(
    drivers.map((driver) => ({
      driverId: driver.id,
      name: driver.name,
    })),
    completedGrandPrixIds,
    (completedDriverResults ?? []).map((row) => ({
      grandPrixId: row.grand_prix_id,
      driverId: row.driver_id,
      racePosition: row.race_position ?? 0,
      qualiPosition: row.quali_position ?? 0,
    })),
  ).sort(compareDriverStandings);

  const seasonScoreByDriverId = new Map(sortedStandings.map((standing) => [standing.driverId, standing.seasonScore]));
  const rankByDriverId = new Map(sortedStandings.map((standing, index) => [standing.driverId, index]));

  return drivers.map((driver) => ({
    ...driver,
    seasonScore: seasonScoreByDriverId.get(driver.id) ?? 0,
    performanceRank: rankByDriverId.get(driver.id) ?? Number.POSITIVE_INFINITY,
  }));
}

export async function getGrandPrixTimeline(
  supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<GrandPrixTimelineItem[]> {
  const { data, error } = await supabase
    .from("grand_prix")
    .select("id, name, qualification_start, deadline")
    .order("qualification_start", { ascending: true })
    .returns<GrandPrixTimelineItem[]>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error("Geen Grand Prix-weekenden gevonden");
  }

  return data;
}

export async function getCurrentSelectableGrandPrix(
  supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<GrandPrixTimelineItem> {
  const timeline = await getGrandPrixTimeline(supabase);
  const serverNowIso = new Date().toISOString();

  const selectableGrandPrix = timeline.find((grandPrix) => grandPrix.deadline > serverNowIso);

  if (selectableGrandPrix) {
    return selectableGrandPrix;
  }

  const mostRecentPastGrandPrix = [...timeline]
    .filter((grandPrix) => grandPrix.deadline <= serverNowIso)
    .sort((left, right) => right.qualification_start.localeCompare(left.qualification_start))[0];

  if (!mostRecentPastGrandPrix) {
    throw new Error("Geen Grand Prix beschikbaar");
  }

  return mostRecentPastGrandPrix;
}

export async function getGrandPrixAndDriversById(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  grandPrixId: string,
): Promise<TeamSelectionDataResult> {
  const { data: grandPrix, error: grandPrixError } = await supabase
    .from("grand_prix")
    .select("id, name, qualification_start, deadline")
    .eq("id", grandPrixId)
    .maybeSingle<GrandPrixTimelineItem>();

  if (grandPrixError) {
    throw new Error(grandPrixError.message);
  }

  if (!grandPrix) {
    throw new Error("Grand Prix niet gevonden");
  }

  const ownGrandPrixDrivers = await loadDriverPrices(supabase, grandPrix.id);

  if (ownGrandPrixDrivers.length > 0) {
    return {
      grandPrix,
      drivers: await enrichDriversWithSeasonScores(supabase, grandPrix, ownGrandPrixDrivers),
      usesFallbackPrices: false,
    };
  }

  const { data: earlierGrandPrixRows, error: earlierGrandPrixError } = await supabase
    .from("grand_prix")
    .select("id")
    .lt("qualification_start", grandPrix.qualification_start)
    .order("qualification_start", { ascending: false })
    .returns<Array<{ id: string }>>();

  if (earlierGrandPrixError) {
    throw new Error(earlierGrandPrixError.message);
  }

  for (const earlierGrandPrix of earlierGrandPrixRows ?? []) {
    const fallbackDrivers = await loadDriverPrices(supabase, earlierGrandPrix.id);

    if (fallbackDrivers.length > 0) {
      return {
        grandPrix,
        drivers: await enrichDriversWithSeasonScores(supabase, grandPrix, fallbackDrivers),
        usesFallbackPrices: true,
      };
    }
  }

  return {
    grandPrix,
    drivers: [],
    usesFallbackPrices: false,
  };
}

export function getGrandPrixNavigation(
  timeline: GrandPrixTimelineItem[],
  grandPrixId: string,
): {
  previousGrandPrixId: string | null;
  nextGrandPrixId: string | null;
} {
  const currentIndex = timeline.findIndex((grandPrix) => grandPrix.id === grandPrixId);

  if (currentIndex === -1) {
    return {
      previousGrandPrixId: null,
      nextGrandPrixId: null,
    };
  }

  return {
    previousGrandPrixId: timeline[currentIndex - 1]?.id ?? null,
    nextGrandPrixId: timeline[currentIndex + 1]?.id ?? null,
  };
}

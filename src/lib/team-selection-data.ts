import {
  calculateDriverStandingsFromSeasonResults,
  compareDriverStandings,
} from "@/lib/driver-pricing";
import { resolveGrandPrixWorkflowStatus, type GrandPrixStatus, type GrandPrixWorkflowStatus } from "@/lib/grand-prix-status";
import { createServerSupabaseClient } from "@/lib/supabase";

export type SelectableGrandPrix = {
  id: string;
  name: string;
  status: GrandPrixWorkflowStatus;
  qualification_start: string;
  deadline: string;
};

export type GrandPrixTimelineItem = {
  id: string;
  name: string;
  status: GrandPrixWorkflowStatus;
  qualification_start: string;
  deadline: string;
};

type GrandPrixTimelineDbRow = {
  id: string;
  name: string;
  status: GrandPrixStatus;
  qualification_start: string;
  deadline: string;
};

export type SelectableDriver = {
  id: string;
  name: string;
  constructorTeam: string;
  price: number;
  seasonScore: number;
  racePoints: number;
  mostRecentRacePosition: number;
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
        racePoints: 0,
        mostRecentRacePosition: Number.POSITIVE_INFINITY,
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
  const racePointsByDriverId = new Map(sortedStandings.map((standing) => [standing.driverId, standing.racePoints]));
  const mostRecentRacePositionByDriverId = new Map(
    sortedStandings.map((standing) => [standing.driverId, standing.mostRecentRacePosition]),
  );
  const rankByDriverId = new Map(sortedStandings.map((standing, index) => [standing.driverId, index]));

  return drivers.map((driver) => ({
    ...driver,
    seasonScore: seasonScoreByDriverId.get(driver.id) ?? 0,
    racePoints: racePointsByDriverId.get(driver.id) ?? 0,
    mostRecentRacePosition: mostRecentRacePositionByDriverId.get(driver.id) ?? Number.POSITIVE_INFINITY,
    performanceRank: rankByDriverId.get(driver.id) ?? Number.POSITIVE_INFINITY,
  }));
}

export async function getGrandPrixTimeline(
  supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<GrandPrixTimelineItem[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline")
    .order("qualification_start", { ascending: true })
    .returns<GrandPrixTimelineDbRow[]>();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    throw new Error("Geen Grand Prix-weekenden gevonden");
  }

  return data.map((grandPrix) => ({
    ...grandPrix,
    status: resolveGrandPrixWorkflowStatus({
      status: grandPrix.status,
      deadline: grandPrix.deadline,
      nowIso,
    }),
  }));
}

export async function getCurrentSelectableGrandPrix(
  supabase: ReturnType<typeof createServerSupabaseClient>,
): Promise<GrandPrixTimelineItem> {
  const timeline = await getGrandPrixTimeline(supabase);
  const serverNowIso = new Date().toISOString();
  const activeTimeline = timeline.filter((grandPrix) => grandPrix.status !== "cancelled");

  const selectableGrandPrix = activeTimeline.find((grandPrix) => grandPrix.deadline > serverNowIso);

  if (selectableGrandPrix) {
    return selectableGrandPrix;
  }

  const mostRecentPastGrandPrix = [...activeTimeline]
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
    .select("id, name, status, qualification_start, deadline")
    .eq("id", grandPrixId)
    .maybeSingle<GrandPrixTimelineDbRow>();

  if (grandPrixError) {
    throw new Error(grandPrixError.message);
  }

  if (!grandPrix) {
    throw new Error("Grand Prix niet gevonden");
  }

  const resolvedGrandPrix: GrandPrixTimelineItem = {
    ...grandPrix,
    status: resolveGrandPrixWorkflowStatus({
      status: grandPrix.status,
      deadline: grandPrix.deadline,
    }),
  };

  const ownGrandPrixDrivers = await loadDriverPrices(supabase, grandPrix.id);

  if (ownGrandPrixDrivers.length > 0) {
    return {
      grandPrix: resolvedGrandPrix,
      drivers: await enrichDriversWithSeasonScores(supabase, resolvedGrandPrix, ownGrandPrixDrivers),
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
        grandPrix: resolvedGrandPrix,
        drivers: await enrichDriversWithSeasonScores(supabase, resolvedGrandPrix, fallbackDrivers),
        usesFallbackPrices: true,
      };
    }
  }

  return {
    grandPrix: resolvedGrandPrix,
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

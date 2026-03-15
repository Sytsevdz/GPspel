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
};

type DriverPriceRow = {
  price: number;
  drivers: {
    id: string;
    name: string;
    constructor_team: string;
  } | null;
};

export type TeamSelectionDataResult = {
  grandPrix: GrandPrixTimelineItem;
  drivers: SelectableDriver[];
};

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

  if (!selectableGrandPrix) {
    throw new Error("Geen selecteerbare Grand Prix beschikbaar");
  }

  return selectableGrandPrix;
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

  const { data: driverPriceRows, error: driversError } = await supabase
    .from("driver_prices")
    .select("price, drivers!inner(id, name, constructor_team)")
    .eq("grand_prix_id", grandPrix.id)
    .order("price", { ascending: true })
    .returns<DriverPriceRow[]>();

  const drivers =
    driverPriceRows
      ?.filter((row) => row.drivers)
      .map((row) => ({
        id: row.drivers!.id,
        name: row.drivers!.name,
        constructorTeam: row.drivers!.constructor_team,
        price: row.price,
      })) ?? [];

  if (driversError || drivers.length === 0) {
    throw new Error(driversError?.message ?? "Geen coureurs met prijs gevonden");
  }

  return {
    grandPrix,
    drivers,
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

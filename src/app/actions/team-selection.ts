"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase";

const MAX_BUDGET = 1000;
const REQUIRED_DRIVERS = 4;

export type TeamSelectionActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

type DriverValidationRow = {
  price: number;
  drivers: {
    id: string;
    constructor_team: string;
    active: boolean;
  } | null;
};

const initialState: TeamSelectionActionState = {
  status: "idle",
};

export async function saveTeamSelection(
  _prevState: TeamSelectionActionState = initialState,
  formData: FormData,
): Promise<TeamSelectionActionState> {
  const leagueId = String(formData.get("league_id") ?? "").trim();
  const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();
  const selectedDriverIds = String(formData.get("selected_driver_ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!leagueId || !grandPrixId) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je team",
    };
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message: "Log opnieuw in om je team op te slaan.",
    };
  }

  const { data: league } = await supabase.from("leagues").select("id").eq("id", leagueId).maybeSingle();

  if (!league) {
    return {
      status: "error",
      message: "Je hebt geen toegang tot deze competitie.",
    };
  }

  if (selectedDriverIds.length !== REQUIRED_DRIVERS) {
    return {
      status: "error",
      message: "Je moet precies 4 coureurs kiezen",
    };
  }

  const uniqueDriverIds = Array.from(new Set(selectedDriverIds));

  if (uniqueDriverIds.length !== REQUIRED_DRIVERS) {
    return {
      status: "error",
      message: "Je moet precies 4 coureurs kiezen",
    };
  }

  const { data: selectedDrivers, error: selectedDriversError } = await supabase
    .from("driver_prices")
    .select("price, drivers!inner(id, constructor_team, active)")
    .eq("grand_prix_id", grandPrixId)
    .in("driver_id", uniqueDriverIds)
    .returns<DriverValidationRow[]>();

  if (selectedDriversError || !selectedDrivers || selectedDrivers.length !== REQUIRED_DRIVERS) {
    return {
      status: "error",
      message: "Niet alle geselecteerde coureurs zijn beschikbaar voor deze Grand Prix.",
    };
  }

  if (selectedDrivers.some((row) => !row.drivers || !row.drivers.active)) {
    return {
      status: "error",
      message: "Niet alle geselecteerde coureurs zijn actief.",
    };
  }

  const totalPrice = selectedDrivers.reduce((sum, row) => sum + row.price, 0);
  if (totalPrice > MAX_BUDGET) {
    return {
      status: "error",
      message: "Je team mag maximaal 100 miljoen kosten",
    };
  }

  const constructorTeams = new Set(selectedDrivers.map((row) => row.drivers?.constructor_team));
  if (constructorTeams.size !== REQUIRED_DRIVERS) {
    return {
      status: "error",
      message: "Je mag geen twee coureurs uit hetzelfde team kiezen",
    };
  }

  const { data: upsertedSelection, error: selectionError } = await supabase
    .from("team_selections")
    .upsert(
      {
        user_id: user.id,
        grand_prix_id: grandPrixId,
      },
      {
        onConflict: "user_id,grand_prix_id",
      },
    )
    .select("id")
    .single<{ id: string }>();

  if (selectionError || !upsertedSelection) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je team",
    };
  }

  const { error: deleteError } = await supabase
    .from("team_selection_drivers")
    .delete()
    .eq("team_selection_id", upsertedSelection.id);

  if (deleteError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je team",
    };
  }

  const { error: insertDriversError } = await supabase.from("team_selection_drivers").insert(
    uniqueDriverIds.map((driverId) => ({
      team_selection_id: upsertedSelection.id,
      driver_id: driverId,
    })),
  );

  if (insertDriversError) {
    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je team",
    };
  }

  revalidatePath(`/leagues/${leagueId}/team-selection`);

  return {
    status: "success",
    message: "Team succesvol opgeslagen",
  };
}

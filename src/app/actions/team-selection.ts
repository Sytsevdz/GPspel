"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase";
import { getSelectableGrandPrixAndDrivers } from "@/lib/team-selection-data";

const MAX_BUDGET = 1000;
const REQUIRED_DRIVERS = 4;

export type TeamSelectionActionState = {
  status: "idle" | "success" | "error";
  message?: string;
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

  const invocationId = crypto.randomUUID();

  console.info("[team-selection] saveTeamSelection called", {
    invocationId,
    leagueId,
    grandPrixId,
    selectedDriverIds,
  });

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

  let teamSelectionData: Awaited<ReturnType<typeof getSelectableGrandPrixAndDrivers>>;

  try {
    teamSelectionData = await getSelectableGrandPrixAndDrivers(supabase);
  } catch (error) {
    return {
      status: "error",
      message: "Kon geen selecteerbare Grand Prix laden",
    };
  }

  if (teamSelectionData.grandPrix.id !== grandPrixId) {
    return {
      status: "error",
      message: "De geselecteerde Grand Prix is niet meer beschikbaar. Vernieuw de pagina en probeer opnieuw.",
    };
  }

  const selectedDrivers = teamSelectionData.drivers.filter((driver) => uniqueDriverIds.includes(driver.id));

  if (selectedDrivers.length !== REQUIRED_DRIVERS) {
    return {
      status: "error",
      message: "Niet alle geselecteerde coureurs zijn beschikbaar voor deze Grand Prix.",
    };
  }

  const totalPrice = selectedDrivers.reduce((sum, row) => sum + row.price, 0);
  if (totalPrice > MAX_BUDGET) {
    return {
      status: "error",
      message: "Je team mag maximaal 100 miljoen kosten",
    };
  }

  const constructorTeams = new Set(selectedDrivers.map((row) => row.constructorTeam));
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
    console.error("[team-selection] Failed to resolve team_selection", {
      invocationId,
      userId: user.id,
      grandPrixId,
      selectionError,
    });

    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je team",
    };
  }

  const teamSelectionId = upsertedSelection.id;

  const { data: relatedSelections, error: relatedSelectionsError } = await supabase
    .from("team_selections")
    .select("id")
    .eq("user_id", user.id)
    .eq("grand_prix_id", grandPrixId)
    .returns<Array<{ id: string }>>();

  if (relatedSelectionsError) {
    console.error("[team-selection] Failed to load related team_selections", {
      invocationId,
      userId: user.id,
      grandPrixId,
      relatedSelectionsError,
    });

    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je team",
    };
  }

  const relatedSelectionIds = relatedSelections?.map((selection) => selection.id) ?? [teamSelectionId];
  const staleSelectionIds = relatedSelectionIds.filter((selectionId) => selectionId !== teamSelectionId);

  if (staleSelectionIds.length > 0) {
    const { error: staleSelectionDeleteError } = await supabase
      .from("team_selections")
      .delete()
      .in("id", staleSelectionIds)
      .eq("user_id", user.id);

    if (staleSelectionDeleteError) {
      console.error("[team-selection] Failed to delete stale team_selections", {
        invocationId,
        userId: user.id,
        grandPrixId,
        staleSelectionIds,
        staleSelectionDeleteError,
      });

      return {
        status: "error",
        message: "Er ging iets mis bij het opslaan van je team",
      };
    }
  }

  console.info("[team-selection] Resolved team_selection_id", {
    invocationId,
    teamSelectionId,
    userId: user.id,
    grandPrixId,
  });

  const { data: existingDriversBeforeDelete, error: existingDriversError } = await supabase
    .from("team_selection_drivers")
    .select("driver_id")
    .eq("team_selection_id", teamSelectionId);

  if (existingDriversError) {
    console.error("[team-selection] Failed to load existing team_selection_drivers", {
      invocationId,
      teamSelectionId,
      existingDriversError,
    });

    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je team",
    };
  }

  console.info("[team-selection] Existing team_selection_drivers before delete", {
    invocationId,
    teamSelectionId,
    existingDriverIds: existingDriversBeforeDelete?.map((row) => row.driver_id) ?? [],
    existingCount: existingDriversBeforeDelete?.length ?? 0,
  });

  const { data: deletedDrivers, error: deleteError } = await supabase
    .from("team_selection_drivers")
    .delete()
    .in("team_selection_id", relatedSelectionIds)
    .select("driver_id");

  if (deleteError) {
    console.error("[team-selection] Failed to delete existing team_selection_drivers", {
      invocationId,
      teamSelectionId,
      deleteError,
    });

    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je team",
    };
  }

  console.info("[team-selection] Deleted existing team_selection_drivers", {
    invocationId,
    teamSelectionId,
    deletedCount: deletedDrivers?.length ?? 0,
  });

  const insertPayload = uniqueDriverIds.map((driverId) => ({
    team_selection_id: teamSelectionId,
    driver_id: driverId,
  }));

  console.info("[team-selection] Insert payload for team_selection_drivers", {
    invocationId,
    teamSelectionId,
    insertPayload,
  });

  const { data: insertedDrivers, error: insertDriversError } = await supabase
    .from("team_selection_drivers")
    .upsert(insertPayload, { onConflict: "team_selection_id,driver_id" })
    .select("driver_id");

  if (insertDriversError) {
    console.error("[team-selection] Failed to insert team_selection_drivers", {
      invocationId,
      teamSelectionId,
      insertPayload,
      insertDriversError,
    });

    return {
      status: "error",
      message: "Er ging iets mis bij het opslaan van je team",
    };
  }

  console.info("[team-selection] Inserted new team_selection_drivers", {
    invocationId,
    teamSelectionId,
    insertedCount: insertedDrivers?.length ?? 0,
  });

  revalidatePath(`/leagues/${leagueId}/team-selection`);

  return {
    status: "success",
    message: "Team succesvol opgeslagen",
  };
}

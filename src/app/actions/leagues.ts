"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServerSupabaseActionClient, createServerSupabaseClient } from "@/lib/supabase";

const toLeaguesRedirect = (key: "error" | "message", value: string) => {
  const params = new URLSearchParams({ [key]: value });
  return `/leagues?${params.toString()}`;
};

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 8;

const generateJoinCode = () => {
  let code = "";

  for (let index = 0; index < JOIN_CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * JOIN_CODE_CHARS.length);
    code += JOIN_CODE_CHARS[randomIndex];
  }

  return code;
};

const createLeagueWithUniqueJoinCode = async (
  supabase: ReturnType<typeof createServerSupabaseActionClient>,
  name: string,
  userId: string,
) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = generateJoinCode();
    const { data: league, error } = await supabase
      .from("leagues")
      .insert({
        name,
        join_code: joinCode,
        created_by: userId,
      })
      .select("id, name")
      .single();

    if (!error) {
      return { league, error: null as null };
    }

    if (error.code !== "23505") {
      return { league: null, error };
    }
  }

  return { league: null, error: null };
};

export async function joinLeague(formData: FormData) {
  const joinCode = String(formData.get("join_code") ?? "").trim();
  const supabase = createServerSupabaseClient();

  if (!joinCode) {
    redirect(toLeaguesRedirect("error", "Deelnemingscode is verplicht."));
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[joinLeague] auth.getUser failed", {
      message: authError.message,
      code: authError.code,
      status: authError.status,
      joinCode,
    });
    redirect(toLeaguesRedirect("error", "Log in en probeer het opnieuw."));
  }

  if (!user) {
    redirect(toLeaguesRedirect("error", "Log in om deel te nemen aan een competitie."));
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, name")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (leagueError) {
    console.error("[joinLeague] league lookup failed", {
      message: leagueError.message,
      code: leagueError.code,
      details: leagueError.details,
      hint: leagueError.hint,
      joinCode,
      userId: user.id,
    });
    redirect(toLeaguesRedirect("error", "Kon nu niet deelnemen aan de competitie. Probeer het opnieuw."));
  }

  if (!league) {
    redirect(toLeaguesRedirect("error", "Geen competitie gevonden met deze deelnemingscode."));
  }

  const { data: existingMember, error: existingMemberError } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMemberError) {
    console.error("[joinLeague] membership check failed", {
      message: existingMemberError.message,
      code: existingMemberError.code,
      details: existingMemberError.details,
      hint: existingMemberError.hint,
      joinCode,
      leagueId: league.id,
      userId: user.id,
    });
    redirect(toLeaguesRedirect("error", "Kon nu niet deelnemen aan de competitie. Probeer het opnieuw."));
  }

  if (existingMember) {
    redirect(toLeaguesRedirect("message", `Je bent al lid van ${league.name}.`));
  }

  const { error: insertError } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    role: "member",
  });

  if (insertError) {
    console.error("[joinLeague] membership insert failed", {
      message: insertError.message,
      code: insertError.code,
      details: insertError.details,
      hint: insertError.hint,
      joinCode,
      leagueId: league.id,
      userId: user.id,
    });

    if (insertError.code === "23505") {
      redirect(toLeaguesRedirect("message", `Je bent al lid van ${league.name}.`));
    }

    redirect(toLeaguesRedirect("error", "Kon nu niet deelnemen aan de competitie. Probeer het opnieuw."));
  }

  redirect(toLeaguesRedirect("message", `Succesvol deelgenomen aan ${league.name}.`));
}

export async function createLeague(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const supabase = createServerSupabaseActionClient();

  if (!name) {
    redirect(toLeaguesRedirect("error", "Naam van de league is verplicht."));
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[createLeague] auth.getUser failed", {
      message: authError.message,
      code: authError.code,
      status: authError.status,
      name,
    });
    redirect(toLeaguesRedirect("error", "Log in en probeer het opnieuw."));
  }

  if (!user) {
    redirect(toLeaguesRedirect("error", "Log in om een league aan te maken."));
  }

  const { league, error: createError } = await createLeagueWithUniqueJoinCode(supabase, name, user.id);

  if (createError || !league) {
    console.error("[createLeague] league insert failed", {
      message: createError?.message,
      code: createError?.code,
      details: createError?.details,
      hint: createError?.hint,
      name,
      userId: user.id,
    });
    redirect(toLeaguesRedirect("error", "Kon de league nu niet aanmaken. Probeer het opnieuw."));
  }

  const { error: membershipError } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    role: "owner",
  });

  if (membershipError) {
    console.error("[createLeague] league_members insert failed", {
      message: membershipError.message,
      code: membershipError.code,
      details: membershipError.details,
      hint: membershipError.hint,
      leagueId: league.id,
      userId: user.id,
    });
    redirect(toLeaguesRedirect("error", "League aangemaakt, maar toevoegen als lid mislukte. Probeer opnieuw."));
  }

  redirect(`/leagues/${league.id}`);
}

export async function deleteLeague(formData: FormData) {
  const leagueId = String(formData.get("league_id") ?? "").trim();
  const supabase = createServerSupabaseActionClient();

  if (!leagueId) {
    redirect(toLeaguesRedirect("error", "Ongeldige league geselecteerd."));
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[deleteLeague] auth.getUser failed", {
      message: authError.message,
      code: authError.code,
      status: authError.status,
      leagueId,
    });
    redirect(toLeaguesRedirect("error", "Log in en probeer het opnieuw."));
  }

  if (!user) {
    redirect(toLeaguesRedirect("error", "Log in om een league te verwijderen."));
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, created_by")
    .eq("id", leagueId)
    .maybeSingle<{ id: string; created_by: string | null }>();

  if (leagueError || !league) {
    console.error("[deleteLeague] league lookup failed", {
      message: leagueError?.message,
      code: leagueError?.code,
      details: leagueError?.details,
      hint: leagueError?.hint,
      leagueId,
      userId: user.id,
    });
    redirect(toLeaguesRedirect("error", "League niet gevonden of niet toegankelijk."));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profileError) {
    console.error("[deleteLeague] profile lookup failed", {
      message: profileError.message,
      code: profileError.code,
      details: profileError.details,
      hint: profileError.hint,
      leagueId,
      userId: user.id,
    });
    redirect(toLeaguesRedirect("error", "Je rechten konden niet worden gecontroleerd."));
  }

  const canDeleteLeague = league.created_by === user.id || profile?.role === "admin";

  if (!canDeleteLeague) {
    redirect(toLeaguesRedirect("error", "Je hebt geen rechten om deze league te verwijderen."));
  }

  const { error: deleteError } = await supabase.from("leagues").delete().eq("id", leagueId);

  if (deleteError) {
    console.error("[deleteLeague] league delete failed", {
      message: deleteError.message,
      code: deleteError.code,
      details: deleteError.details,
      hint: deleteError.hint,
      leagueId,
      userId: user.id,
    });
    redirect(toLeaguesRedirect("error", "Verwijderen van de league is mislukt. Probeer het opnieuw."));
  }

  revalidatePath("/leagues");
  redirect(toLeaguesRedirect("message", "League succesvol verwijderd."));
}

export async function leaveLeague(formData: FormData) {
  const leagueId = String(formData.get("league_id") ?? "").trim();
  const supabase = createServerSupabaseActionClient();

  if (!leagueId) {
    redirect(toLeaguesRedirect("error", "Ongeldige league geselecteerd."));
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[leaveLeague] auth.getUser failed", {
      message: authError.message,
      code: authError.code,
      status: authError.status,
      leagueId,
    });
    redirect(toLeaguesRedirect("error", "Log in en probeer het opnieuw."));
  }

  if (!user) {
    redirect(toLeaguesRedirect("error", "Log in om een league te verlaten."));
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id, created_by")
    .eq("id", leagueId)
    .maybeSingle<{ id: string; created_by: string | null }>();

  if (leagueError || !league) {
    console.error("[leaveLeague] league lookup failed", {
      message: leagueError?.message,
      code: leagueError?.code,
      details: leagueError?.details,
      hint: leagueError?.hint,
      leagueId,
      userId: user.id,
    });
    redirect(toLeaguesRedirect("error", "League niet gevonden of niet toegankelijk."));
  }

  if (league.created_by === user.id) {
    redirect(toLeaguesRedirect("error", "De eigenaar kan de league niet verlaten."));
  }

  const { data: membership, error: membershipError } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (membershipError) {
    console.error("[leaveLeague] membership lookup failed", {
      message: membershipError.message,
      code: membershipError.code,
      details: membershipError.details,
      hint: membershipError.hint,
      leagueId,
      userId: user.id,
    });
    redirect(toLeaguesRedirect("error", "Je lidmaatschap kon niet worden gecontroleerd."));
  }

  if (!membership) {
    redirect(toLeaguesRedirect("error", "Je bent geen lid van deze league."));
  }

  const { error: deleteMembershipError } = await supabase
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", user.id);

  if (deleteMembershipError) {
    console.error("[leaveLeague] membership delete failed", {
      message: deleteMembershipError.message,
      code: deleteMembershipError.code,
      details: deleteMembershipError.details,
      hint: deleteMembershipError.hint,
      leagueId,
      userId: user.id,
    });
    redirect(toLeaguesRedirect("error", "Verlaten van de league is mislukt. Probeer het opnieuw."));
  }

  revalidatePath("/leagues");
  revalidatePath(`/leagues/${leagueId}`);
  redirect(toLeaguesRedirect("message", "Je hebt de league verlaten."));
}

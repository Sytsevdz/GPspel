"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

const toLeaguesRedirect = (key: "error" | "message", value: string) => {
  const params = new URLSearchParams({ [key]: value });
  return `/leagues?${params.toString()}`;
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

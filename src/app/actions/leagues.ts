"use server";

import { redirect } from "next/navigation";

import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabase";

const toLeaguesRedirect = (key: "error" | "message", value: string) => {
  const params = new URLSearchParams({ [key]: value });
  return `/leagues?${params.toString()}`;
};

export async function joinLeague(formData: FormData) {
  const joinCode = String(formData.get("join_code") ?? "").trim();

  if (!joinCode) {
    redirect(toLeaguesRedirect("error", "Join code is required."));
  }

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const adminSupabase = createAdminSupabaseClient();

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect(toLeaguesRedirect("error", "Profile not found. Please contact support."));
  }

  const { data: league, error: leagueError } = await adminSupabase
    .from("leagues")
    .select("id, name")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (leagueError || !league) {
    redirect(toLeaguesRedirect("error", "No league found for that join code."));
  }

  const { data: existingMember, error: existingMemberError } = await adminSupabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMemberError) {
    redirect(toLeaguesRedirect("error", "Unable to join league right now. Please try again."));
  }

  if (existingMember) {
    redirect(toLeaguesRedirect("message", `You are already a member of ${league.name}.`));
  }

  const { error: insertError } = await adminSupabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    role: "member",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      redirect(toLeaguesRedirect("message", `You are already a member of ${league.name}.`));
    }

    redirect(toLeaguesRedirect("error", "Unable to join league right now. Please try again."));
  }

  redirect(toLeaguesRedirect("message", `Successfully joined ${league.name}.`));
}

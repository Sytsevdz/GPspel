import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

type League = {
  id: string;
  name: string;
  join_code: string;
  created_by: string | null;
};

export async function getAccessibleLeague(leagueId: string): Promise<League | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] = await Promise.all([
    supabase
      .from("league_members")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .maybeSingle<{ id: string }>(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string | null }>(),
  ]);

  if (membershipError || profileError) {
    return null;
  }

  const canAccessLeague = Boolean(membership || profile?.role === "admin");

  if (!canAccessLeague) {
    return null;
  }

  const { data: league, error } = await supabase
    .from("leagues")
    .select("id, name, join_code, created_by")
    .eq("id", leagueId)
    .maybeSingle<League>();

  if (error || !league) {
    return null;
  }

  return league;
}

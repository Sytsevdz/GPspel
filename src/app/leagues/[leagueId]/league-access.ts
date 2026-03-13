import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

type League = {
  id: string;
  name: string;
  join_code: string;
};

export async function getAccessibleLeague(leagueId: string): Promise<League | null> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: league, error } = await supabase
    .from("leagues")
    .select("id, name, join_code")
    .eq("id", leagueId)
    .maybeSingle<League>();

  if (error || !league) {
    return null;
  }

  return league;
}

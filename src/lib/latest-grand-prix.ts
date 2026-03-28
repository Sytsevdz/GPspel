import { createServerSupabaseClient } from "@/lib/supabase";

export type LatestGrandPrixCandidate = {
  id: string;
  name: string;
  deadline: string;
  status: "upcoming" | "open" | "locked" | "finished";
};

export async function getLatestCurrentOrScoredGrandPrix(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  scoredGrandPrixIds: string[],
  nowIso: string = new Date().toISOString(),
): Promise<LatestGrandPrixCandidate | null> {
  const { data: currentOrRecentGrandPrix } = await supabase
    .from("grand_prix")
    .select("id, name, deadline, status")
    .neq("status", "cancelled")
    .lte("deadline", nowIso)
    .order("deadline", { ascending: false })
    .limit(1)
    .maybeSingle<LatestGrandPrixCandidate>();

  if (currentOrRecentGrandPrix) {
    return currentOrRecentGrandPrix;
  }

  if (scoredGrandPrixIds.length === 0) {
    return null;
  }

  const { data: fallbackScoredGrandPrix } = await supabase
    .from("grand_prix")
    .select("id, name, deadline, status")
    .in("id", scoredGrandPrixIds)
    .neq("status", "cancelled")
    .order("deadline", { ascending: false })
    .limit(1)
    .maybeSingle<LatestGrandPrixCandidate>();

  return fallbackScoredGrandPrix;
}

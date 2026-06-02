import { createServerSupabaseClient } from "@/lib/supabase";
import { resolveGrandPrixWorkflowStatus, type GrandPrixStatus, type GrandPrixWorkflowStatus } from "@/lib/grand-prix-status";

export type LatestGrandPrixCandidate = {
  id: string;
  name: string;
  deadline: string;
  status: GrandPrixWorkflowStatus;
  is_sprint_weekend: boolean;
};

type LatestGrandPrixDbCandidate = {
  id: string;
  name: string;
  deadline: string;
  status: GrandPrixStatus;
  is_sprint_weekend: boolean;
};

export async function getLatestPastOrScoredGrandPrix(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  scoredGrandPrixIds: string[],
  nowIso: string = new Date().toISOString(),
): Promise<LatestGrandPrixCandidate | null> {
  const resolveCandidate = (candidate: LatestGrandPrixDbCandidate): LatestGrandPrixCandidate => ({
    ...candidate,
    status: resolveGrandPrixWorkflowStatus({
      status: candidate.status,
      deadline: candidate.deadline,
      nowIso,
    }),
  });

  const { data: latestPastGrandPrix } = await supabase
    .from("grand_prix")
    .select("id, name, deadline, status, is_sprint_weekend")
    .neq("status", "cancelled")
    .lte("deadline", nowIso)
    .order("deadline", { ascending: false })
    .limit(1)
    .maybeSingle<LatestGrandPrixDbCandidate>();

  if (latestPastGrandPrix) {
    return resolveCandidate(latestPastGrandPrix);
  }

  if (scoredGrandPrixIds.length === 0) {
    return null;
  }

  const { data: fallbackScoredGrandPrix } = await supabase
    .from("grand_prix")
    .select("id, name, deadline, status, is_sprint_weekend")
    .in("id", scoredGrandPrixIds)
    .neq("status", "cancelled")
    .order("deadline", { ascending: false })
    .limit(1)
    .maybeSingle<LatestGrandPrixDbCandidate>();

  return fallbackScoredGrandPrix ? resolveCandidate(fallbackScoredGrandPrix) : null;
}

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";
import {
  getGameplayGrandPrix,
  getGrandPrixTimeline,
} from "@/lib/team-selection-data";

import { getAccessibleLeague } from "../league-access";

type GPSpelRedirectPageProps = {
  params: {
    leagueId: string;
  };
};

export default async function GPSpelRedirectPage({ params }: GPSpelRedirectPageProps) {
  const league = await getAccessibleLeague(params.leagueId);

  if (!league) {
    redirect(`/leagues/${params.leagueId}`);
  }

  const supabase = createServerSupabaseClient();
  const timeline = await getGrandPrixTimeline(supabase);
  const gameplayGrandPrix = getGameplayGrandPrix(timeline);

  if (!gameplayGrandPrix) {
    redirect(`/leagues/${params.leagueId}`);
  }

  redirect(`/leagues/${params.leagueId}/gp-spel/${gameplayGrandPrix.id}`);
}

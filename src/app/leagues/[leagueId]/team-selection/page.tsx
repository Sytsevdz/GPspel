import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";
import { getCurrentSelectableGrandPrix } from "@/lib/team-selection-data";

type TeamSelectionRedirectPageProps = {
  params: {
    leagueId: string;
  };
};

export default async function TeamSelectionRedirectPage({ params }: TeamSelectionRedirectPageProps) {
  const supabase = createServerSupabaseClient();

  const selectableGrandPrix = await getCurrentSelectableGrandPrix(supabase);

  redirect(`/leagues/${params.leagueId}/team-selection/${selectableGrandPrix.id}`);
}

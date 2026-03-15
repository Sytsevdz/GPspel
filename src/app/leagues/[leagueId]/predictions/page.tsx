import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";
import { getCurrentSelectableGrandPrix } from "@/lib/team-selection-data";

type PredictionsRedirectPageProps = {
  params: {
    leagueId: string;
  };
};

export default async function PredictionsRedirectPage({ params }: PredictionsRedirectPageProps) {
  const supabase = createServerSupabaseClient();

  const selectableGrandPrix = await getCurrentSelectableGrandPrix(supabase);

  redirect(`/leagues/${params.leagueId}/predictions/${selectableGrandPrix.id}`);
}

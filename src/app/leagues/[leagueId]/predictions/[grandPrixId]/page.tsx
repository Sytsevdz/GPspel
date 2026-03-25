import { redirect } from "next/navigation";

type LegacyPredictionsGrandPrixRedirectPageProps = {
  params: {
    leagueId: string;
    grandPrixId: string;
  };
};

export default function LegacyPredictionsGrandPrixRedirectPage({
  params,
}: LegacyPredictionsGrandPrixRedirectPageProps) {
  redirect(`/leagues/${params.leagueId}/gp-spel/${params.grandPrixId}`);
}

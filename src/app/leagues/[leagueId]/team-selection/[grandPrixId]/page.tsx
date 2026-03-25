import { redirect } from "next/navigation";

type LegacyTeamSelectionGrandPrixRedirectPageProps = {
  params: {
    leagueId: string;
    grandPrixId: string;
  };
};

export default function LegacyTeamSelectionGrandPrixRedirectPage({
  params,
}: LegacyTeamSelectionGrandPrixRedirectPageProps) {
  redirect(`/leagues/${params.leagueId}/gp-spel/${params.grandPrixId}`);
}

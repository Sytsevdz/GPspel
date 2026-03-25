import { redirect } from "next/navigation";

type LegacyTeamSelectionRedirectPageProps = {
  params: {
    leagueId: string;
  };
};

export default function LegacyTeamSelectionRedirectPage({ params }: LegacyTeamSelectionRedirectPageProps) {
  redirect(`/leagues/${params.leagueId}/gp-spel`);
}

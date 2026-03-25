import { redirect } from "next/navigation";

type LegacyPredictionsRedirectPageProps = {
  params: {
    leagueId: string;
  };
};

export default function LegacyPredictionsRedirectPage({ params }: LegacyPredictionsRedirectPageProps) {
  redirect(`/leagues/${params.leagueId}/gp-spel`);
}

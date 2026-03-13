import Link from "next/link";

import { getAccessibleLeague } from "../league-access";

type PredictionsPageProps = {
  params: {
    leagueId: string;
  };
};

export default async function PredictionsPage({ params }: PredictionsPageProps) {
  const league = await getAccessibleLeague(params.leagueId);

  if (!league) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>Access denied</h1>
          <p>This page is only available to members of this league.</p>
          <Link href="/leagues" className="league-back-link">
            ← Back to your leagues
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="leagues-page">
      <section className="leagues-card league-access-card">
        <h1>Predictions</h1>
        <p>Predictions for {league.name} will be available here.</p>
        <Link href={`/leagues/${league.id}`} className="league-back-link">
          ← Back to league
        </Link>
      </section>
    </main>
  );
}

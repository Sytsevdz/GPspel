import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

type LeaguePageProps = {
  params: {
    leagueId: string;
  };
};

export default async function LeaguePage({ params }: LeaguePageProps) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: league, error } = await supabase
    .from("leagues")
    .select("id, name, join_code")
    .eq("id", params.leagueId)
    .maybeSingle();

  if (error || !league) {
    notFound();
  }

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <h1>{league.name}</h1>
        <p>This league page is ready for upcoming features.</p>
        <p>
          Join code: <span>{league.join_code}</span>
        </p>
        <Link href="/leagues" className="league-back-link">
          ← Back to leagues overview
        </Link>
      </section>
    </main>
  );
}

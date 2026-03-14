import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase";

import { getAccessibleLeague } from "./league-access";

type LeaguePageProps = {
  params: {
    leagueId: string;
  };
};

type LeagueMemberRow = {
  user_id: string;
  role: "owner" | "admin" | "member" | null;
  joined_at: string;
  profiles: {
    display_name: string;
  } | null;
};

type GrandPrix = {
  id: string;
  name: string;
  status: "upcoming" | "open" | "locked" | "finished";
  qualification_start: string;
  deadline: string;
  is_sprint_weekend: boolean;
};

const getCurrentOrUpcomingGrandPrix = async (supabase: ReturnType<typeof createServerSupabaseClient>) => {
  const { data: openGrandPrix, error: openGrandPrixError } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline, is_sprint_weekend")
    .eq("status", "open")
    .order("deadline", { ascending: true })
    .limit(1)
    .maybeSingle<GrandPrix>();

  if (openGrandPrixError) {
    console.error("[LeaguePage] open Grand Prix lookup failed", openGrandPrixError);
  }

  if (openGrandPrix) {
    return openGrandPrix;
  }

  const { data: upcomingGrandPrix, error: upcomingGrandPrixError } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline, is_sprint_weekend")
    .eq("status", "upcoming")
    .order("qualification_start", { ascending: true })
    .limit(1)
    .maybeSingle<GrandPrix>();

  if (upcomingGrandPrixError) {
    console.error("[LeaguePage] upcoming Grand Prix lookup failed", upcomingGrandPrixError);
  }

  return upcomingGrandPrix ?? null;
};

export default async function LeaguePage({ params }: LeaguePageProps) {
  const league = await getAccessibleLeague(params.leagueId);

  if (!league) {
    return (
      <main className="leagues-page">
        <section className="leagues-card league-access-card">
          <h1>League not available</h1>
          <p>You do not have access to this league, or it does not exist.</p>
          <Link href="/leagues" className="league-back-link">
            ← Back to your leagues
          </Link>
        </section>
      </main>
    );
  }

  const supabase = createServerSupabaseClient();

  const { data: members, error: membersError } = await supabase
    .from("league_members")
    .select("user_id, role, joined_at, profiles(display_name)")
    .eq("league_id", league.id)
    .order("joined_at", { ascending: true })
    .returns<LeagueMemberRow[]>();

  const currentOrUpcomingGrandPrix = await getCurrentOrUpcomingGrandPrix(supabase);

  return (
    <main className="leagues-page">
      <section className="leagues-card league-detail-card">
        <div className="league-detail-header">
          <div>
            <h1>{league.name}</h1>
            <p>
              Join code: <span>{league.join_code}</span>
            </p>
          </div>
          <Link href="/leagues" className="league-back-link">
            ← All leagues
          </Link>
        </div>

        <nav className="league-actions" aria-label="League actions">
          <Link href={`/leagues/${league.id}/team-selection`}>Team kiezen</Link>
          <Link href={`/leagues/${league.id}/predictions`}>Voorspellingen</Link>
          <Link href={`/leagues/${league.id}/standings`}>Standings (soon)</Link>
        </nav>

        <section className="league-section">
          <h2>Members</h2>
          {membersError ? (
            <p className="form-message error">Unable to load members right now.</p>
          ) : members && members.length > 0 ? (
            <ul className="league-member-list" aria-label="League members">
              {members.map((member) => (
                <li key={member.user_id} className="league-member-item">
                  <span>{member.profiles?.display_name ?? "Player"}</span>
                  <span className="league-member-role">{member.role ?? "member"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="league-list-empty">No members found for this league.</p>
          )}
        </section>

        <section className="league-section">
          <h2>Current or upcoming Grand Prix</h2>
          {currentOrUpcomingGrandPrix ? (
            <div className="gp-highlight">
              <p className="gp-highlight-title">{currentOrUpcomingGrandPrix.name}</p>
              <p>
                Status: <strong>{currentOrUpcomingGrandPrix.status === "open" ? "Open now" : "Upcoming"}</strong>
              </p>
              <p>
                Deadline: {new Date(currentOrUpcomingGrandPrix.deadline).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ) : (
            <div className="league-list-empty">
              <p>No upcoming Grand Prix yet.</p>
              <p>Check back soon once the race calendar is updated.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

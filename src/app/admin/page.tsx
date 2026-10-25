import Link from "next/link";
import { redirect } from "next/navigation";

import { formatUtcIsoInAmsterdam } from "@/lib/datetime";
import { getGrandPrixStatusLabel, resolveGrandPrixWorkflowStatus, type GrandPrixStatus } from "@/lib/grand-prix-status";
import { createServerSupabaseClient } from "@/lib/supabase";

type AdminPageProps = {
  searchParams: {
    message?: string;
    error?: string;
  };
};

type GrandPrixRow = {
  id: string;
  name: string;
  status: GrandPrixStatus;
  qualification_start: string;
  deadline: string;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string | null }>();

  if (profile?.role !== "admin") {
    return (
      <main className="dashboard-page">
        <section className="dashboard-card">
          <h1>Admin dashboard</h1>
          <p>Je hebt geen toegang tot deze pagina.</p>
        </section>
      </main>
    );
  }

  const { data: grandPrixRows } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline")
    .order("qualification_start", { ascending: true })
    .returns<GrandPrixRow[]>();

  const isHistorical = (gp: GrandPrixRow) => gp.status === "finished" || gp.status === "cancelled";
  const groups = [
    { title: "Actieve en aankomende Grand Prix’s", rows: (grandPrixRows ?? []).filter(gp => !isHistorical(gp)) },
    { title: "Afgeronde en geannuleerde Grand Prix’s", rows: (grandPrixRows ?? []).filter(isHistorical).sort((a, b) => Date.parse(b.qualification_start) - Date.parse(a.qualification_start)) },
  ];

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <h1>Admin dashboard</h1>
        <p>Beheer elke Grand Prix via één centrale Beheer GP-flow.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}
        {searchParams.message ? <p className="form-message success">{searchParams.message}</p> : null}

        {groups.map(group => (
          <section className="predictions-section" key={group.title}>
            <h2>{group.title}</h2>
            {group.rows.length === 0 ? <p className="league-list-empty">Geen Grand Prix’s in deze categorie.</p> : null}
            <ul className="league-list" aria-label={group.title}>
              {group.rows.map((grandPrix) => {
                const workflowStatus = resolveGrandPrixWorkflowStatus({
                  status: grandPrix.status,
                  deadline: grandPrix.deadline,
                });

                return (
                  <li key={grandPrix.id} className="league-list-item">
                    <div>
                      <h2>{grandPrix.name}</h2>
                      <p>
                        Status: {getGrandPrixStatusLabel(workflowStatus)}
                        {workflowStatus === "cancelled" ? <span className="gp-status-badge">Geannuleerd</span> : null}
                      </p>
                      <p>Kwalificatie start: {formatUtcIsoInAmsterdam(grandPrix.qualification_start)}</p>
                      <p>Deadline: {formatUtcIsoInAmsterdam(grandPrix.deadline)}</p>
                    </div>
                    <div className="admin-action-stack">
                      <Link href={`/admin/grand-prix/${grandPrix.id}`}>Beheer GP</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </section>
    </main>
  );
}

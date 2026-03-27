import Link from "next/link";
import { redirect } from "next/navigation";

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
  status: string;
  qualification_start: string;
  deadline: string;
};

function formatDateTime(dateValue: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

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

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <h1>Admin dashboard</h1>
        <p>Beheer elke Grand Prix via één centrale "Beheer GP"-flow.</p>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}
        {searchParams.message ? <p className="form-message success">{searchParams.message}</p> : null}

        <ul className="league-list" aria-label="Grand Prix lijst">
          {(grandPrixRows ?? []).map((grandPrix) => (
            <li key={grandPrix.id} className="league-list-item">
              <div>
                <h2>{grandPrix.name}</h2>
                <p>Status: {grandPrix.status}</p>
                <p>Kwalificatie start: {formatDateTime(grandPrix.qualification_start)}</p>
                <p>Deadline: {formatDateTime(grandPrix.deadline)}</p>
              </div>
              <div className="admin-action-stack">
                <Link href={`/admin/grand-prix/${grandPrix.id}`}>Beheer GP</Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

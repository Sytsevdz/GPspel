import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { calculateGrandPrixScores } from "@/app/actions/grand-prix-scores";
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

  async function recalculateScores(formData: FormData) {
    "use server";

    const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

    if (!grandPrixId) {
      redirect("/admin?error=Ongeldige+Grand+Prix");
    }

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
      redirect("/admin?error=Je+hebt+geen+toegang+tot+deze+pagina.");
    }

    await calculateGrandPrixScores(grandPrixId);
    revalidatePath("/admin");
    redirect("/admin?message=Scores+zijn+berekend");
  }

  const { data: grandPrixRows } = await supabase
    .from("grand_prix")
    .select("id, name, status, qualification_start, deadline")
    .order("qualification_start", { ascending: false })
    .returns<GrandPrixRow[]>();

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <h1>Admin dashboard</h1>
        <p>Beheer hier de Grand Prix invoer en berekeningen.</p>

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
              <div className="home-actions">
                <Link href={`/admin/grand-prix/${grandPrix.id}/result`}>Uitslag invoeren</Link>
                <Link href={`/admin/grand-prix/${grandPrix.id}/deadline`}>Deadline aanpassen</Link>
                <form action={recalculateScores}>
                  <input type="hidden" name="grand_prix_id" value={grandPrix.id} />
                  <button type="submit">Scores berekenen</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

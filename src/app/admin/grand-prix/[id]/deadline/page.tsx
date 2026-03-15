import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

import { DeadlineForm } from "./deadline-form";

type DeadlinePageProps = {
  params: {
    id: string;
  };
};

type GrandPrixDeadlineRow = {
  id: string;
  name: string;
  deadline: string;
  qualification_start: string;
};

function toDateTimeLocalValue(dateValue: string) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function GrandPrixDeadlinePage({ params }: DeadlinePageProps) {
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
      <main className="leagues-page">
        <section className="leagues-card">
          <h1>Geen toegang</h1>
          <p>Je hebt geen toegang tot deze pagina.</p>
          <Link href="/admin" className="league-back-link">
            ← Terug naar admin dashboard
          </Link>
        </section>
      </main>
    );
  }

  const { data: grandPrix } = await supabase
    .from("grand_prix")
    .select("id, name, deadline, qualification_start")
    .eq("id", params.id)
    .maybeSingle<GrandPrixDeadlineRow>();

  if (!grandPrix) {
    return (
      <main className="leagues-page">
        <section className="leagues-card">
          <h1>Deadline aanpassen</h1>
          <p>Grand Prix niet gevonden.</p>
          <Link href="/admin" className="league-back-link">
            ← Terug naar admin dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <div className="league-detail-header">
          <div>
            <h1>Deadline aanpassen</h1>
            <p>
              Grand Prix: <strong>{grandPrix.name}</strong>
            </p>
          </div>
          <Link href="/admin" className="league-back-link">
            ← Terug naar admin dashboard
          </Link>
        </div>

        <DeadlineForm
          grandPrixId={grandPrix.id}
          initialDeadline={toDateTimeLocalValue(grandPrix.deadline)}
          initialQualificationStart={toDateTimeLocalValue(grandPrix.qualification_start)}
        />
      </section>
    </main>
  );
}

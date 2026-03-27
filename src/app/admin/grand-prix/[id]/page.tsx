import Link from "next/link";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";

import { generateGrandPrixPricesFromPreviousResult, resetDriverPrices } from "@/app/actions/driver-prices";
import { resetGrandPrixResult } from "@/app/actions/grand-prix-results";
import { ConfirmSubmitButton } from "@/app/admin/confirm-submit-button";
import { ResetPricesSubmitButton } from "@/app/admin/reset-prices-submit-button";
import { PublishScoreActions } from "@/app/admin/grand-prix/[id]/result/publish-score-actions";
import { DeadlineForm } from "@/app/admin/grand-prix/[id]/deadline/deadline-form";
import { createServerSupabaseClient } from "@/lib/supabase";

type GrandPrixManagementPageProps = {
  params: {
    id: string;
  };
  searchParams: {
    message?: string;
    error?: string;
  };
};

type GrandPrixRow = {
  id: string;
  name: string;
  status: string;
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

function formatDateTime(dateValue: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

export default async function GrandPrixManagementPage({ params, searchParams }: GrandPrixManagementPageProps) {
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

  const { data: grandPrix } = await supabase
    .from("grand_prix")
    .select("id, name, status, deadline, qualification_start")
    .eq("id", params.id)
    .maybeSingle<GrandPrixRow>();

  if (!grandPrix) {
    return (
      <main className="leagues-page">
        <section className="leagues-card">
          <h1>Beheer GP</h1>
          <p>Grand Prix niet gevonden.</p>
          <Link href="/admin" className="league-back-link">
            ← Terug naar admin dashboard
          </Link>
        </section>
      </main>
    );
  }

  async function recalculatePrices(formData: FormData) {
    "use server";

    const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

    if (!grandPrixId) {
      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+berekenen+van+de+prijzen`);
    }

    try {
      await generateGrandPrixPricesFromPreviousResult(grandPrixId);
      redirect(`/admin/grand-prix/${params.id}?message=Prijzen+succesvol+berekend`);
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      const message =
        error instanceof Error && error.message
          ? error.message
          : "Er ging iets mis bij het berekenen van de prijzen";

      redirect(`/admin/grand-prix/${params.id}?error=${encodeURIComponent(message)}`);
    }
  }

  async function clearPrices(formData: FormData) {
    "use server";

    const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

    if (!grandPrixId) {
      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+resetten+van+de+prijzen`);
    }

    try {
      await resetDriverPrices(grandPrixId);
      redirect(`/admin/grand-prix/${params.id}?message=Prijzen+succesvol+gereset`);
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+resetten+van+de+prijzen`);
    }
  }

  async function clearResult(formData: FormData) {
    "use server";

    const state = await resetGrandPrixResult(undefined, formData);
    if (state.status === "success") {
      redirect(`/admin/grand-prix/${params.id}?message=${encodeURIComponent(state.message ?? "Uitslag gereset")}`);
    }

    redirect(`/admin/grand-prix/${params.id}?error=${encodeURIComponent(state.message ?? "Er ging iets mis bij het resetten")}`);
  }

  return (
    <main className="leagues-page">
      <section className="leagues-card league-detail-card">
        <div className="league-detail-header">
          <div>
            <h1>Beheer GP</h1>
            <p>
              <strong>{grandPrix.name}</strong>
            </p>
            <p>Status: {grandPrix.status}</p>
            <p>Deadline: {formatDateTime(grandPrix.deadline)}</p>
          </div>
          <Link href="/admin" className="league-back-link">
            ← Terug naar admin dashboard
          </Link>
        </div>

        {searchParams.error ? <p className="form-message error">{searchParams.error}</p> : null}
        {searchParams.message ? <p className="form-message success">{searchParams.message}</p> : null}

        <section className="predictions-section">
          <h2>A. Instellingen</h2>
          <p>Pas de timing voor deze Grand Prix aan.</p>
          <DeadlineForm
            grandPrixId={grandPrix.id}
            initialDeadline={toDateTimeLocalValue(grandPrix.deadline)}
            initialQualificationStart={toDateTimeLocalValue(grandPrix.qualification_start)}
          />
        </section>

        <section className="predictions-section">
          <h2>B. Resultaten</h2>
          <p>Voer de uitslag in en beheer alleen de resultaatdata van deze GP.</p>
          <div className="admin-action-stack">
            <Link href={`/admin/grand-prix/${grandPrix.id}/result`}>Uitslag invoeren</Link>
            <form action={clearResult}>
              <input type="hidden" name="grand_prix_id" value={grandPrix.id} />
              <ConfirmSubmitButton
                confirmMessage="Weet je zeker dat je de opgeslagen uitslag voor deze Grand Prix wilt verwijderen?"
                label="Uitslag resetten"
              />
            </form>
          </div>
        </section>

        <PublishScoreActions grandPrixId={grandPrix.id} />

        <section className="predictions-section">
          <h2>D. Coureurs / prijzen</h2>
          <p>Bereken of reset coureursprijzen voor deze GP.</p>
          <div className="admin-action-stack">
            <form action={recalculatePrices}>
              <input type="hidden" name="grand_prix_id" value={grandPrix.id} />
              <button type="submit">Prijzen berekenen voor coureurs</button>
            </form>

            <form action={clearPrices}>
              <input type="hidden" name="grand_prix_id" value={grandPrix.id} />
              <ResetPricesSubmitButton />
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}

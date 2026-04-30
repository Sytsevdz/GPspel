import Link from "next/link";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";

import { generateGrandPrixPricesFromPreviousResult, resetDriverPrices } from "@/app/actions/driver-prices";
import { resetGrandPrixResult } from "@/app/actions/grand-prix-results";
import { ConfirmSubmitButton } from "@/app/admin/confirm-submit-button";
import { ConfirmReactivateSubmitButton } from "@/app/admin/confirm-reactivate-submit-button";
import { ResetPricesSubmitButton } from "@/app/admin/reset-prices-submit-button";
import { PublishScoreActions } from "@/app/admin/grand-prix/[id]/result/publish-score-actions";
import { DeadlineForm } from "@/app/admin/grand-prix/[id]/deadline/deadline-form";
import { formatUtcIsoInAmsterdam, toAmsterdamDateTimeLocalValue } from "@/lib/datetime";
import {
  getGrandPrixStatusLabel,
  isGrandPrixCancelled,
  resolveGrandPrixWorkflowStatus,
  type GrandPrixStatus,
} from "@/lib/grand-prix-status";
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
  status: GrandPrixStatus;
  is_sprint_weekend: boolean;
  deadline: string;
  qualification_start: string;
};

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
    .select("id, name, status, is_sprint_weekend, deadline, qualification_start")
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

  const managedGrandPrix = grandPrix;

  async function recalculatePrices(formData: FormData) {
    "use server";

    const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

    if (!grandPrixId) {
      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+berekenen+van+de+prijzen`);
    }
    if (isGrandPrixCancelled(managedGrandPrix.status)) {
      redirect(`/admin/grand-prix/${params.id}?error=Deze+Grand+Prix+is+geannuleerd.+Prijzen+kunnen+niet+worden+berekend`);
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
    if (isGrandPrixCancelled(managedGrandPrix.status)) {
      redirect(`/admin/grand-prix/${params.id}?error=Deze+Grand+Prix+is+geannuleerd.+Prijzen+kunnen+niet+worden+beheerd`);
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

    if (isGrandPrixCancelled(managedGrandPrix.status)) {
      redirect(`/admin/grand-prix/${params.id}?error=Deze+Grand+Prix+is+geannuleerd.+Resultaten+kunnen+niet+worden+gewijzigd`);
    }

    const state = await resetGrandPrixResult(undefined, formData);
    if (state.status === "success") {
      redirect(`/admin/grand-prix/${params.id}?message=${encodeURIComponent(state.message ?? "Uitslag gereset")}`);
    }

    redirect(`/admin/grand-prix/${params.id}?error=${encodeURIComponent(state.message ?? "Er ging iets mis bij het resetten")}`);
  }

  async function reactivateGrandPrix(formData: FormData) {
    "use server";

    const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

    if (!grandPrixId) {
      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+activeren+van+deze+Grand+Prix`);
    }

    if (!isGrandPrixCancelled(managedGrandPrix.status)) {
      redirect(`/admin/grand-prix/${params.id}?error=Deze+Grand+Prix+is+niet+geannuleerd`);
    }

    const actionSupabase = createServerSupabaseClient();
    const {
      data: { user: actionUser },
      error: actionUserError,
    } = await actionSupabase.auth.getUser();

    if (actionUserError || !actionUser) {
      redirect(`/admin/grand-prix/${params.id}?error=Je+hebt+geen+toegang+tot+deze+actie`);
    }

    const { data: actionProfile } = await actionSupabase
      .from("profiles")
      .select("role")
      .eq("id", actionUser.id)
      .maybeSingle<{ role: string | null }>();

    if (actionProfile?.role !== "admin") {
      redirect(`/admin/grand-prix/${params.id}?error=Je+hebt+geen+toegang+tot+deze+actie`);
    }

    const reactivatedStatus =
      managedGrandPrix.status === "finished"
        ? "finished"
        : resolveGrandPrixWorkflowStatus({
            status: "upcoming",
            deadline: managedGrandPrix.deadline,
          });
    const { error } = await actionSupabase.from("grand_prix").update({ status: reactivatedStatus }).eq("id", grandPrixId);

    if (error) {
      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+activeren+van+deze+Grand+Prix`);
    }

    redirect(`/admin/grand-prix/${params.id}?message=Grand+Prix+weer+actief+gemaakt`);
  }

  async function cancelGrandPrix(formData: FormData) {
    "use server";

    const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

    if (!grandPrixId) {
      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+annuleren+van+deze+Grand+Prix`);
    }

    if (isGrandPrixCancelled(managedGrandPrix.status)) {
      redirect(`/admin/grand-prix/${params.id}?error=Deze+Grand+Prix+is+al+geannuleerd`);
    }

    const actionSupabase = createServerSupabaseClient();
    const {
      data: { user: actionUser },
      error: actionUserError,
    } = await actionSupabase.auth.getUser();

    if (actionUserError || !actionUser) {
      redirect(`/admin/grand-prix/${params.id}?error=Je+hebt+geen+toegang+tot+deze+actie`);
    }

    const { data: actionProfile } = await actionSupabase
      .from("profiles")
      .select("role")
      .eq("id", actionUser.id)
      .maybeSingle<{ role: string | null }>();

    if (actionProfile?.role !== "admin") {
      redirect(`/admin/grand-prix/${params.id}?error=Je+hebt+geen+toegang+tot+deze+actie`);
    }

    const { error } = await actionSupabase.from("grand_prix").update({ status: "cancelled" }).eq("id", grandPrixId);

    if (error) {
      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+annuleren+van+deze+Grand+Prix`);
    }

    redirect(`/admin/grand-prix/${params.id}?message=Grand+Prix+geannuleerd`);
  }

  async function updateSprintWeekend(formData: FormData) {
    "use server";
    const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();
    const isSprintWeekend = String(formData.get("is_sprint_weekend") ?? "").trim() === "true";
    if (!grandPrixId) {
      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+bijwerken+van+het+weekendtype`);
    }
    const actionSupabase = createServerSupabaseClient();
    const { data: { user: actionUser }, error: actionUserError } = await actionSupabase.auth.getUser();
    if (actionUserError || !actionUser) {
      redirect(`/admin/grand-prix/${params.id}?error=Je+hebt+geen+toegang+tot+deze+actie`);
    }
    const { data: actionProfile } = await actionSupabase.from("profiles").select("role").eq("id", actionUser.id).maybeSingle<{ role: string | null }>();
    if (actionProfile?.role !== "admin") {
      redirect(`/admin/grand-prix/${params.id}?error=Je+hebt+geen+toegang+tot+deze+actie`);
    }
    const { error } = await actionSupabase.from("grand_prix").update({ is_sprint_weekend: isSprintWeekend }).eq("id", grandPrixId);
    if (error) {
      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+bijwerken+van+het+weekendtype`);
    }
    redirect(`/admin/grand-prix/${params.id}?message=Weekendtype+bijgewerkt`);
  }

  const workflowStatus = resolveGrandPrixWorkflowStatus({
    status: managedGrandPrix.status,
    deadline: managedGrandPrix.deadline,
  });
  const isCancelled = isGrandPrixCancelled(workflowStatus);

  return (
    <main className="leagues-page">
      <section className="leagues-card league-detail-card">
        <div className="league-detail-header">
          <div>
            <h1>Beheer GP</h1>
            <p>
              <strong>{managedGrandPrix.name}</strong>
            </p>
            <p>
              Status: {getGrandPrixStatusLabel(workflowStatus)}
              {isCancelled ? <span className="gp-status-badge">Geannuleerd</span> : null}
            </p>
            <p>Deadline: {formatUtcIsoInAmsterdam(managedGrandPrix.deadline)}</p>
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
            grandPrixId={managedGrandPrix.id}
            initialDeadline={toAmsterdamDateTimeLocalValue(managedGrandPrix.deadline)}
            initialQualificationStart={toAmsterdamDateTimeLocalValue(managedGrandPrix.qualification_start)}
          />
          <form action={updateSprintWeekend}>
            <input type="hidden" name="grand_prix_id" value={managedGrandPrix.id} />
            <label className="predictions-field">
              <span>Weekendtype</span>
              <select name="is_sprint_weekend" defaultValue={managedGrandPrix.is_sprint_weekend ? "true" : "false"}>
                <option value="false">Normaal weekend</option>
                <option value="true">Sprint weekend</option>
              </select>
            </label>
            <button type="submit">Weekendtype opslaan</button>
          </form>
          <div className="admin-action-stack">
            {isCancelled ? (
              <form action={reactivateGrandPrix}>
                <input type="hidden" name="grand_prix_id" value={managedGrandPrix.id} />
                <ConfirmReactivateSubmitButton
                  confirmMessage="Weet je zeker dat je deze Grand Prix weer actief wilt maken?"
                  label="Annulering opheffen"
                  pendingLabel="Activeren..."
                  confirmLabel="Activeren"
                  cancelLabel="Annuleren"
                />
              </form>
            ) : (
              <form action={cancelGrandPrix}>
                <input type="hidden" name="grand_prix_id" value={managedGrandPrix.id} />
                <ConfirmSubmitButton
                  confirmMessage="Weet je zeker dat je deze Grand Prix wilt annuleren?"
                  label="Grand Prix annuleren"
                  pendingLabel="Annuleren..."
                />
              </form>
            )}
          </div>
        </section>

        <section className="predictions-section">
          <h2>B. Resultaten</h2>
          <p>Voer de uitslag in en beheer alleen de resultaatdata van deze GP.</p>
          {isCancelled ? <p className="league-list-empty">Deze GP is geannuleerd. Resultaatbeheer is uitgeschakeld.</p> : null}
          <div className="admin-action-stack">
            {!isCancelled ? (
              <>
                <Link href={`/admin/grand-prix/${managedGrandPrix.id}/result`}>Uitslag invoeren</Link>
                <form action={clearResult}>
                  <input type="hidden" name="grand_prix_id" value={managedGrandPrix.id} />
                  <ConfirmSubmitButton
                    confirmMessage="Weet je zeker dat je de opgeslagen uitslag voor deze Grand Prix wilt verwijderen?"
                    label="Uitslag resetten"
                  />
                </form>
              </>
            ) : null}
          </div>
        </section>

        <PublishScoreActions grandPrixId={managedGrandPrix.id} disabled={isCancelled} />

        <section className="predictions-section">
          <h2>D. Coureurs / prijzen</h2>
          <p>Bereken of reset coureursprijzen voor deze GP.</p>
          {isCancelled ? <p className="league-list-empty">Deze GP is geannuleerd. Prijsbeheer is uitgeschakeld.</p> : null}
          <div className="admin-action-stack">
            {!isCancelled ? (
              <>
                <form action={recalculatePrices}>
                  <input type="hidden" name="grand_prix_id" value={managedGrandPrix.id} />
                  <button type="submit">Prijzen berekenen voor coureurs</button>
                </form>

                <form action={clearPrices}>
                  <input type="hidden" name="grand_prix_id" value={managedGrandPrix.id} />
                  <ResetPricesSubmitButton />
                </form>
              </>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

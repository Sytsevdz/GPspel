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
import { LeagueParticipationFilter } from "@/app/admin/grand-prix/[id]/league-participation-filter";
import { formatUtcIsoInAmsterdam, toAmsterdamDateTimeLocalValue } from "@/lib/datetime";
import { buildGrandPrixParticipationOverview } from "@/lib/admin-grand-prix-participation";
import {
  getGrandPrixStatusLabel,
  isGrandPrixCancelled,
  resolveGrandPrixWorkflowStatus,
  type GrandPrixStatus,
} from "@/lib/grand-prix-status";
import { createServerSupabaseClient } from "@/lib/supabase";
import { isSupportedBonusQuestionType, type BonusQuestion } from "@/lib/bonus-predictions";
import { BonusQuestionForm } from "./bonus-question-form";
import { getGrandPrixDrivers } from "@/lib/grand-prix-drivers";
import { GrandPrixDriverParticipantsEditor } from "@/components/admin/grand-prix-driver-participants-editor";

type GrandPrixManagementPageProps = {
  params: {
    id: string;
  };
  searchParams: {
    message?: string;
    error?: string;
    league?: string;
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
  const nowIso = new Date().toISOString();
  const isAfterDeadline = managedGrandPrix.deadline <= nowIso;

  async function recalculatePrices(formData: FormData) {
    "use server";

    const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();

    if (!grandPrixId) {
      redirect(`/admin/grand-prix/${params.id}?error=Er+ging+iets+mis+bij+het+berekenen+van+de+prijzen`);
    }
    if (isGrandPrixCancelled(managedGrandPrix.status)) {
      redirect(`/admin/grand-prix/${params.id}?error=Deze+Grand+Prix+is+geannuleerd.+Prijzen+kunnen+niet+worden+berekend`);
    }
    if (managedGrandPrix.deadline <= new Date().toISOString()) {
      redirect(`/admin/grand-prix/${params.id}?error=De+deadline+is+verstreken.+Prijzen+niet+meer+herberekenen`);
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
    if (managedGrandPrix.deadline <= new Date().toISOString()) {
      redirect(`/admin/grand-prix/${params.id}?error=De+deadline+is+verstreken.+Prijzen+niet+meer+resetten`);
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

  async function saveBonusQuestion(formData: FormData) {
    "use server";

    const grandPrixId = String(formData.get("grand_prix_id") ?? "").trim();
    const questionType = String(formData.get("question_type") ?? "").trim();
    const subjectDriverId = String(formData.get("subject_driver_id") ?? "").trim();
    const points = Number(String(formData.get("points") ?? "").trim());

    if (
      !grandPrixId ||
      !isSupportedBonusQuestionType(questionType) ||
      (questionType === "driver_finish_position" && !subjectDriverId) ||
      !Number.isInteger(points) ||
      points < 1
    ) {
      redirect(`/admin/grand-prix/${params.id}?error=Vul+een+geldige+bonusvraag+in`);
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

    const { error } = await actionSupabase.from("grand_prix_bonus_questions").upsert(
      {
        grand_prix_id: grandPrixId,
        question_type: questionType,
        subject_driver_id: questionType === "driver_finish_position" ? subjectDriverId : null,
        points,
      },
      { onConflict: "grand_prix_id" },
    );

    if (error) {
      redirect(`/admin/grand-prix/${params.id}?error=Bonusvraag+opslaan+mislukt`);
    }

    redirect(`/admin/grand-prix/${params.id}?message=Bonusvraag+opgeslagen`);
  }

  async function saveDriverEntries(formData: FormData) {
    "use server";
    const actionSupabase = createServerSupabaseClient();
    const { data: { user: actionUser } } = await actionSupabase.auth.getUser();
    const { data: actionProfile } = actionUser ? await actionSupabase.from("profiles").select("role").eq("id", actionUser.id).maybeSingle<{ role: string | null }>() : { data: null };
    if (actionProfile?.role !== "admin") redirect(`/admin/grand-prix/${params.id}?error=Geen+toegang`);

    const intent = String(formData.get("intent") ?? "save");
    if (intent === "clear") {
      const { error } = await actionSupabase.rpc("replace_grand_prix_driver_entries", { target_grand_prix_id: managedGrandPrix.id, participants: [] });
      if (error) {
        console.error("[saveDriverEntries] Failed to clear GP participants", {
          grandPrixId: managedGrandPrix.id,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        redirect(`/admin/grand-prix/${params.id}?error=GP-deelnemers+opslaan+mislukt`);
      }
      redirect(`/admin/grand-prix/${params.id}?message=Automatische+standaarddeelnemers+hersteld`);
    }
    const constructorTeams = formData
      .getAll("constructor_team")
      .map((constructorTeam) => String(constructorTeam).trim())
      .filter(Boolean);
    const participants = constructorTeams.flatMap((constructorTeam) => [1, 2].map((slot) => {
      const fieldName = `driver_${constructorTeam}_${slot}`;
      return {
        grand_prix_id: managedGrandPrix.id,
        constructor_team: constructorTeam,
        driver_id: String(formData.get(fieldName) ?? "").trim(),
        slot,
        field_name: fieldName,
      };
    }));
    const emptyParticipants = participants.filter(
      (participant) => !participant.driver_id,
    );
    if (emptyParticipants.length > 0) {
      const submittedDriverFields = Array.from(formData.entries())
        .filter(([fieldName]) => fieldName.startsWith("driver_"))
        .map(([fieldName, value]) => ({
          fieldName,
          value: typeof value === "string" ? value : `[File: ${value.name}]`,
        }));
      console.error("[saveDriverEntries] Empty GP participant slots", {
        grandPrixId: managedGrandPrix.id,
        constructorTeams,
        emptyParticipants,
        submittedDriverFields,
      });
      const emptyFieldNames = emptyParticipants
        .map((participant) => participant.field_name)
        .join(", ");
      redirect(`/admin/grand-prix/${params.id}?error=${encodeURIComponent(`Kies voor ieder team twee coureurs. Ontbrekende velden: ${emptyFieldNames}`)}`);
    }
    const driverIds = participants.map((participant) => participant.driver_id);
    if (new Set(driverIds).size !== driverIds.length) {
      const duplicateDriverId = driverIds.find((driverId, index) => driverIds.indexOf(driverId) !== index);
      const { data: duplicateDriver } = await actionSupabase.from("drivers").select("name").eq("id", duplicateDriverId ?? "").maybeSingle<{ name: string }>();
      const message = duplicateDriver?.name
        ? `${duplicateDriver.name} is meerdere keren geselecteerd.`
        : "Een coureur is meerdere keren geselecteerd.";
      redirect(`/admin/grand-prix/${params.id}?error=${encodeURIComponent(message)}`);
    }
    const rpcParticipants = participants.map((participant) => ({
      constructor_team: participant.constructor_team,
      driver_id: participant.driver_id,
    }));
    const { error: insertError } = await actionSupabase.rpc("replace_grand_prix_driver_entries", {
      target_grand_prix_id: managedGrandPrix.id,
      participants: rpcParticipants,
    });
    if (insertError) {
      console.error("[saveDriverEntries] Failed to replace GP participants", {
        grandPrixId: managedGrandPrix.id,
        participantCount: rpcParticipants.length,
        constructorTeams,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
      });
      redirect(`/admin/grand-prix/${params.id}?error=GP-deelnemers+opslaan+mislukt`);
    }
    redirect(`/admin/grand-prix/${params.id}?message=GP-deelnemers+opgeslagen`);
  }

  const workflowStatus = resolveGrandPrixWorkflowStatus({
    status: managedGrandPrix.status,
    deadline: managedGrandPrix.deadline,
  });
  const isCancelled = isGrandPrixCancelled(workflowStatus);

  const effectiveDrivers = await getGrandPrixDrivers(managedGrandPrix.id);
  const constructorTeams = Array.from(new Set(effectiveDrivers.map((driver) => driver.constructor_team))).sort();
  const { data: allDrivers } = await supabase.from("drivers").select("id, name").order("name").returns<Array<{ id: string; name: string }>>();
  const [
    { data: profiles },
    { data: leagues },
    { data: leagueMemberships },
    { data: teamSelections },
    { data: predictions },
    { data: driverPrices },
    { data: bonusQuestion },
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name, role").returns<Array<{ id: string; display_name: string | null; role: string | null }>>(),
    supabase.from("leagues").select("id, name").order("name", { ascending: true }).returns<Array<{ id: string; name: string }>>(),
    supabase.from("league_members").select("league_id, user_id").returns<Array<{ league_id: string; user_id: string }>>(),
    supabase
      .from("team_selections")
      .select("user_id, team_selection_drivers(driver_id)")
      .eq("grand_prix_id", managedGrandPrix.id)
      .returns<Array<{ user_id: string; team_selection_drivers: Array<{ driver_id: string }> | null }>>(),
    supabase
      .from("predictions")
      .select(
        "user_id, sprint_quali_p1, sprint_quali_p2, sprint_quali_p3, sprint_race_p1, sprint_race_p2, sprint_race_p3, quali_p1, quali_p2, quali_p3, race_p1, race_p2, race_p3",
      )
      .eq("grand_prix_id", managedGrandPrix.id)
      .returns<
        Array<{
          user_id: string;
          sprint_quali_p1: string | null;
          sprint_quali_p2: string | null;
          sprint_quali_p3: string | null;
          sprint_race_p1: string | null;
          sprint_race_p2: string | null;
          sprint_race_p3: string | null;
          quali_p1: string | null;
          quali_p2: string | null;
          quali_p3: string | null;
          race_p1: string | null;
          race_p2: string | null;
          race_p3: string | null;
        }>
      >(),
    supabase
      .from("driver_prices")
      .select("driver_id, price")
      .eq("grand_prix_id", managedGrandPrix.id)
      .returns<Array<{ driver_id: string; price: number }>>(),
    supabase
      .from("grand_prix_bonus_questions")
      .select("id, grand_prix_id, question_type, subject_driver_id, points")
      .eq("grand_prix_id", managedGrandPrix.id)
      .maybeSingle<BonusQuestion>(),
  ]);

  const selectedLeagueId = typeof searchParams.league === "string" ? searchParams.league : "all";
  const availableLeagues = leagues ?? [];
  const selectedLeagueExists = selectedLeagueId === "all" || availableLeagues.some((league) => league.id === selectedLeagueId);
  const effectiveSelectedLeagueId = selectedLeagueExists ? selectedLeagueId : "all";

  const filteredUserIds =
    effectiveSelectedLeagueId === "all"
      ? undefined
      : (leagueMemberships ?? [])
          .filter((membership) => membership.league_id === effectiveSelectedLeagueId)
          .map((membership) => membership.user_id);

  const driverPricesById = new Map((driverPrices ?? []).map((driverPrice) => [driverPrice.driver_id, driverPrice.price]));

  const participationOverview = buildGrandPrixParticipationOverview({
    profiles: profiles ?? [],
    teamSelections: teamSelections ?? [],
    predictions: predictions ?? [],
    isSprintWeekend: managedGrandPrix.is_sprint_weekend,
    includedUserIds: filteredUserIds,
    driverPricesById,
  });

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
          <h2>B. Bonusvraag</h2>
          <p>Configureer één bonusvraag voor deze Grand Prix.</p>
          <BonusQuestionForm
            action={saveBonusQuestion}
            grandPrixId={managedGrandPrix.id}
            initialType={bonusQuestion?.question_type ?? "driver_finish_position"}
            initialDriverId={bonusQuestion?.subject_driver_id ?? ""}
            initialPoints={bonusQuestion?.points ?? 10}
            drivers={effectiveDrivers.map(({ id, name }) => ({ id, name }))}
          />
        </section>

        <section className="predictions-section">
          <h2>GP-deelnemers</h2>
          <p>Kies voor iedere constructor de twee coureurs die deze Grand Prix rijden.</p>
          <GrandPrixDriverParticipantsEditor
            action={saveDriverEntries}
            assignments={constructorTeams.map((constructorTeam) => ({
              constructorTeam,
              driverIds: effectiveDrivers
                .filter((driver) => driver.constructor_team === constructorTeam)
                .map((driver) => driver.id)
                .slice(0, 2)
                .concat(["", ""])
                .slice(0, 2) as [string, string],
            }))}
            drivers={allDrivers ?? []}
          />
        </section>

        <section className="predictions-section">
          <h2>C. Resultaten</h2>
          <p>Voer de uitslag in en beheer alleen de resultaatdata van deze GP.</p>
          {isCancelled ? <p className="league-list-empty">Deze GP is geannuleerd. Resultaatbeheer is uitgeschakeld.</p> : null}
          <div className="admin-action-stack">
            {!isCancelled ? (
              <>
                <Link href={`/admin/grand-prix/${managedGrandPrix.id}/result`}>Uitslag invoeren</Link>
                <form action={clearResult}>
                  <input type="hidden" name="grand_prix_id" value={managedGrandPrix.id} />
                  <input type="hidden" name="expected_grand_prix_id" value={managedGrandPrix.id} />
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
          <h2>D. Deelname-overzicht</h2>
          <LeagueParticipationFilter selectedLeagueId={effectiveSelectedLeagueId} leagues={availableLeagues} />
          <p>
            Inzendingen per speler (zonder team- of voorspellingdetails).
            Teams: {participationOverview.submittedTeamsCount}/{participationOverview.totalPlayers} · Voorspellingen: {" "}
            {participationOverview.submittedPredictionsCount}/{participationOverview.totalPlayers}
          </p>
          <div className="standings-table-wrapper admin-participation-table-wrapper">
            <table className="standings-table admin-participation-table">
              <thead>
                <tr>
                  <th>Speler</th>
                  <th>Status team</th>
                  <th>Status voorspelling</th>
                </tr>
              </thead>
              <tbody>
                {participationOverview.rows.map((row) => (
                  <tr key={row.userId}>
                    <td className="standings-name-cell">{row.displayName}</td>
                    <td>
                      {row.teamStatus === "valid"
                        ? "✅ Team gekozen en geldig"
                        : row.teamStatus === "over_budget"
                          ? "⚠️ Team gekozen maar boven budget"
                          : "❌ Geen team"}
                    </td>
                    <td>{row.hasPrediction ? "✅ Voorspelling ingevuld" : "❌ Geen voorspelling"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="predictions-section">
          <h2>E. Coureurs / prijzen</h2>
          <p>Bereken of reset coureursprijzen voor deze GP. Doe dit alleen vóór de deadline.</p>
          {isCancelled ? <p className="league-list-empty">Deze GP is geannuleerd. Prijsbeheer is uitgeschakeld.</p> : null}
          {!isCancelled && isAfterDeadline ? (
            <p className="league-list-empty">De deadline is verstreken. Herbereken of reset prijzen niet meer na de deadline.</p>
          ) : null}
          <div className="admin-action-stack">
            {!isCancelled && !isAfterDeadline ? (
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

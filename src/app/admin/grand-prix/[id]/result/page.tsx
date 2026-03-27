import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

import { PublishScoreActions } from "./publish-score-actions";
import { ResultForm } from "./result-form";

type GrandPrixResultPageProps = {
  params: {
    id: string;
  };
};

type ExistingResult = {
  driver_id: string;
  quali_position: number;
  race_position: number;
};

export default async function GrandPrixResultPage({ params }: GrandPrixResultPageProps) {
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
    .select("id, name")
    .eq("id", params.id)
    .maybeSingle<{ id: string; name: string }>();

  if (!grandPrix) {
    return (
      <main className="leagues-page">
        <section className="leagues-card">
          <h1>Grand Prix uitslag invoeren</h1>
          <p>Grand Prix niet gevonden.</p>
          <Link href="/admin" className="league-back-link">
            ← Terug naar admin dashboard
          </Link>
        </section>
      </main>
    );
  }

  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, name, constructor_team")
    .eq("active", true)
    .order("name", { ascending: true });

  if (!drivers || drivers.length === 0) {
    return (
      <main className="leagues-page">
        <section className="leagues-card">
          <h1>Grand Prix uitslag invoeren</h1>
          <p>Er zijn niet genoeg actieve coureurs beschikbaar.</p>
          <Link href="/admin" className="league-back-link">
            ← Terug naar admin dashboard
          </Link>
        </section>
      </main>
    );
  }

  const { data: existingResultRows } = await supabase
    .from("grand_prix_driver_results")
    .select("driver_id, quali_position, race_position")
    .eq("grand_prix_id", grandPrix.id)
    .returns<ExistingResult[]>();

  const driverIds = drivers.map((driver) => driver.id);
  const existingRows = existingResultRows ?? [];

  const toOrderedIds = (positionField: "quali_position" | "race_position") => {
    const orderedExistingIds = existingRows
      .filter((row) => Number.isInteger(row[positionField]))
      .sort((a, b) => a[positionField] - b[positionField])
      .map((row) => row.driver_id)
      .filter((driverId) => driverIds.includes(driverId));

    const missingIds = driverIds.filter((driverId) => !orderedExistingIds.includes(driverId));
    return [...orderedExistingIds, ...missingIds];
  };

  const initialValues = {
    qualificationOrder: toOrderedIds("quali_position"),
    raceOrder: toOrderedIds("race_position"),
  };

  return (
    <main className="leagues-page">
      <section className="leagues-card">
        <div className="league-detail-header">
          <div>
            <h1>Grand Prix uitslag invoeren</h1>
            <p>
              Grand Prix: <strong>{grandPrix.name}</strong>
            </p>
          </div>
          <Link href={`/admin/grand-prix/${grandPrix.id}`} className="league-back-link">
            ← Terug naar Beheer GP
          </Link>
        </div>

        <ResultForm
          grandPrixId={grandPrix.id}
          drivers={drivers.map((driver) => ({
            id: driver.id,
            name: driver.name,
            constructorTeam: driver.constructor_team,
          }))}
          initialValues={initialValues}
        />

        <PublishScoreActions grandPrixId={grandPrix.id} />
      </section>
    </main>
  );
}

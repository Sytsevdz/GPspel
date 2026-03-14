import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

import { ResultForm } from "./result-form";

type GrandPrixResultPageProps = {
  params: {
    id: string;
  };
};

type ExistingResult = {
  quali_p1: string;
  quali_p2: string;
  quali_p3: string;
  race_p1: string;
  race_p2: string;
  race_p3: string;
};

export default async function GrandPrixResultPage({ params }: GrandPrixResultPageProps) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
          <Link href="/dashboard" className="league-back-link">
            ← Terug naar dashboard
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

  if (!drivers || drivers.length < 3) {
    return (
      <main className="leagues-page">
        <section className="leagues-card">
          <h1>Grand Prix uitslag invoeren</h1>
          <p>Er zijn niet genoeg actieve coureurs beschikbaar.</p>
          <Link href="/dashboard" className="league-back-link">
            ← Terug naar dashboard
          </Link>
        </section>
      </main>
    );
  }

  const { data: existingResult } = await supabase
    .from("grand_prix_results")
    .select("quali_p1, quali_p2, quali_p3, race_p1, race_p2, race_p3")
    .eq("grand_prix_id", grandPrix.id)
    .maybeSingle<ExistingResult>();

  const fallbackIds = [
    drivers[0]?.id ?? "",
    drivers[1]?.id ?? drivers[0]?.id ?? "",
    drivers[2]?.id ?? drivers[0]?.id ?? "",
  ];

  const initialValues = {
    qualiP1: existingResult?.quali_p1 ?? fallbackIds[0],
    qualiP2: existingResult?.quali_p2 ?? fallbackIds[1],
    qualiP3: existingResult?.quali_p3 ?? fallbackIds[2],
    raceP1: existingResult?.race_p1 ?? fallbackIds[0],
    raceP2: existingResult?.race_p2 ?? fallbackIds[1],
    raceP3: existingResult?.race_p3 ?? fallbackIds[2],
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
          <Link href="/dashboard" className="league-back-link">
            ← Terug naar dashboard
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
      </section>
    </main>
  );
}

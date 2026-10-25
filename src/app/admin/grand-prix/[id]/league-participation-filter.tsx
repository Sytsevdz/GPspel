"use client";

import { useRouter } from "next/navigation";

type LeagueOption = {
  id: string;
  name: string;
};

type LeagueParticipationFilterProps = {
  selectedLeagueId: string;
  leagues: LeagueOption[];
};

export function LeagueParticipationFilter({ selectedLeagueId, leagues }: LeagueParticipationFilterProps) {
  const router = useRouter();
  return (
    <form method="get" className="predictions-form" style={{ marginBottom: "0.75rem" }}>
      <label className="predictions-field" style={{ maxWidth: "22rem" }}>
        <span>Filter op league</span>
        <select name="league" defaultValue={selectedLeagueId} onChange={(event) => {
          const url = new URL(window.location.href);
          url.searchParams.set("league", event.currentTarget.value);
          url.searchParams.delete("message");
          url.searchParams.delete("error");
          router.replace(url.pathname + url.search, { scroll: false });
        }}>
          <option value="all">Alle spelers</option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}

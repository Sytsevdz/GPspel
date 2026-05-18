"use client";

type LeagueOption = {
  id: string;
  name: string;
};

type LeagueParticipationFilterProps = {
  selectedLeagueId: string;
  leagues: LeagueOption[];
};

export function LeagueParticipationFilter({ selectedLeagueId, leagues }: LeagueParticipationFilterProps) {
  return (
    <form method="get" className="predictions-form" style={{ marginBottom: "0.75rem" }}>
      <label className="predictions-field" style={{ maxWidth: "22rem" }}>
        <span>Filter op league</span>
        <select name="league" defaultValue={selectedLeagueId} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
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

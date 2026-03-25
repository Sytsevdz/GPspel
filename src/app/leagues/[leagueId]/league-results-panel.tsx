"use client";

import { PlayerGrandPrixDetail } from "./player-grand-prix-detail";

type LeagueMember = {
  userId: string;
  displayName: string;
};

type LatestGrandPrixStandingEntry = {
  userId: string;
  spelerNaam: string;
  punten: number;
};

type LeagueStandingEntry = {
  userId: string;
  spelerNaam: string;
  totaalPunten: number;
};

type LeagueResultsPanelProps = {
  leagueId: string;
  latestCompletedGrandPrix: {
    id: string;
    name: string;
  } | null;
  members: LeagueMember[];
  latestGrandPrixStandings: LatestGrandPrixStandingEntry[];
  standings: LeagueStandingEntry[];
};

export function LeagueResultsPanel({
  leagueId,
  latestCompletedGrandPrix,
  members,
  latestGrandPrixStandings,
  standings,
}: LeagueResultsPanelProps) {
  return (
    <PlayerGrandPrixDetail
      leagueId={leagueId}
      grandPrixId={latestCompletedGrandPrix?.id ?? ""}
      grandPrixName={latestCompletedGrandPrix?.name ?? "Laatste Grand Prix"}
      deadlinePassed={Boolean(latestCompletedGrandPrix)}
      members={members}
      sectionTitle="League resultaten"
      helperText="Klik op een speler in de tabellen om teamselectie en voorspellingen te bekijken."
      membersRenderer={({ members: leagueMembers, openMemberDetails, deadlinePassed }) => (
        <>
          <section className="league-section">
            <h3>Laatste Grand Prix</h3>
            {latestCompletedGrandPrix ? (
              <>
                <p className="league-member-helper">{latestCompletedGrandPrix.name}</p>
                <div className="standings-table-wrapper">
                  <table className="standings-table" aria-label="Laatste Grand Prix">
                    <thead>
                      <tr>
                        <th scope="col">Positie</th>
                        <th scope="col">Speler</th>
                        <th scope="col">Punten</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestGrandPrixStandings.map((entry, index) => (
                        <tr key={`latest-${entry.userId}`}>
                          <td>{index + 1}</td>
                          <td>
                            <button
                              type="button"
                              className="league-table-player-link"
                              onClick={() => {
                                const member = leagueMembers.find((leagueMember) => leagueMember.userId === entry.userId);
                                if (member) {
                                  openMemberDetails(member);
                                }
                              }}
                              disabled={!deadlinePassed}
                            >
                              {entry.spelerNaam}
                            </button>
                          </td>
                          <td className="standings-score-cell">{entry.punten}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="league-list-empty">Er is nog geen afgeronde Grand Prix met resultaten.</p>
            )}
          </section>

          <section className="league-section">
            <h3>League stand</h3>
            {standings.length > 0 ? (
              <div className="standings-table-wrapper">
                <table className="standings-table" aria-label="League stand">
                  <thead>
                    <tr>
                      <th scope="col">Positie</th>
                      <th scope="col">Speler</th>
                      <th scope="col">Totaal punten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((entry, index) => (
                      <tr key={`total-${entry.userId}`}>
                        <td>{index + 1}</td>
                        <td>
                          <button
                            type="button"
                            className="league-table-player-link"
                            onClick={() => {
                              const member = leagueMembers.find((leagueMember) => leagueMember.userId === entry.userId);
                              if (member) {
                                openMemberDetails(member);
                              }
                            }}
                            disabled={!deadlinePassed}
                          >
                            {entry.spelerNaam}
                          </button>
                        </td>
                        <td className="standings-score-cell">{entry.totaalPunten}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="league-list-empty">Er zijn nog geen punten berekend.</p>
            )}
          </section>
        </>
      )}
    />
  );
}

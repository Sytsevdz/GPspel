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
  const openPlayerDetails = (
    userId: string,
    leagueMembers: LeagueMember[],
    openMemberDetails: (member: LeagueMember) => void,
    canOpenDetails: boolean
  ) => {
    if (!canOpenDetails) {
      return;
    }

    const member = leagueMembers.find((leagueMember) => leagueMember.userId === userId);
    if (member) {
      openMemberDetails(member);
    }
  };

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
          <section className="league-section league-results-section-card">
            <div className="league-results-section-header">
              <h3>Laatste Grand Prix</h3>
              {latestCompletedGrandPrix ? (
                <p className="league-results-section-subtitle">{latestCompletedGrandPrix.name}</p>
              ) : null}
            </div>
            {latestCompletedGrandPrix ? (
              <>
                <div className="standings-table-wrapper">
                  <table className="standings-table" aria-label="Laatste Grand Prix">
                    <thead>
                      <tr>
                        <th scope="col" className="standings-position-column">
                          Positie
                        </th>
                        <th scope="col">Speler</th>
                        <th scope="col" className="standings-score-column">
                          Punten
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestGrandPrixStandings.map((entry, index) => {
                        const position = index + 1;
                        const topRankClass =
                          position === 1
                            ? " standings-row-p1"
                            : position === 2
                              ? " standings-row-p2"
                              : position === 3
                                ? " standings-row-p3"
                                : "";
                        return (
                          <tr
                            key={`latest-${entry.userId}`}
                            className={`standings-row-clickable${topRankClass}`}
                            onClick={() =>
                              openPlayerDetails(entry.userId, leagueMembers, openMemberDetails, deadlinePassed)
                            }
                            role="button"
                            tabIndex={deadlinePassed ? 0 : -1}
                            aria-label={`Bekijk details van ${entry.spelerNaam}`}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openPlayerDetails(entry.userId, leagueMembers, openMemberDetails, deadlinePassed);
                              }
                            }}
                            aria-disabled={!deadlinePassed}
                          >
                            <td className="standings-position-cell">
                              <span className="standings-position-pill">{position}</span>
                            </td>
                            <td className="standings-name-cell">
                              {entry.spelerNaam}
                            </td>
                            <td className="standings-score-cell">{entry.punten}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="league-list-empty">Er is nog geen afgeronde Grand Prix met resultaten.</p>
            )}
          </section>

          <section className="league-section league-results-section-card">
            <div className="league-results-section-header">
              <h3>League stand</h3>
            </div>
            {standings.length > 0 ? (
              <div className="standings-table-wrapper">
                <table className="standings-table" aria-label="League stand">
                  <thead>
                    <tr>
                      <th scope="col" className="standings-position-column">
                        Positie
                      </th>
                      <th scope="col">Speler</th>
                      <th scope="col" className="standings-score-column">
                        Punten
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((entry, index) => {
                      const position = index + 1;
                      const topRankClass =
                        position === 1
                          ? " standings-row-p1"
                          : position === 2
                            ? " standings-row-p2"
                            : position === 3
                              ? " standings-row-p3"
                              : "";
                      return (
                        <tr
                          key={`total-${entry.userId}`}
                          className={`standings-row-clickable${topRankClass}`}
                          onClick={() => openPlayerDetails(entry.userId, leagueMembers, openMemberDetails, deadlinePassed)}
                          role="button"
                          tabIndex={deadlinePassed ? 0 : -1}
                          aria-label={`Bekijk details van ${entry.spelerNaam}`}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openPlayerDetails(entry.userId, leagueMembers, openMemberDetails, deadlinePassed);
                            }
                          }}
                          aria-disabled={!deadlinePassed}
                        >
                          <td className="standings-position-cell">
                            <span className="standings-position-pill">{position}</span>
                          </td>
                          <td className="standings-name-cell">
                            {entry.spelerNaam}
                          </td>
                          <td className="standings-score-cell">{entry.totaalPunten}</td>
                        </tr>
                      );
                    })}
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

"use client";

import { getGlobalPlayerGrandPrixView } from "@/app/actions/player-grand-prix-view";
import { PlayerGrandPrixDetail } from "@/app/leagues/[leagueId]/player-grand-prix-detail";

type GlobalStandingEntry = {
  userId: string;
  spelerNaam: string;
  totaalPunten: number;
};

type GlobalStandingsPanelProps = {
  grandPrix: {
    id: string;
    name: string;
  } | null;
  deadlinePassed: boolean;
  standings: GlobalStandingEntry[];
};

export function GlobalStandingsPanel({ grandPrix, deadlinePassed, standings }: GlobalStandingsPanelProps) {
  const members = standings.map((entry) => ({
    userId: entry.userId,
    displayName: entry.spelerNaam,
  }));

  const openPlayerDetails = (
    userId: string,
    openMemberDetails: (member: { userId: string; displayName: string }) => void,
    canOpenDetails: boolean,
  ) => {
    if (!canOpenDetails) {
      return;
    }

    const member = members.find((leagueMember) => leagueMember.userId === userId);
    if (member) {
      openMemberDetails(member);
    }
  };

  return (
    <PlayerGrandPrixDetail
      leagueId="global"
      grandPrixId={grandPrix?.id ?? ""}
      grandPrixName={grandPrix?.name ?? "Laatste Grand Prix"}
      deadlinePassed={deadlinePassed}
      members={members}
      showSectionShell={false}
      loadPlayerView={({ grandPrixId, member }) =>
        getGlobalPlayerGrandPrixView(grandPrixId, member.userId, member.displayName)
      }
      membersRenderer={({ openMemberDetails, deadlinePassed: canOpenDetails }) => (
        <>
          {standings.length === 0 ? (
            <p className="league-list-empty">Er zijn nog geen spelers om te tonen.</p>
          ) : (
            <div className="standings-table-wrapper dashboard-compact-table">
              <table className="standings-table dashboard-standings-table" aria-label="Algemeen klassement">
                <thead>
                  <tr>
                    <th scope="col" className="standings-position-column">Positie</th>
                    <th scope="col">Speler</th>
                    <th scope="col" className="standings-score-column standings-points-column">Punten</th>
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
                        key={entry.userId}
                        className={`standings-row-clickable${topRankClass}`}
                        onClick={() => openPlayerDetails(entry.userId, openMemberDetails, canOpenDetails)}
                        role="button"
                        tabIndex={canOpenDetails ? 0 : -1}
                        aria-label={`Bekijk details van ${entry.spelerNaam}`}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openPlayerDetails(entry.userId, openMemberDetails, canOpenDetails);
                          }
                        }}
                        aria-disabled={!canOpenDetails}
                      >
                        <td className="standings-position-cell">
                          <span className="standings-position-pill">{position}</span>
                        </td>
                        <td className="standings-name-cell" title={entry.spelerNaam}>{entry.spelerNaam}</td>
                        <td className="standings-score-cell standings-points-cell">{entry.totaalPunten}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    />
  );
}

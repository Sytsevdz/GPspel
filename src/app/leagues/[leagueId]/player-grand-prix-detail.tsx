"use client";

import Image from "next/image";
import { useMemo, useState, useTransition, type CSSProperties, type ReactNode } from "react";

import { getPlayerGrandPrixView, type PlayerGrandPrixViewResult } from "@/app/actions/player-grand-prix-view";
import { getConstructorTeamColors } from "@/lib/team-colors";
import { getTeamSideImageSize } from "@/lib/team-side-view-images";
import { resolveTeamSelectionTeam } from "@/lib/team-selection-teams";

type Member = {
  userId: string;
  displayName: string;
};

type DriverEntry = {
  id: string;
  name: string;
  constructorTeam: string;
};

type PredictionSlotPoints = {
  qualiP1: number | null;
  qualiP2: number | null;
  qualiP3: number | null;
  raceP1: number | null;
  raceP2: number | null;
  raceP3: number | null;
};

type PlayerGrandPrixDetailProps = {
  leagueId: string;
  grandPrixId: string;
  grandPrixName: string;
  deadlinePassed: boolean;
  members: Member[];
  loadPlayerView?: (args: {
    leagueId: string;
    grandPrixId: string;
    member: Member;
  }) => Promise<PlayerGrandPrixViewResult>;
  showSectionShell?: boolean;
  sectionTitle?: string;
  helperText?: string;
  membersRenderer?: (args: {
    members: Member[];
    deadlinePassed: boolean;
    openMemberDetails: (member: Member) => void;
  }) => ReactNode;
};

type LoadedSnapshot = Extract<PlayerGrandPrixViewResult, { status: "success" }>;

type PodiumSlot = {
  label: "P1" | "P2" | "P3";
  rankLabel: string;
  heightClassName: "podium-step-p1" | "podium-step-p2" | "podium-step-p3";
  slotClassName: "podium-slot--p1" | "podium-slot--p2" | "podium-slot--p3";
};

const QUALIFICATION_SLOTS: PodiumSlot[] = [
  { label: "P2", rankLabel: "Tweede plek", heightClassName: "podium-step-p2", slotClassName: "podium-slot--p2" },
  { label: "P1", rankLabel: "Pole position", heightClassName: "podium-step-p1", slotClassName: "podium-slot--p1" },
  { label: "P3", rankLabel: "Derde plek", heightClassName: "podium-step-p3", slotClassName: "podium-slot--p3" },
];

const RACE_SLOTS: PodiumSlot[] = [
  { label: "P2", rankLabel: "Tweede plek", heightClassName: "podium-step-p2", slotClassName: "podium-slot--p2" },
  { label: "P1", rankLabel: "Winnaar", heightClassName: "podium-step-p1", slotClassName: "podium-slot--p1" },
  { label: "P3", rankLabel: "Derde plek", heightClassName: "podium-step-p3", slotClassName: "podium-slot--p3" },
];

const EMPTY_LABELS_BY_SLOT: Record<PodiumSlot["label"], string> = {
  P1: "Geen coureur opgeslagen",
  P2: "Geen coureur opgeslagen",
  P3: "Geen coureur opgeslagen",
};

const formatPublishedPoints = (value: number | null) => (value === null ? "—" : value);

function PodiumReadOnly({
  title,
  podium,
  slots,
  publishedSlotPoints,
  showPublishedSlotPoints,
}: {
  title: string;
  podium: [DriverEntry, DriverEntry, DriverEntry] | null;
  slots: PodiumSlot[];
  publishedSlotPoints: PredictionSlotPoints;
  showPublishedSlotPoints: boolean;
}) {
  const podiumByPosition = useMemo(() => {
    if (!podium) {
      return new Map<string, DriverEntry>();
    }

    return new Map<string, DriverEntry>([
      ["P1", podium[0]],
      ["P2", podium[1]],
      ["P3", podium[2]],
    ]);
  }, [podium]);

  return (
    <section className="predictions-section">
      <div className="predictions-section-header">
        <h3>{title}</h3>
      </div>

      <div className="podium-grid" aria-label={`${title} podium`}>
        {slots.map((slot) => {
          const selectedDriver = podiumByPosition.get(slot.label);
          const selectedTeam = selectedDriver ? resolveTeamSelectionTeam(selectedDriver.constructorTeam) : null;
          const selectedCardImageSize = getTeamSideImageSize("selectedCard");
          const sectionPrefix = title === "Kwalificatie" ? "quali" : "race";
          const slotPointsField = `${sectionPrefix}${slot.label}` as keyof PredictionSlotPoints;
          const slotPublishedPoints = publishedSlotPoints[slotPointsField];

          return (
            <div key={`${title}-${slot.label}`} className={`podium-slot ${slot.heightClassName} ${slot.slotClassName} ${selectedDriver ? "filled" : "empty"}`}>
              <div className="podium-slot-content">
                <div className="podium-slot-heading">
                  <span className="podium-slot-position">{slot.label}</span>
                  <div className="podium-slot-meta">
                    <span className="podium-slot-rank-label">{slot.rankLabel}</span>
                    {showPublishedSlotPoints && slotPublishedPoints !== null ? (
                      <span className="podium-slot-points">+{slotPublishedPoints}</span>
                    ) : null}
                  </div>
                </div>
                <div className="podium-slot-visual">
                  {selectedDriver && selectedTeam ? (
                    <>
                      <div className="podium-car-image-wrapper">
                        <Image
                          src={selectedTeam.image}
                          alt={`${selectedTeam.name} wagen`}
                          width={selectedCardImageSize.width}
                          height={selectedCardImageSize.height}
                          className={selectedCardImageSize.className}
                        />
                      </div>
                      <div className="podium-slot-copy">
                        <strong>{selectedDriver.name}</strong>
                        <span>{selectedDriver.constructorTeam}</span>
                      </div>
                    </>
                  ) : (
                    <div className="podium-slot-placeholder">
                      <strong>{slot.label}</strong>
                      <span>{EMPTY_LABELS_BY_SLOT[slot.label]}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="podium-step-label">{`${title} ${slot.label}`}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function PlayerGrandPrixDetail({
  leagueId,
  grandPrixId,
  grandPrixName,
  deadlinePassed,
  members,
  loadPlayerView,
  showSectionShell = true,
  sectionTitle = "Spelers in deze GP",
  helperText,
  membersRenderer,
}: PlayerGrandPrixDetailProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [snapshot, setSnapshot] = useState<LoadedSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const teamScoreDetailsByDriverId = useMemo(() => {
    return new Map(
      (snapshot?.teamScoreDetails ?? []).map((detail) => [
        detail.driverId,
        {
          teamSprintQualiPoints: detail.teamSprintQualiPoints,
          teamSprintRacePoints: detail.teamSprintRacePoints,
          teamQualiPoints: detail.teamQualiPoints,
          teamRacePoints: detail.teamRacePoints,
          totalPoints: detail.totalPoints,
        },
      ]),
    );
  }, [snapshot?.teamScoreDetails]);

  const predictionSlotPoints = useMemo<PredictionSlotPoints>(() => {
    const slotPoints: PredictionSlotPoints = {
      qualiP1: null,
      qualiP2: null,
      qualiP3: null,
      raceP1: null,
      raceP2: null,
      raceP3: null,
    };

    (snapshot?.predictionSlotScores ?? []).forEach((detail) => {
      const sectionPrefix = detail.predictionType === "quali" ? "quali" : "race";
      const field = `${sectionPrefix}P${detail.slotPosition}` as keyof PredictionSlotPoints;
      slotPoints[field] = detail.points;
    });

    return slotPoints;
  }, [snapshot?.predictionSlotScores]);

  const hasPublishedTeamScores = useMemo(() => {
    return (snapshot?.teamScoreDetails ?? []).some(
      (detail) =>
        detail.teamSprintQualiPoints !== null ||
        detail.teamSprintRacePoints !== null ||
        detail.teamQualiPoints !== null ||
        detail.teamRacePoints !== null ||
        detail.totalPoints !== null,
    );
  }, [snapshot?.teamScoreDetails]);

  const hasPublishedSprintQualiTeamScores = snapshot?.publication.sprintQualiPublished ?? false;

  const hasPublishedSprintRaceTeamScores = snapshot?.publication.sprintRacePublished ?? false;

  const hasPublishedQualiTeamScores = snapshot?.publication.qualiPublished ?? false;

  const hasPublishedRaceTeamScores = snapshot?.publication.racePublished ?? false;

  const hasPublishedPredictionSlotScores = useMemo(() => {
    return (snapshot?.predictionSlotScores ?? []).some((detail) => detail.points !== null);
  }, [snapshot?.predictionSlotScores]);

  const hasPublishedTotals = useMemo(() => {
    if (!snapshot) {
      return false;
    }

    return (
      snapshot.totals.teamPoints !== null ||
      snapshot.totals.predictionPoints !== null ||
      snapshot.totals.totalPoints !== null
    );
  }, [snapshot]);

  const openMemberDetails = (member: Member) => {
    if (!deadlinePassed) {
      return;
    }

    setSelectedMember(member);
    setIsModalOpen(true);
    setSnapshot(null);
    setErrorMessage("");

    startTransition(async () => {
      const result = loadPlayerView
        ? await loadPlayerView({ leagueId, grandPrixId, member })
        : await getPlayerGrandPrixView(leagueId, grandPrixId, member.userId, member.displayName);

      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }

      setSnapshot(result);
    });
  };

  const renderedMembers = membersRenderer ? (
    membersRenderer({
      members,
      deadlinePassed,
      openMemberDetails,
    })
  ) : (
    <ul className="league-member-list" aria-label="Spelers">
      {members.map((member) => (
        <li key={member.userId}>
          <button
            type="button"
            className="league-member-trigger"
            onClick={() => openMemberDetails(member)}
            disabled={!deadlinePassed}
          >
            {member.displayName}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <section className={showSectionShell ? "league-section" : undefined}>
      {showSectionShell ? (
        <>
          <div className="league-detail-header">
            <h2>{sectionTitle}</h2>
          </div>
          <p className="league-member-helper">
            {helperText ??
              (deadlinePassed
                ? "Klik op een speler om het opgeslagen team en de voorspellingen voor deze Grand Prix te bekijken."
                : "Na de kwalificatiedeadline kun je hier de keuzes van andere spelers bekijken.")}
          </p>
        </>
      ) : null}

      {renderedMembers}

      {isModalOpen ? (
        <div
          className="podium-selection-overlay player-detail-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
            <section className="podium-selection-panel player-detail-panel" role="dialog" aria-modal="true" aria-label="Spelerdetails">
            <div className="podium-selection-panel-header player-detail-header">
              <div className="player-detail-header-copy">
                <span className="player-detail-eyebrow">Spelerdetail</span>
                <h3>{snapshot?.playerName ?? selectedMember?.displayName ?? "Speler"}</h3>
                <p>
                  <strong>Grand Prix:</strong> {grandPrixName}
                </p>
              </div>
              <button type="button" className="podium-selection-close" onClick={() => setIsModalOpen(false)}>
                Sluiten
              </button>
            </div>

            {isPending ? <p className="league-list-empty">Gegevens laden...</p> : null}
            {!isPending && errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

            {!isPending && snapshot ? (
              <div className="player-detail-content">
                <section className="team-selection-summary compact-team-selection-summary">
                  <div className="player-detail-section-header">
                    <h3>Team selectie (4 coureurs)</h3>
                    <p>Opgeslagen selectie voor deze Grand Prix.</p>
                  </div>
                  {snapshot.teamSelection.length > 0 ? (
                    <ul className="selected-driver-cars compact-selected-driver-cars" aria-label="Geselecteerde coureurs met teamwagens">
                      {snapshot.teamSelection.map((driver) => {
                        const team = resolveTeamSelectionTeam(driver.constructorTeam);
                        const imageSize = getTeamSideImageSize("selectedCard");
                        const teamColors = getConstructorTeamColors(driver.constructorTeam);

                        const driverPoints = teamScoreDetailsByDriverId.get(driver.id);
                        const pointRows = [
                          {
                            label: "Sprint kwali",
                            value: hasPublishedSprintQualiTeamScores ? (driverPoints?.teamSprintQualiPoints ?? 0) : null,
                          },
                          {
                            label: "Sprint race",
                            value: hasPublishedSprintRaceTeamScores ? (driverPoints?.teamSprintRacePoints ?? 0) : null,
                          },
                          { label: "Kwali", value: hasPublishedQualiTeamScores ? (driverPoints?.teamQualiPoints ?? 0) : null },
                          { label: "Race", value: hasPublishedRaceTeamScores ? (driverPoints?.teamRacePoints ?? 0) : null },
                          { label: "Totaal", value: hasPublishedTeamScores ? (driverPoints?.totalPoints ?? 0) : null },
                        ].filter((row) => row.value !== null);

                        return (
                          <li
                            key={driver.id}
                            className="player-detail-driver-card"
                            style={
                              {
                                "--team-accent": teamColors.accent,
                                "--team-accent-secondary": teamColors.accentSecondary,
                                "--team-bg-from": teamColors.backgroundFrom,
                                "--team-bg-to": teamColors.backgroundTo,
                              } as CSSProperties
                            }
                          >
                            <div className="selected-driver-car">
                              <Image
                                src={team.image}
                                alt={`${team.name} wagen`}
                                width={imageSize.width}
                                height={imageSize.height}
                                className={imageSize.className}
                              />
                            </div>
                            <div className="player-detail-driver-copy">
                              <p>
                                <strong>{driver.name}</strong>
                                <span>{driver.constructorTeam}</span>
                              </p>
                              {hasPublishedTeamScores ? (
                                <dl className="player-detail-driver-points">
                                  {pointRows.map((row) => (
                                    <div key={`${driver.id}-${row.label}`}>
                                      <dt>{row.label}</dt>
                                      <dd>{formatPublishedPoints(row.value)}</dd>
                                    </div>
                                  ))}
                                </dl>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="league-list-empty">Geen team opgeslagen</p>
                  )}
                  {snapshot.teamSelection.length > 0 && !hasPublishedTeamScores ? (
                    <p className="league-list-empty">Teampunten zijn nog niet gepubliceerd.</p>
                  ) : null}
                </section>

                <section>
                  <div className="player-detail-section-header">
                    <h3>Voorspellingen</h3>
                    <p>Kwalificatie en race staan los van elkaar weergegeven.</p>
                  </div>
                  {snapshot.qualificationPodium || snapshot.racePodium ? (
                    <>
                      <PodiumReadOnly
                        title="Kwalificatie"
                        podium={snapshot.qualificationPodium}
                        slots={QUALIFICATION_SLOTS}
                        publishedSlotPoints={predictionSlotPoints}
                        showPublishedSlotPoints={hasPublishedPredictionSlotScores}
                      />
                      <PodiumReadOnly
                        title="Race"
                        podium={snapshot.racePodium}
                        slots={RACE_SLOTS}
                        publishedSlotPoints={predictionSlotPoints}
                        showPublishedSlotPoints={hasPublishedPredictionSlotScores}
                      />
                    </>
                  ) : (
                    <p className="league-list-empty">Geen voorspellingen opgeslagen</p>
                  )}
                  {(snapshot.qualificationPodium || snapshot.racePodium) && !hasPublishedPredictionSlotScores ? (
                    <p className="league-list-empty">Voorspellingspunten zijn nog niet gepubliceerd.</p>
                  ) : null}
                </section>

                <section className="player-detail-totals">
                  {hasPublishedTotals ? (
                    <dl className="gp-spel-inline-totals">
                      <div>
                        <dt>Team punten</dt>
                        <dd>{formatPublishedPoints(snapshot.totals.teamPoints)}</dd>
                      </div>
                      <div>
                        <dt>Voorspelling punten</dt>
                        <dd>{formatPublishedPoints(snapshot.totals.predictionPoints)}</dd>
                      </div>
                      <div>
                        <dt>Totaal punten</dt>
                        <dd>{formatPublishedPoints(snapshot.totals.totalPoints)}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="league-list-empty">Punten zijn nog niet gepubliceerd voor deze Grand Prix.</p>
                  )}
                </section>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}

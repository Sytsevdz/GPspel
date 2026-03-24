"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";

import { getPlayerGrandPrixView, type PlayerGrandPrixViewResult } from "@/app/actions/player-grand-prix-view";
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

type PlayerGrandPrixDetailProps = {
  leagueId: string;
  grandPrixId: string;
  grandPrixName: string;
  deadlinePassed: boolean;
  members: Member[];
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

function PodiumReadOnly({
  title,
  podium,
  slots,
}: {
  title: string;
  podium: [DriverEntry, DriverEntry, DriverEntry] | null;
  slots: PodiumSlot[];
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

          return (
            <div key={`${title}-${slot.label}`} className={`podium-slot ${slot.heightClassName} ${slot.slotClassName} ${selectedDriver ? "filled" : "empty"}`}>
              <div className="podium-slot-content">
                <div className="podium-slot-heading">
                  <span className="podium-slot-position">{slot.label}</span>
                  <span className="podium-slot-rank-label">{slot.rankLabel}</span>
                </div>
                <div className="podium-slot-visual">
                  {selectedDriver && selectedTeam ? (
                    <>
                      <div className="podium-car-image-wrapper">
                        <Image src={selectedTeam.image} alt={`${selectedTeam.name} wagen`} width={260} height={104} className="podium-car-image" />
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
}: PlayerGrandPrixDetailProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [snapshot, setSnapshot] = useState<LoadedSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const openMemberDetails = (member: Member) => {
    if (!deadlinePassed) {
      return;
    }

    setSelectedMember(member);
    setIsModalOpen(true);
    setSnapshot(null);
    setErrorMessage("");

    startTransition(async () => {
      const result = await getPlayerGrandPrixView(leagueId, grandPrixId, member.userId, member.displayName);

      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }

      setSnapshot(result);
    });
  };

  return (
    <section className="league-section">
      <div className="league-detail-header">
        <h2>Spelers in deze GP</h2>
      </div>
      <p className="league-member-helper">
        {deadlinePassed
          ? "Klik op een speler om het opgeslagen team en de voorspellingen voor deze Grand Prix te bekijken."
          : "Na de kwalificatiedeadline kun je hier de keuzes van andere spelers bekijken."}
      </p>

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
            <div className="podium-selection-panel-header">
              <div>
                <h3>{snapshot?.playerName ?? selectedMember?.displayName ?? "Speler"}</h3>
                <p>{grandPrixName}</p>
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
                  <h3>Team selectie (4 coureurs)</h3>
                  {snapshot.teamSelection.length > 0 ? (
                    <ul className="selected-driver-cars compact-selected-driver-cars" aria-label="Geselecteerde coureurs met teamwagens">
                      {snapshot.teamSelection.map((driver) => {
                        const team = resolveTeamSelectionTeam(driver.constructorTeam);

                        return (
                          <li key={driver.id}>
                            <div className="selected-driver-car">
                              <Image src={team.image} alt={`${team.name} wagen`} width={240} height={96} className="selected-driver-car-image" />
                            </div>
                            <p>
                              <strong>{driver.name}</strong>
                              <span>{driver.constructorTeam}</span>
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="league-list-empty">Geen team opgeslagen</p>
                  )}
                </section>

                <section>
                  {snapshot.qualificationPodium || snapshot.racePodium ? (
                    <>
                      <PodiumReadOnly title="Kwalificatie" podium={snapshot.qualificationPodium} slots={QUALIFICATION_SLOTS} />
                      <PodiumReadOnly title="Race" podium={snapshot.racePodium} slots={RACE_SLOTS} />
                    </>
                  ) : (
                    <p className="league-list-empty">Geen voorspellingen opgeslagen</p>
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

export type ResultPhaseId = "sprintQualification" | "sprintRace" | "qualification" | "final";
export type PublicationState = Record<ResultPhaseId, boolean>;
type Phase = { id: ResultPhaseId; title: string; field: "qualificationOrder" | "sprintQualificationOrder" | "sprintRaceOrder" | "raceOrder" };
export function resultPhases(sprint: boolean): Phase[] {
  return [
    ...(sprint ? [
      { id: "sprintQualification", title: "Sprintkwalificatie", field: "sprintQualificationOrder" },
      { id: "sprintRace", title: "Sprint", field: "sprintRaceOrder" },
    ] as Phase[] : []),
    { id: "qualification", title: "Kwalificatie", field: "qualificationOrder" },
    { id: "final", title: "Race", field: "raceOrder" },
  ];
}
export function initialOpenPhases(phases: Phase[], published: PublicationState): ResultPhaseId[] {
  const first = phases.find(phase => !published[phase.id]);
  return first ? [first.id] : [];
}
export function advanceResultPhase(current: { published: PublicationState; open: ResultPhaseId[] }, phases: Phase[], phase: string) {
  if (phase === "reset") {
    const published = { qualification: false, sprintQualification: false, sprintRace: false, final: false };
    return { published, open: initialOpenPhases(phases, published) };
  }
  const index = phases.findIndex(item => item.id === phase);
  if (index < 0) return current;
  const next = phases[index + 1];
  return {
    published: { ...current.published, [phase]: true },
    open: Array.from(new Set([...current.open.filter(id => id !== phase), ...(next ? [next.id] : [])])),
  };
}

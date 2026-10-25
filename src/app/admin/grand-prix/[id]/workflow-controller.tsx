"use client";

import { useEffect } from "react";

const sections = ["participants", "prices", "settings", "bonus", "results", "overview"];
const successMessages: Record<string, string> = {
  "GP-deelnemers opgeslagen": "participants",
  "Prijzen succesvol berekend": "prices",
  "Weekendtype bijgewerkt": "settings",
  "Bonusvraag opgeslagen": "bonus",
};
type Snapshot = { open: boolean[]; done: boolean[]; pending?: string; phases?: string[]; scrollY?: number; bonusFeedback?: string };
const snapshots = new Map<string, Snapshot>();

export function reportWorkflowSuccess(grandPrixId: string, section: string) {
  window.dispatchEvent(new CustomEvent("gp-workflow-success", { detail: { grandPrixId, section } }));
}

// Publication has no durable per-phase completion marker. Use confirmed successes
// from this page session, never GP status or the mere presence of a score row.
export function reportResultWorkflow(grandPrixId: string, phase: string, sprint: boolean) {
  const state = snapshots.get(grandPrixId);
  if (!state) return;
  if (phase === "reset") {
    state.phases = [];
    state.done[4] = false;
    state.open[4] = true;
    return;
  }
  state.phases = Array.from(new Set([...(state.phases ?? []), phase]));
  const required = sprint ? ["qualification", "sprintQualification", "sprintRace", "final"] : ["qualification", "final"];
  if (required.every((item) => state.phases?.includes(item))) {
    state.done[4] = true;
    state.open[4] = false;
    state.open[5] = true;
  }
}

export function WorkflowController({ grandPrixId, completed, message, error, bonusFeedback }: {
  grandPrixId: string; completed: boolean[]; message: string | null; error: string | null; bonusFeedback?: string | null;
}) {
  useEffect(() => {
    const elements = sections.map((id) => document.querySelector<HTMLDetailsElement>(`[data-workflow-section="${id}"]`));
    let state = snapshots.get(grandPrixId);
    if (!state) {
      const first = completed.slice(0, 5).findIndex((done) => !done);
      state = { open: sections.map((_, index) => index === first), done: [...completed] };
      snapshots.set(grandPrixId, state);
    }
    const snapshot = state;
    // Database-backed indicators may become incomplete after a reset.
    for (const index of [0, 1, 3]) snapshot.done[index] = completed[index];
    const render = () => elements.forEach((element, index) => {
      if (!element) return;
      element.open = snapshot.open[index];
      const status = element.querySelector("[data-workflow-status]");
      if (status) status.textContent = snapshot.done[index] ? "Afgerond" : "";
    });
    const advance = (section: string) => {
      const index = sections.indexOf(section);
      if (index < 0 || index === 5) return;
      snapshot.done[index] = true;
      snapshot.open[index] = false;
      snapshot.open[index + 1] = true;
      render();
    };
    if (snapshot.pending === "results" && !error && message === "Uitslag voor deze GP is gereset") {
      reportResultWorkflow(grandPrixId, "reset", false);
    }
    if (snapshot.pending) {
      if (!error && message && successMessages[message] === snapshot.pending) advance(snapshot.pending);
      // Reset/cancel actions and failures must never advance the workflow.
      delete snapshot.pending;
    }
    // Redirect feedback is independent of the transient submit listener. Consume
    // each receipt once so subsequent revalidation respects manual toggles.
    if (bonusFeedback && snapshot.bonusFeedback !== bonusFeedback) {
      snapshot.bonusFeedback = bonusFeedback;
      if (!error && message === "Bonusvraag opgeslagen") {
        snapshot.open[2] = false;
        advance("bonus");
      } else if (error) {
        snapshot.open[2] = false;
        snapshot.open[3] = true;
      }
    }
    render();
    if (snapshot.scrollY !== undefined) {
      const scrollY = snapshot.scrollY;
      delete snapshot.scrollY;
      requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "instant" as ScrollBehavior }));
    }
    const toggle = (event: Event) => {
      const index = elements.indexOf(event.target as HTMLDetailsElement);
      if (index >= 0) snapshot.open[index] = elements[index]!.open;
    };
    const submit = (event: Event) => {
      const form = event.target as HTMLFormElement;
      const section = form.closest<HTMLDetailsElement>("[data-workflow-section]");
      if (section) {
        snapshot.pending = section.dataset.workflowSection;
        if (typeof window.scrollY === "number") snapshot.scrollY = window.scrollY;
      }
    };
    const success = (event: Event) => {
      const detail = (event as CustomEvent<{ grandPrixId: string; section: string }>).detail;
      if (detail.grandPrixId === grandPrixId) advance(detail.section);
    };
    elements.forEach((element) => element?.addEventListener("toggle", toggle));
    document.addEventListener("submit", submit, true);
    window.addEventListener("gp-workflow-success", success);
    return () => {
      elements.forEach((element) => element?.removeEventListener("toggle", toggle));
      document.removeEventListener("submit", submit, true);
      window.removeEventListener("gp-workflow-success", success);
    };
  }, [grandPrixId, completed, message, error, bonusFeedback]);
  return null;
}

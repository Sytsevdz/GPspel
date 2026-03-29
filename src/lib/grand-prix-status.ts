export type GrandPrixStatus = "upcoming" | "open" | "locked" | "finished" | "cancelled";
export type GrandPrixWorkflowStatus = "upcoming" | "locked" | "finished" | "cancelled";

type GrandPrixStatusContext = {
  status: GrandPrixStatus;
  deadline: string;
  nowIso?: string;
};

export function resolveGrandPrixWorkflowStatus({
  status,
  deadline,
  nowIso = new Date().toISOString(),
}: GrandPrixStatusContext): GrandPrixWorkflowStatus {
  if (status === "cancelled") {
    return "cancelled";
  }

  if (status === "finished") {
    return "finished";
  }

  if (deadline <= nowIso) {
    return "locked";
  }

  return "upcoming";
}

export function getGrandPrixStatusLabel(status: GrandPrixStatus | GrandPrixWorkflowStatus): string {
  switch (status) {
    case "upcoming":
      return "Aankomend";
    case "locked":
      return "Vergrendeld";
    case "finished":
      return "Afgerond";
    case "cancelled":
      return "Geannuleerd";
    case "open":
      return "Aankomend";
    default:
      return status;
  }
}

export function isGrandPrixCancelled(status: GrandPrixStatus | GrandPrixWorkflowStatus): boolean {
  return status === "cancelled";
}

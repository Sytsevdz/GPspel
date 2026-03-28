export type GrandPrixStatus = "upcoming" | "open" | "locked" | "finished" | "cancelled";

export function getGrandPrixStatusLabel(status: GrandPrixStatus): string {
  switch (status) {
    case "upcoming":
      return "Aankomend";
    case "open":
      return "Open";
    case "locked":
      return "Vergrendeld";
    case "finished":
      return "Afgerond";
    case "cancelled":
      return "Geannuleerd";
    default:
      return status;
  }
}

export function isGrandPrixCancelled(status: GrandPrixStatus): boolean {
  return status === "cancelled";
}

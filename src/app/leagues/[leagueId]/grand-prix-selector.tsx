"use client";

import { useRouter } from "next/navigation";

import type { GrandPrixTimelineItem } from "@/lib/team-selection-data";
import { getGrandPrixStatusLabel } from "@/lib/grand-prix-status";

type GrandPrixSelectorProps = {
  timeline: GrandPrixTimelineItem[];
  selectedGrandPrixId: string;
  routeBase: string;
};

export function GrandPrixSelector({ timeline, selectedGrandPrixId, routeBase }: GrandPrixSelectorProps) {
  const router = useRouter();

  return (
    <label className="gp-selector" htmlFor="grand-prix-selector">
      <span>Grand Prix</span>
      <select
        id="grand-prix-selector"
        value={selectedGrandPrixId}
        onChange={(event) => {
          router.push(`${routeBase}/${event.target.value}`);
        }}
      >
        {timeline.map((grandPrix) => (
          <option key={grandPrix.id} value={grandPrix.id}>
            {grandPrix.name} {grandPrix.status === "cancelled" ? `(${getGrandPrixStatusLabel(grandPrix.status)})` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

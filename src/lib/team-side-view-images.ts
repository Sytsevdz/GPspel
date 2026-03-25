export type TeamImageSizeVariant = "smallList" | "selectedCard" | "modalOption" | "slot";

type TeamSideImageSize = {
  width: number;
  height: number;
  className: string;
};

export const TEAM_SIDE_VIEW_IMAGE_MAP: Record<string, string> = {
  alpine: "/images/teams/Alpine - car-side.png",
  astonmartin: "/images/teams/Aston Martin - car-side.png",
  audi: "/images/teams/Audi - car-side.png",
  cadillac: "/images/teams/Cadillac - car-side.png",
  ferrari: "/images/teams/Ferrari - car-side.png",
  haas: "/images/teams/Haas - car-side.png",
  mclaren: "/images/teams/Mclaren - car-side.png",
  mercedes: "/images/teams/Mercedes - car-side.png",
  racingbulls: "/images/teams/Racing Bulls - car-side.png",
  redbull: "/images/teams/Red Bull - car-side.png",
  williams: "/images/teams/Williams - car-side.png",
};

const TEAM_SIDE_IMAGE_SIZES: Record<TeamImageSizeVariant, TeamSideImageSize> = {
  smallList: { width: 220, height: 88, className: "team-side-image team-side-image--small-list" },
  selectedCard: { width: 260, height: 104, className: "team-side-image team-side-image--selected-card" },
  modalOption: { width: 220, height: 88, className: "team-side-image team-side-image--modal-option" },
  slot: { width: 280, height: 112, className: "team-side-image team-side-image--slot" },
};

export const getTeamSideImageSize = (variant: TeamImageSizeVariant): TeamSideImageSize =>
  TEAM_SIDE_IMAGE_SIZES[variant];

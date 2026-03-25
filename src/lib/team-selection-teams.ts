import { TEAM_SIDE_VIEW_IMAGE_MAP } from "@/lib/team-side-view-images";

export type TeamSelectionTeam = {
  id: string;
  name: string;
  image: string;
};

const createFallbackTeamSelectionTeam = (teamName: string): TeamSelectionTeam => ({
  id: teamName.toLowerCase().replace(/\s+/g, ""),
  name: teamName,
  image: `/images/teams/${teamName} - car-side.png`,
});

export const TEAM_SELECTION_TEAMS: TeamSelectionTeam[] = [
  {
    id: "alpine",
    name: "Alpine",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.alpine,
  },
  {
    id: "astonmartin",
    name: "Aston Martin",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.astonmartin,
  },
  {
    id: "audi",
    name: "Audi",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.audi,
  },
  {
    id: "cadillac",
    name: "Cadillac",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.cadillac,
  },
  {
    id: "ferrari",
    name: "Ferrari",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.ferrari,
  },
  {
    id: "haas",
    name: "Haas",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.haas,
  },
  {
    id: "mclaren",
    name: "Mclaren",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.mclaren,
  },
  {
    id: "mercedes",
    name: "Mercedes",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.mercedes,
  },
  {
    id: "racingbulls",
    name: "Racing Bulls",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.racingbulls,
  },
  {
    id: "redbull",
    name: "Red Bull",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.redbull,
  },
  {
    id: "williams",
    name: "Williams",
    image: TEAM_SIDE_VIEW_IMAGE_MAP.williams,
  },
];

const TEAM_SELECTION_TEAM_ALIASES: Array<{
  match: RegExp;
  teamId: TeamSelectionTeam["id"];
}> = [
  { match: /alpine/i, teamId: "alpine" },
  { match: /aston\s*martin/i, teamId: "astonmartin" },
  { match: /audi|sauber|kick/i, teamId: "audi" },
  { match: /cadillac/i, teamId: "cadillac" },
  { match: /ferrari/i, teamId: "ferrari" },
  { match: /haas/i, teamId: "haas" },
  { match: /mclaren/i, teamId: "mclaren" },
  { match: /mercedes/i, teamId: "mercedes" },
  { match: /racing\s*bulls|rb\s*f1|alphatauri/i, teamId: "racingbulls" },
  { match: /red\s*bull/i, teamId: "redbull" },
  { match: /williams/i, teamId: "williams" },
];

export const getTeamSelectionTeam = (teamName: string): TeamSelectionTeam | null => {
  const exactMatch = TEAM_SELECTION_TEAMS.find((team) => team.name === teamName);

  if (exactMatch) {
    return exactMatch;
  }

  const alias = TEAM_SELECTION_TEAM_ALIASES.find(({ match }) => match.test(teamName));
  if (!alias) {
    return null;
  }

  return TEAM_SELECTION_TEAMS.find((team) => team.id === alias.teamId) ?? null;
};

export const resolveTeamSelectionTeam = (teamName: string): TeamSelectionTeam =>
  getTeamSelectionTeam(teamName) ?? createFallbackTeamSelectionTeam(teamName);
